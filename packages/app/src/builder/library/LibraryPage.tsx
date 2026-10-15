import type { Screen, ScreenSummary, ShowOverview } from "@interactive-displays/core";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../tools/api.ts";
import { ConfirmDialog } from "../../tools/Dialog.tsx";
import { ScreenThumbnail } from "../../tools/ScreenThumbnail.tsx";
import { ToolGate, type Tools } from "../../tools/ToolGate.tsx";
import { useScreenDocs } from "../../tools/useScreenDocs.ts";
import { useToast } from "../../tools/useToast.tsx";
import { generationBase } from "../generation.ts";
import { publishStatus } from "../publishStatus.ts";
import { GenerateDialog } from "./GenerateDialog.tsx";
import { NewScreenDialog } from "./NewScreenDialog.tsx";
import { SignalsDialog } from "./SignalsDialog.tsx";
import { buildScreen, type NewScreen } from "./templates.ts";
import "./library.css";

const matches = (screen: ScreenSummary, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [screen.name, screen.id, screen.section ?? "", ...screen.tags].some((value) => value.toLowerCase().includes(needle));
};

// Why a screen cannot be deleted, if it cannot: displays fall back to the default screen, so it must stay.
const deleteBlocker = (screen: ScreenSummary, overview: ShowOverview): string | undefined => {
  if (overview.show.defaultScreen === screen.id) return "This is the show's default screen";
  const assigned = overview.displays.filter((display) => display.assigned === screen.id);
  if (assigned.length > 0) return `Assigned to ${assigned.map((display) => display.name ?? display.id).join(", ")}`;
  return undefined;
};

const Library = ({ overview, connection }: Tools) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingSignals, setEditingSignals] = useState(false);
  const [deleting, setDeleting] = useState<ScreenSummary | undefined>(undefined);
  const docFor = useScreenDocs(overview.screens.map((screen) => ({ id: screen.id, revision: screen.revision, source: "draft" })));
  const shown = overview.screens.filter((screen) => matches(screen, query));
  const sections = [...new Set(overview.screens.flatMap((screen) => screen.section ?? []))].sort();
  const live = useMemo(() => ({ signals: overview.show.signals, store: connection.signals }), [overview.show.signals, connection.signals]);

  const create = async (input: NewScreen) => {
    const result = await api("POST", "/api/screens", buildScreen(input));
    if (!result.ok) return result.issues?.[0]?.message ?? result.error;
    navigate(`/builder/${input.id}`);
    return undefined;
  };

  const screenIds = useMemo(() => overview.screens.map((screen) => screen.id), [overview.screens]);
  const base = useMemo(() => generationBase(overview.show, screenIds), [overview.show, screenIds]);

  // Screens of a suite are created in order, so the overview opens in the editor once they all exist.
  const createGenerated = async (screens: Screen[]) => {
    for (const screen of screens) {
      const result = await api("POST", "/api/screens", screen);
      if (!result.ok) return `${screen.name}: ${result.issues?.[0]?.message ?? result.error}`;
    }
    const [first] = screens;
    if (screens.length > 1) toast.show(`Created ${screens.length} linked screens`);
    if (first) navigate(`/builder/${first.id}`);
    return undefined;
  };

  const duplicate = async (screen: ScreenSummary) => {
    const result = await api<{ screen: { id: string; name: string } }>("POST", `/api/screens/${screen.id}/duplicate`, {});
    if (result.ok) toast.show(`Created ${result.data.screen.name}`);
    else toast.show(result.error, "danger");
  };

  const remove = async (screen: ScreenSummary) => {
    const result = await api("DELETE", `/api/screens/${screen.id}`);
    if (result.ok) toast.show(`Deleted ${screen.name}`);
    else toast.show(result.error, "danger");
  };

  return (
    <main className="tool library">
      <header className="library__header">
        <div className="library__title">
          <p className="tool-label">Screens</p>
          <h1>{overview.show.name}</h1>
        </div>
        <Link className="tool-button tool-button--quiet" to="/operator">
          Operator
        </Link>
        <button type="button" className="tool-button" onClick={() => setEditingSignals(true)}>
          Signals
        </button>
        <button type="button" className="tool-button" onClick={() => setGenerating(true)}>
          Generate
        </button>
        <button type="button" className="tool-button tool-button--primary" onClick={() => setCreating(true)}>
          New screen
        </button>
      </header>

      <div className="library__search">
        <input
          className="tool-input"
          type="search"
          placeholder="Search by name, id, section or tag"
          aria-label="Search screens"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="tool-label">
          {shown.length} of {overview.screens.length}
        </span>
      </div>

      <ul className="library__grid">
        {shown.map((screen) => {
          const status = publishStatus(screen);
          const onAir = overview.displays.filter((display) => display.showing === screen.id).length;
          const doc = docFor({ id: screen.id, revision: screen.revision, source: "draft" });
          const blocker = deleteBlocker(screen, overview);
          return (
            <li key={screen.id} className="screen-card">
              <Link className="screen-card__open" to={`/builder/${screen.id}`} aria-label={`Edit ${screen.name}`}>
                {doc ? (
                  <ScreenThumbnail screen={doc} theme={overview.show.theme} states={overview.show.states} live={live} />
                ) : (
                  <div className="screen-card__placeholder" style={{ aspectRatio: screen.profile.aspect.replace(":", " / ") }} />
                )}
              </Link>
              <div className="screen-card__body">
                <h2 className="screen-card__name">{screen.name}</h2>
                <p className="screen-card__meta">
                  {screen.id}
                  {screen.section ? ` · ${screen.section}` : ""} · {screen.profile.aspect}
                </p>
                <div className="screen-card__chips">
                  <span className="tool-chip" data-tone={status.tone}>
                    {status.label}
                  </span>
                  {onAir > 0 ? (
                    <span className="tool-chip" data-tone="info">
                      On {onAir} {onAir === 1 ? "display" : "displays"}
                    </span>
                  ) : null}
                  {screen.tags.map((tag) => (
                    <span key={tag} className="tool-chip">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="screen-card__actions">
                  <Link className="tool-button tool-button--small tool-button--primary" to={`/builder/${screen.id}`}>
                    Edit
                  </Link>
                  <button type="button" className="tool-button tool-button--small" onClick={() => void duplicate(screen)}>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="tool-button tool-button--small tool-button--quiet"
                    disabled={Boolean(blocker)}
                    title={blocker}
                    onClick={() => setDeleting(screen)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="library__empty">No screen matches “{query}”.</p> : null}

      {creating ? (
        <NewScreenDialog
          theme={overview.show.theme}
          takenIds={new Set(overview.screens.map((screen) => screen.id))}
          sections={sections}
          onCreate={create}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {generating ? (
        <GenerateDialog
          theme={overview.show.theme}
          states={overview.show.states}
          base={base}
          takenIds={new Set(screenIds)}
          onCreate={createGenerated}
          onClose={() => setGenerating(false)}
        />
      ) : null}
      {editingSignals ? (
        <SignalsDialog
          signals={overview.show.signals}
          onSave={async (signals) => {
            const result = await api("PUT", "/api/show/signals", { signals });
            if (result.ok) toast.show("Saved signals");
            return result;
          }}
          onClose={() => setEditingSignals(false)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirm="Delete"
          danger
          onConfirm={() => void remove(deleting)}
          onClose={() => setDeleting(undefined)}
        >
          <p>The draft and its history move to the show's trash folder on the server.</p>
        </ConfirmDialog>
      ) : null}
      {toast.element}
    </main>
  );
};

export const LibraryPage = () => <ToolGate role="builder">{(tools) => <Library {...tools} />}</ToolGate>;
