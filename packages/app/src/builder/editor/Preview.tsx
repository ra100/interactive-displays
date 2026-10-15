import { type Effect, findNode, type NormRect, type Profile, type Screen } from "@interactive-displays/core";
import { type PointerEvent as ReactPointerEvent, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ScreenView } from "../../runtime/ScreenView.tsx";
import { type DragHandle, dragRect, type Selection, withRect } from "./editing.ts";
import { useEditor } from "./EditorContext.ts";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const ratio = (aspect: Profile["aspect"]) => aspect.replace(":", " / ");

const selectorFor = (selection: Selection): string | undefined => {
  if (selection?.kind === "node") return `[data-node-id="${selection.id}"]`;
  if (selection?.kind === "slot") return `[data-node-id="${selection.frameId}"] [data-slot="${selection.slot}"]`;
  return undefined;
};

const boxOf = (stage: HTMLElement, selector: string | undefined): Box | null => {
  const element = selector ? stage.querySelector(selector) : null;
  if (!element) return null;
  const outer = stage.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return { left: inner.left - outer.left, top: inner.top - outer.top, width: inner.width, height: inner.height };
};

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

// Follows the selected element's position as the screen, the stage size or the selection change.
// `version` is anything whose change can move the element: the screen, the aspect, the theme.
const useSelectionBox = (stage: RefObject<HTMLDivElement | null>, selector: string | undefined, version: string) => {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => {
      const next = boxOf(element, selector);
      setBox((current) => (sameBox(current, next) ? current : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [stage, selector, version]);
  return box;
};

const nodeIdAt = (stage: HTMLElement, x: number, y: number): string | undefined => {
  for (const element of document.elementsFromPoint(x, y)) {
    if (!stage.contains(element) || element.closest(".selection-box")) continue;
    const id = element.closest<HTMLElement>("[data-node-id]")?.dataset["nodeId"];
    if (id) return id;
  }
  return undefined;
};

// A number per object, so "the screen changed" can be part of the string key the selection box follows.
const versions = new WeakMap<object, number>();
let nextVersion = 0;
const versionKey = (value: object): number => {
  const known = versions.get(value);
  if (known !== undefined) return known;
  nextVersion += 1;
  versions.set(value, nextVersion);
  return nextVersion;
};

const HANDLES: DragHandle[] = ["nw", "ne", "sw", "se"];

// The display runtime itself, so the preview is exactly what displays show. Clicking selects the node under
// the pointer; a node on a canvas can be dragged and resized, snapping to 1% steps.
export const Preview = ({
  screen,
  aspect,
  effect,
  readOnly = false,
}: {
  screen: Screen;
  aspect: Profile["aspect"];
  effect: Effect;
  readOnly?: boolean;
}) => {
  const { selection, select, apply, preview } = useEditor();
  const stage = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; rect: NormRect } | undefined>(undefined);

  const shown = useMemo(() => (drag ? withRect(screen, drag.id, drag.rect) : screen), [screen, drag]);
  const box = useSelectionBox(
    stage,
    readOnly ? undefined : selectorFor(selection),
    `${aspect}|${preview.state}|${preview.themeId}|${preview.variant ?? ""}|${effect}|${versionKey(shown)}`,
  );

  const location = selection?.kind === "node" ? findNode(screen.root, selection.id) : undefined;
  const onCanvas = !readOnly && location?.parent?.layout.kind === "canvas" && location.entry ? location : undefined;

  const startDrag = (handle: DragHandle) => (event: ReactPointerEvent<HTMLElement>) => {
    const element = stage.current;
    const canvas = onCanvas?.parent ? element?.querySelector(`[data-node-id="${onCanvas.parent.id}"]`) : null;
    if (!onCanvas || !element || !canvas || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const id = onCanvas.node.id;
    const bounds = canvas.getBoundingClientRect();
    const from = onCanvas.entry?.rect ?? { x: 0, y: 0, w: 1, h: 1 };
    const start = { x: event.clientX, y: event.clientY };
    const target = event.currentTarget;
    let last = from;
    let moved = false;
    target.setPointerCapture(event.pointerId);

    const onMove = (move: PointerEvent) => {
      if (!moved && Math.hypot(move.clientX - start.x, move.clientY - start.y) < 3) return;
      moved = true;
      last = dragRect(from, handle, (move.clientX - start.x) / bounds.width, (move.clientY - start.y) / bounds.height);
      setDrag({ id, rect: last });
    };
    const onUp = (up: PointerEvent) => {
      target.removeEventListener("pointermove", onMove);
      setDrag(undefined);
      if (moved) apply([{ op: "place", id, rect: last }]);
      else if (handle === "move") {
        const under = nodeIdAt(element, up.clientX, up.clientY);
        if (under && under !== id) select({ kind: "node", id: under });
      }
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div className="preview-area">
      <div
        ref={stage}
        className="preview-stage"
        style={{ aspectRatio: ratio(aspect), ["--stage-ratio" as string]: aspect.replace(":", "/") }}
        data-read-only={readOnly}
        onClickCapture={(event) => {
          // Display widgets do nothing in the editor; a click selects.
          event.preventDefault();
          event.stopPropagation();
          const target = event.target as HTMLElement;
          // The selection box handles its own clicks, on pointer up.
          if (readOnly || target.closest(".selection-box")) return;
          const id = target.closest<HTMLElement>("[data-node-id]")?.dataset["nodeId"];
          select(id ? { kind: "node", id } : null);
        }}
      >
        <ScreenView
          screen={shown}
          themeId={preview.themeId}
          variant={preview.variant}
          state={preview.state}
          effect={effect}
          embedded
        />
        {box ? (
          <div
            className="selection-box"
            data-canvas={Boolean(onCanvas)}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            onPointerDown={onCanvas ? startDrag("move") : undefined}
          >
            {onCanvas
              ? HANDLES.map((handle) => (
                  <span key={handle} className="selection-box__handle" data-handle={handle} onPointerDown={startDrag(handle)} />
                ))
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
