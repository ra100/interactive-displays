import { useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import { applyOps, catalog, type Effect, findNode, type Op, type Profile, type Screen, takenIds } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ScreenView } from "../../runtime/ScreenView.tsx";
import type { DragSource } from "./dragSource.ts";
import { type Box, type Point, trackAt } from "./dropGeometry.ts";
import { type DragHandle, dragRect, insertOps, moveOps, nodeLabel, type Selection, withRect } from "./editing.ts";
import { useEditor } from "./EditorContext.ts";
import { type Handle, measureHandles } from "./layoutHandles.ts";
import { setTracksOps, shareAfterDrag, spanAfterDrag, tracksAfterDrag, weightOps } from "./layoutTools.ts";
import { type Drop, findDrop } from "./previewDrop.ts";
import { SelectionTools } from "./SelectionTools.tsx";

const ratio = (aspect: Profile["aspect"]) => aspect.replace(":", " / ");

const selectorFor = (selection: Selection): string | undefined => {
  if (selection?.kind === "node") return `[data-node-id="${CSS.escape(selection.id)}"]`;
  if (selection?.kind === "slot") return `[data-node-id="${CSS.escape(selection.frameId)}"] [data-slot="${selection.slot}"]`;
  return undefined;
};

const boxOf = (stage: HTMLElement, selector: string | undefined): Box | null => {
  const element = selector ? stage.querySelector(selector) : null;
  if (!element) return null;
  const outer = stage.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return { left: inner.left - outer.left, top: inner.top - outer.top, width: inner.width, height: inner.height };
};

// Measures something from the rendered preview, again whenever the screen, the stage size or `version` changes.
// `same` keeps the old result when nothing moved, so measuring does not render in a loop.
const useMeasured = <T,>(
  stage: RefObject<HTMLDivElement | null>,
  measure: (element: HTMLElement) => T,
  same: (a: T, b: T) => boolean,
  initial: T,
  version: string,
): T => {
  const [value, setValue] = useState<T>(initial);
  const latest = useRef(measure);
  latest.current = measure;
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const update = () => {
      const next = latest.current(element);
      setValue((current) => (same(current, next) ? current : next));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [stage, version, same]);
  return value;
};

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

const sameHandles = (a: Handle[], b: Handle[]) =>
  a.length === b.length && a.every((handle, index) => handle.key === b[index]?.key && sameBox(handle.box, b[index]?.box ?? null));

const nodeIdAt = (stage: HTMLElement, x: number, y: number): string | undefined => {
  for (const element of document.elementsFromPoint(x, y)) {
    if (!stage.contains(element) || element.closest(".preview-overlay")) continue;
    const id = element.closest<HTMLElement>("[data-node-id]")?.dataset["nodeId"];
    if (id) return id;
  }
  return undefined;
};

// A number per object, so "the screen changed" can be part of the string key the measurements follow.
const versions = new WeakMap<object, number>();
let nextVersion = 0;
const versionKey = (value: object): number => {
  const known = versions.get(value);
  if (known !== undefined) return known;
  nextVersion += 1;
  versions.set(value, nextVersion);
  return nextVersion;
};

const OPTIONS = { catalog, decor: decorCatalog };

const CORNERS: DragHandle[] = ["nw", "ne", "sw", "se"];

// Where the pointer is during a drag. dnd-kit's own delta is corrected for the scrolling of the panel a drag
// starts in, so it is not the pointer; the window's pointer events are.
const usePointer = (): RefObject<Point | undefined> => {
  const pointer = useRef<Point | undefined>(undefined);
  useEffect(() => {
    const track = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", track, { capture: true, passive: true });
    window.addEventListener("pointerdown", track, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointermove", track, { capture: true });
      window.removeEventListener("pointerdown", track, { capture: true });
    };
  }, []);
  return pointer;
};

// After a drag the browser still sends a click to where it ended; that click must not change the selection.
// Set when a drag ends and cleared by the next press, so only the click that ends a drag is skipped.
let dragJustEnded = false;

// What a dragged handle turns into, given how far the pointer moved and where it is now.
const handleOps = (screen: Screen, handle: Handle, delta: Point, pointer: Point): Op[] => {
  const along = handle.kind === "span" ? 0 : handle.axis === "x" ? delta.x : delta.y;
  if (handle.kind === "share") {
    const shares = shareAfterDrag([handle.first.share, handle.second.share], [handle.first.size, handle.second.size], along);
    return weightOps(handle.first.id, handle.second.id, shares);
  }
  if (handle.kind === "track") {
    const tracks = tracksAfterDrag(handle.tracks, handle.index, handle.sizes, along);
    return tracks ? setTracksOps(screen, handle.gridId, handle.axis === "x" ? "columns" : "rows", tracks) : [];
  }
  const track = trackAt(handle.spans, handle.edge === "right" ? pointer.x : pointer.y);
  return [{ op: "place", id: handle.id, area: spanAfterDrag(handle.area, handle.edge, track) }];
};

// What a handle shows while it is dragged: the shares of the two parts, the track sizes, or the cells it spans.
const handleText = (screen: Screen, handle: Handle): string => {
  if (handle.kind === "share") {
    const first = findNode(screen.root, handle.first.id)?.entry?.weight ?? 1;
    const second = findNode(screen.root, handle.second.id)?.entry?.weight ?? 1;
    return `${first} : ${second}`;
  }
  if (handle.kind === "track") {
    const grid = findNode(screen.root, handle.gridId)?.node;
    if (grid?.type !== "container" || grid.layout.kind !== "grid") return "";
    return (handle.axis === "x" ? grid.layout.columns : grid.layout.rows).join(" ");
  }
  const area = findNode(screen.root, handle.id)?.entry?.area;
  return `${area?.colSpan ?? 1} × ${area?.rowSpan ?? 1} cells`;
};

const HANDLE_TITLES: Record<Handle["kind"], string> = {
  share: "Drag to share the room between these two",
  track: "Drag to resize these grid tracks",
  span: "Drag to span more or fewer cells",
};

// The display runtime itself, so the preview is exactly what displays show. Clicking selects the node under the
// pointer. Parts are dragged in from the Add panel or the outline, or moved by dragging the selection box; the
// edges between parts, grid lines and grid cell corners resize; a node on a canvas moves and resizes freely.
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
  const { selection, select, apply, preview, overview, signals, notify } = useEditor();
  const live = useMemo(() => ({ signals: overview.show.signals, store: signals }), [overview.show.signals, signals]);
  const stage = useRef<HTMLDivElement>(null);
  // The screen as it looks during a drag, before the drop turns it into an edit.
  const [dragged, setDragged] = useState<{ screen: Screen; text?: string; at?: Box } | undefined>(undefined);
  const [drop, setDrop] = useState<Drop | undefined>(undefined);
  const dropRef = useRef<Drop | undefined>(undefined);
  const pointerRef = usePointer();
  dropRef.current = drop;

  const shown = dragged?.screen ?? screen;
  const version = `${aspect}|${preview.state}|${preview.themeId}|${preview.variant ?? ""}|${effect}|${versionKey(shown)}`;
  const box = useMeasured(stage, (element) => boxOf(element, readOnly ? undefined : selectorFor(selection)), sameBox, null, `${version}|${selectorFor(selection) ?? ""}`);
  const handles = useMeasured(
    stage,
    (element) => (readOnly ? [] : measureHandles(element, shown, selection)),
    sameHandles,
    [],
    `${version}|${selectorFor(selection) ?? ""}`,
  );

  const location = selection?.kind === "node" ? findNode(screen.root, selection.id) : undefined;
  const onCanvas = !readOnly && location?.parent?.layout.kind === "canvas" && location.entry ? location : undefined;
  const movable = !readOnly && !onCanvas && location?.parent !== undefined && location?.parent !== null;

  const droppable = useDroppable({ id: "preview", disabled: readOnly });
  const source: DragSource | undefined = location && movable ? { kind: "node", id: location.node.id, label: nodeLabel(location.node) } : undefined;
  const draggable = useDraggable({ id: "preview-selection", ...(source ? { data: source } : {}), disabled: !source });

  useDndMonitor({
    onDragMove: (event) => {
      const element = stage.current;
      const pointer = pointerRef.current;
      const from = event.active.data.current as DragSource | undefined;
      const next =
        element && pointer && from && event.over?.id === "preview"
          ? findDrop(element, screen, pointer, from.kind === "node" ? from.id : undefined)
          : undefined;
      setDrop((current) => (current?.label === next?.label && sameBox(current?.mark ?? null, next?.mark ?? null) ? current : next));
    },
    onDragEnd: (event) => {
      dragJustEnded = true;
      const at = dropRef.current;
      setDrop(undefined);
      const from = event.active.data.current as DragSource | undefined;
      if (!at || !from || event.over?.id !== "preview") return;
      if (from.kind === "node") {
        const ops = moveOps(screen, from.id, at.target);
        if (ops === undefined) notify("A container cannot go inside itself", "danger");
        else if (apply(ops)) select({ kind: "node", id: from.id });
        return;
      }
      const node = from.create(takenIds(screen.root));
      if (apply(insertOps(screen, node, at.target))) select({ kind: "node", id: node.id });
    },
    onDragCancel: () => setDrop(undefined),
  });

  // Moving and resizing a node on a canvas, snapping to 1% steps.
  const startCanvasDrag = (corner: DragHandle) => (event: ReactPointerEvent<HTMLElement>) => {
    const element = stage.current;
    const canvas = onCanvas?.parent ? element?.querySelector(`[data-node-id="${CSS.escape(onCanvas.parent.id)}"]`) : null;
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
      last = dragRect(from, corner, (move.clientX - start.x) / bounds.width, (move.clientY - start.y) / bounds.height);
      setDragged({ screen: withRect(screen, id, last) });
    };
    const onUp = (up: PointerEvent) => {
      target.removeEventListener("pointermove", onMove);
      setDragged(undefined);
      if (moved) apply([{ op: "place", id, rect: last }]);
      else if (corner === "move") {
        const under = nodeIdAt(element, up.clientX, up.clientY);
        if (under && under !== id) select({ kind: "node", id: under });
      }
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp, { once: true });
  };

  // Dragging an edge, a grid line or a cell corner: the preview follows the pointer, the release makes one edit.
  const startHandleDrag = (handle: Handle) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    let ops: Op[] = [];

    // On the window: the handle itself moves (and may re-render) while the layout follows the pointer.
    const onMove = (move: PointerEvent) => {
      ops = handleOps(screen, handle, { x: move.clientX - start.x, y: move.clientY - start.y }, { x: move.clientX, y: move.clientY });
      const result = ops.length > 0 ? applyOps(screen, ops, OPTIONS) : undefined;
      if (result?.ok) setDragged({ screen: result.screen, text: handleText(result.screen, handle), at: handle.box });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerup", onUp);
      dragJustEnded = true;
      setDragged(undefined);
      if (ops.length > 0) apply(ops);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div className="preview-area">
      <div
        ref={(element) => {
          stage.current = element;
          droppable.setNodeRef(element);
        }}
        className="preview-stage"
        style={{ aspectRatio: ratio(aspect), ["--stage-ratio" as string]: aspect.replace(":", "/") }}
        data-read-only={readOnly}
        data-drop-over={Boolean(drop)}
        onPointerDownCapture={() => {
          dragJustEnded = false;
        }}
        onClickCapture={(event) => {
          const target = event.target as HTMLElement;
          // The selection box and its tools handle their own clicks.
          if (target.closest(".preview-overlay")) return;
          // Display widgets do nothing in the editor; a click selects, unless it only ends a drag.
          event.preventDefault();
          event.stopPropagation();
          if (dragJustEnded) {
            dragJustEnded = false;
            return;
          }
          if (readOnly) return;
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
          states={overview.show.states}
          live={live}
          scale={overview.show.scale}
          panel={overview.show.panel}
          embedded
          editing={!readOnly}
        />
        <div className="preview-overlay">
          {box ? (
            <div
              ref={draggable.setNodeRef}
              className="selection-box"
              data-canvas={Boolean(onCanvas)}
              data-movable={movable}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
              {...(movable ? draggable.listeners : {})}
              {...(movable ? draggable.attributes : {})}
              aria-label={movable && location ? `Move ${nodeLabel(location.node)}` : undefined}
              {...(onCanvas ? { onPointerDown: startCanvasDrag("move") } : {})}
              onClick={(event) => {
                const element = stage.current;
                if (dragJustEnded) {
                  dragJustEnded = false;
                  return;
                }
                if (!movable || !element) return;
                const under = nodeIdAt(element, event.clientX, event.clientY);
                if (under && under !== location?.node.id) select({ kind: "node", id: under });
              }}
            >
              {onCanvas
                ? CORNERS.map((corner) => (
                    <span key={corner} className="selection-box__handle" data-handle={corner} onPointerDown={startCanvasDrag(corner)} />
                  ))
                : null}
            </div>
          ) : null}
          {drop
            ? null
            : handles.map((handle) => (
                <span
                  key={handle.key}
                  className="resize-handle"
                  data-kind={handle.kind}
                  data-axis={handle.kind === "span" ? (handle.edge === "right" ? "x" : "y") : handle.axis}
                  title={HANDLE_TITLES[handle.kind]}
                  style={{ left: handle.box.left, top: handle.box.top, width: handle.box.width, height: handle.box.height }}
                  onPointerDown={startHandleDrag(handle)}
                />
              ))}
          {dragged?.text && dragged.at ? (
            <span className="resize-readout" style={{ left: dragged.at.left + dragged.at.width / 2, top: dragged.at.top + dragged.at.height / 2 }}>
              {dragged.text}
            </span>
          ) : null}
          {box && !dragged && !drop && !readOnly ? <SelectionTools box={box} width={stage.current?.clientWidth ?? 0} /> : null}
          {drop ? (
            <>
              <div className="drop-into" style={{ left: drop.into.left, top: drop.into.top, width: drop.into.width, height: drop.into.height }}>
                <span className="drop-into__label">{drop.label}</span>
              </div>
              <div
                className="drop-mark"
                data-kind={drop.target.area ? "cell" : drop.target.point ? "spot" : "line"}
                style={{ left: drop.mark.left, top: drop.mark.top, width: drop.mark.width, height: drop.mark.height }}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
