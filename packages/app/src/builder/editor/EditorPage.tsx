import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  type AssetInfo,
  findNode,
  findState,
  type Op,
  type Profile,
  ProfileSchema,
  randomSeed,
  regenerateScreenOps,
  sectionOfScreen,
  type Screen,
  takenIds,
} from "@interactive-displays/core";
import { getThemeManifest, themeManifests } from "@interactive-displays/themes/manifest";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatusMessage } from "../../display/StatusMessage.tsx";
import { api } from "../../tools/api.ts";
import { ConfirmDialog } from "../../tools/Dialog.tsx";
import { ToolGate, type Tools } from "../../tools/ToolGate.tsx";
import { useToast } from "../../tools/useToast.tsx";
import { generationBase } from "../generation.ts";
import { usePacks } from "../usePacks.ts";
import { publishStatus } from "../publishStatus.ts";
import { AddPanel } from "./AddPanel.tsx";
import type { DragSource } from "./dragSource.ts";
import { clampRect, duplicateOps, insertOps, moveOps, removeOps, type Selection, shiftOps, type Target } from "./editing.ts";
import { type EditorContextValue, EditorProvider } from "./EditorContext.ts";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { Inspector } from "./Inspector.tsx";
import { LintList } from "./LintList.tsx";
import { Outline } from "./Outline.tsx";
import { Preview } from "./Preview.tsx";
import { ScreenSettings } from "./ScreenSettings.tsx";
import { SendDialog } from "./SendDialog.tsx";
import { useScreenEditor } from "./useScreenEditor.ts";
import "./editor.css";

const ASPECTS = ProfileSchema.shape.aspect.unwrap().options;

// Drop on the gap under the pointer, or the nearest gap above or below it, so dropping on a row works too.
const nearestGap: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) return within;
  const pointer = args.pointerCoordinates;
  if (!pointer) return [];
  let best: { container: (typeof args.droppableContainers)[number]; distance: number } | undefined;
  for (const container of args.droppableContainers) {
    const rect = args.droppableRects.get(container.id);
    if (!rect || pointer.x < rect.left - 24 || pointer.x > rect.left + rect.width + 24) continue;
    const distance = Math.abs(pointer.y - (rect.top + rect.height / 2));
    if (distance < 24 && (!best || distance < best.distance)) best = { container, distance };
  }
  return best ? [{ id: best.container.id, data: { droppableContainer: best.container, value: best.distance } }] : [];
};

// The outline scrolls while dragging, so drop zones are measured continuously.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };
// Only the outer tenth of the outline scrolls it, so dropping near its bottom does not run away.
const AUTO_SCROLL = { threshold: { x: 0, y: 0.1 } };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));

type RightTab = "inspect" | "screen" | "history";

const RIGHT_TABS: Record<RightTab, string> = { inspect: "Selection", screen: "Screen", history: "History" };

const Editor = ({ overview, connection, screenId }: Tools & { screenId: string }) => {
  const toast = useToast();
  const notify = toast.show;
  const editor = useScreenEditor(screenId, connection.socket, (message) => notify(message, "danger"));
  const packs = usePacks();
  const show = overview.show;
  const summary = overview.screens.find((screen) => screen.id === screenId);
  const liveEdit = show.settings.liveEdit;

  const [selection, setSelection] = useState<Selection>(null);
  const [previewState, setPreviewState] = useState(show.states[0]?.id ?? "normal");
  const [themeId, setThemeId] = useState(show.theme.id);
  const [variant, setVariant] = useState<string | undefined>(show.theme.variant);
  const [aspect, setAspect] = useState<Profile["aspect"] | undefined>(undefined);
  const [tab, setTab] = useState<RightTab>("inspect");
  const [viewing, setViewing] = useState<Screen | undefined>(undefined);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [dialog, setDialog] = useState<"send" | "publish" | "live" | undefined>(undefined);
  const [dragging, setDragging] = useState<DragSource | undefined>(undefined);

  const refreshAssets = useCallback(() => {
    void api<{ assets: AssetInfo[] }>("GET", "/api/assets").then((result) => result.ok && setAssets(result.data.assets));
  }, []);
  useEffect(refreshAssets, [refreshAssets]);

  useEffect(() => {
    if (editor.screen) document.title = `${editor.screen.name} · Editor`;
  }, [editor.screen?.name]);

  const screen = editor.screen;
  // A selection whose node was removed (undo, someone else's edit) is dropped.
  const current: Selection =
    screen && selection?.kind === "node" && !findNode(screen.root, selection.id)
      ? null
      : screen && selection?.kind === "slot" && !findNode(screen.root, selection.frameId)
        ? null
        : selection;

  const select = useCallback((next: Selection) => {
    setSelection(next);
    if (next) setTab("inspect");
  }, []);

  const { apply } = editor;
  const context: EditorContextValue | undefined = useMemo(
    () =>
      screen
        ? {
            overview,
            screen,
            selection: current,
            select,
            apply,
            preview: { state: previewState, themeId, variant },
            assets,
            refreshAssets,
            signals: connection.signals,
            notify,
          }
        : undefined,
    [overview, screen, current, select, apply, previewState, themeId, variant, assets, refreshAssets, connection.signals, notify],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (event: DragStartEvent) => setDragging(event.active.data.current as DragSource | undefined);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(undefined);
    const source = active.data.current as DragSource | undefined;
    const target = over?.data.current?.["target"] as Target | undefined;
    if (!screen || !source || !target) return;
    if (source.kind === "node") {
      const ops = moveOps(screen, source.id, target);
      if (ops === undefined) notify("A container cannot go inside itself", "danger");
      else if (apply(ops)) select({ kind: "node", id: source.id });
      return;
    }
    const node = source.create(takenIds(screen.root));
    if (apply(insertOps(screen, node, target))) select({ kind: "node", id: node.id });
  };

  // Keyboard shortcuts for the selection and history; typing in a field and open dialogs are left alone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!screen || viewing || isTyping(event.target) || document.querySelector("[role='dialog']")) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const run = (ops: Op[] | undefined) => {
        event.preventDefault();
        if (ops) apply(ops);
      };
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        editor.redo();
        return;
      }
      if (key === "escape") {
        const location = current?.kind === "node" ? findNode(screen.root, current.id) : undefined;
        select(location?.parent ? { kind: "node", id: location.parent.id } : null);
        return;
      }
      if (current?.kind !== "node") return;
      const location = findNode(screen.root, current.id);
      if (!location?.parent) return;
      const id = current.id;
      if (key === "delete" || key === "backspace") {
        run(removeOps(screen, id));
        select({ kind: "node", id: location.parent.id });
      } else if (mod && key === "d") {
        const copy = duplicateOps(screen, id);
        run(copy?.ops);
        if (copy) select({ kind: "node", id: copy.id });
      } else if (event.altKey && (key === "arrowup" || key === "arrowdown")) {
        run(shiftOps(screen, id, key === "arrowup" ? -1 : 1));
      } else if (location.parent.layout.kind === "canvas" && location.entry?.rect && key.startsWith("arrow")) {
        const step = event.shiftKey ? 0.05 : 0.01;
        const { rect } = location.entry;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        run([{ op: "place", id, rect: clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }) }]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (editor.status === "loading") return <StatusMessage title="LOADING" />;
  if (editor.status === "missing") return <StatusMessage title="NOT FOUND" detail={`There is no screen "${screenId}"`} />;
  if (editor.status === "deleted" || !screen || !context) {
    return (
      <main className="tool tool--centered">
        <div className="token-prompt">
          <h1 className="token-prompt__title">This screen was deleted</h1>
          <Link className="tool-button tool-button--primary" to="/builder">
            Back to screens
          </Link>
        </div>
      </main>
    );
  }

  const status = publishStatus({ revision: editor.savedRevision ?? screen.revision, published: summary?.published ?? null });
  const onAir = overview.displays.filter((display) => display.showing === screenId);
  const effect = findState(show, previewState)?.effect ?? "none";
  const theme = getThemeManifest(themeId);
  const saveLabel = editor.offline ? "Offline, retrying" : editor.saving ? "Saving…" : "Saved";

  const publish = async () => {
    const saved = await editor.settled();
    if (!saved) return;
    const result = await api<{ onAir: string[] }>("POST", `/api/screens/${screenId}/publish`, { revision: saved.revision });
    if (!result.ok) return notify(result.error, "danger");
    const count = result.data.onAir.length;
    notify(`Published revision ${saved.revision}${count > 0 ? ` to ${count} ${count === 1 ? "display" : "displays"}` : ""}`);
  };

  const restore = async (revision: number) => {
    const saved = await editor.settled();
    if (!saved) return;
    const result = await api<{ screen: Screen }>("POST", `/api/screens/${screenId}/revert`, { baseRevision: saved.revision, revision });
    if (!result.ok) return notify(result.error, "danger");
    editor.replace(result.data.screen);
    setViewing(undefined);
    notify(`Restored revision ${revision} as revision ${result.data.screen.revision}`);
  };

  const section = sectionOfScreen(packs, screen);
  const regenerateScreen = () => {
    const ops = regenerateScreenOps(screen, packs, generationBase(show, overview.screens.map((each) => each.id)), randomSeed());
    if (ops && apply(ops)) notify("Regenerated everything that is not locked; Undo brings the old screen back");
  };

  const setLiveEdit = async (on: boolean) => {
    const result = await api("PUT", "/api/show/settings", { liveEdit: on });
    if (!result.ok) notify(result.error, "danger");
  };

  return (
    <EditorProvider value={context}>
      <main className="tool editor">
        <header className="editor__bar">
          <Link className="tool-button tool-button--quiet tool-button--small" to="/builder" aria-label="Back to screens">
            ← Screens
          </Link>
          <div className="editor__name">
            <h1>{screen.name}</h1>
            <span className="editor__saved" data-offline={editor.offline} role="status">
              {saveLabel}
            </span>
          </div>
          {liveEdit ? (
            <span className="tool-chip" data-tone="danger">
              Live edit: changes go on air at once
            </span>
          ) : (
            <span className="tool-chip" data-tone={status.tone}>
              {status.label}
            </span>
          )}
          <div className="editor__history">
            <button type="button" className="tool-button tool-button--small" disabled={!editor.canUndo} onClick={editor.undo} title="Undo (Ctrl+Z)">
              Undo
            </button>
            <button type="button" className="tool-button tool-button--small" disabled={!editor.canRedo} onClick={editor.redo} title="Redo (Ctrl+Shift+Z)">
              Redo
            </button>
          </div>
          {section ? (
            <button
              type="button"
              className="tool-button tool-button--small"
              onClick={regenerateScreen}
              title={`New ${section.recipe.label} content for everything that is not locked`}
            >
              Regenerate
            </button>
          ) : null}
          <span className="editor__spacer" />
          <label className="switch" title="Rehearsal mode: every edit to any screen goes on air at once">
            <input
              type="checkbox"
              role="switch"
              checked={liveEdit}
              onChange={(event) => (event.target.checked ? setDialog("live") : void setLiveEdit(false))}
            />
            Live edit
          </label>
          <button type="button" className="tool-button tool-button--small" onClick={() => setDialog("send")}>
            Send to display
          </button>
          {liveEdit ? null : (
            <button
              type="button"
              className="tool-button tool-button--primary"
              disabled={!status.changed || editor.saving}
              onClick={() => (onAir.length > 0 ? setDialog("publish") : void publish())}
            >
              Publish
            </button>
          )}
        </header>

        <div className="editor__body">
          <DndContext
            sensors={sensors}
            collisionDetection={nearestGap}
            measuring={MEASURING}
            autoScroll={AUTO_SCROLL}
            onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(undefined)}>
            <aside className="editor__left">
              <AddPanel />
              <section className="editor-panel outline-panel" aria-label="Outline panel">
                <h2 className="tool-label editor-panel__title">Outline</h2>
                <div className="editor-panel__body">
                  <Outline />
                </div>
                <p className="editor-panel__hint">Drag to move · Del delete · Ctrl+D duplicate · Esc parent</p>
              </section>
            </aside>
            <DragOverlay dropAnimation={null}>{dragging ? <div className="drag-chip">{dragging.label}</div> : null}</DragOverlay>
          </DndContext>

          <section className="editor__center" aria-label="Preview">
            <div className="preview-controls">
              <div className="segmented" role="radiogroup" aria-label="Preview aspect">
                {ASPECTS.map((each) => (
                  <button
                    key={each}
                    type="button"
                    role="radio"
                    aria-checked={(aspect ?? screen.profile.aspect) === each}
                    onClick={() => setAspect(each === screen.profile.aspect ? undefined : each)}
                  >
                    {each}
                  </button>
                ))}
              </div>
              <label className="preview-controls__field">
                State
                <select className="tool-select" value={previewState} onChange={(event) => setPreviewState(event.target.value)}>
                  {show.states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="preview-controls__field">
                Theme
                <select
                  className="tool-select"
                  value={themeId}
                  onChange={(event) => {
                    setThemeId(event.target.value);
                    setVariant(undefined);
                  }}
                >
                  {[...themeManifests.values()].map((each) => (
                    <option key={each.id} value={each.id}>
                      {each.name}
                    </option>
                  ))}
                </select>
              </label>
              {Object.keys(theme.variants).length > 0 ? (
                <label className="preview-controls__field">
                  Variant
                  <select className="tool-select" value={variant ?? ""} onChange={(event) => setVariant(event.target.value || undefined)}>
                    <option value="">Standard</option>
                    {Object.entries(theme.variants).map(([id, each]) => (
                      <option key={id} value={id}>
                        {each.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {viewing ? (
              <div className="viewing-banner" role="status">
                Viewing revision {viewing.revision} (read only)
                <button type="button" className="tool-button tool-button--small" onClick={() => setViewing(undefined)}>
                  Back to the draft
                </button>
              </div>
            ) : null}
            <Preview screen={viewing ?? screen} aspect={aspect ?? screen.profile.aspect} effect={effect} readOnly={Boolean(viewing)} />
          </section>

          <aside className="editor__right">
            <div className="tabs" role="tablist">
              {(Object.keys(RIGHT_TABS) as RightTab[]).map((each) => (
                <button key={each} type="button" role="tab" className="tab" aria-selected={tab === each} onClick={() => setTab(each)}>
                  {RIGHT_TABS[each]}
                </button>
              ))}
            </div>
            <div className="editor-panel__body editor__inspector" role="tabpanel" aria-label={RIGHT_TABS[tab]}>
              {tab === "inspect" ? <Inspector /> : null}
              {tab === "screen" ? <ScreenSettings /> : null}
              {tab === "history" ? (
                <HistoryPanel
                  screenId={screenId}
                  savedRevision={editor.savedRevision}
                  published={summary?.published ?? null}
                  viewing={viewing?.revision}
                  onView={setViewing}
                  onRestore={(revision) => void restore(revision)}
                />
              ) : null}
            </div>
            <LintList />
          </aside>
        </div>

        {dialog === "send" ? <SendDialog overview={overview} screenId={screenId} onDone={notify} onClose={() => setDialog(undefined)} /> : null}
        {dialog === "publish" ? (
          <ConfirmDialog title={`Publish ${screen.name}?`} confirm="Publish" onConfirm={() => void publish()} onClose={() => setDialog(undefined)}>
            <p>It goes on air at once on {onAir.map((display) => display.name ?? display.id).join(", ")}.</p>
          </ConfirmDialog>
        ) : null}
        {dialog === "live" ? (
          <ConfirmDialog title="Turn on live edit?" confirm="Go live" danger onConfirm={() => void setLiveEdit(true)} onClose={() => setDialog(undefined)}>
            <p>For rehearsals: every edit to any screen in this show goes on air at once, without Publish.</p>
          </ConfirmDialog>
        ) : null}
        {toast.element}
      </main>
    </EditorProvider>
  );
};

export const EditorPage = () => {
  const { screenId = "" } = useParams();
  return <ToolGate role="builder">{(tools) => <Editor key={screenId} {...tools} screenId={screenId} />}</ToolGate>;
};
