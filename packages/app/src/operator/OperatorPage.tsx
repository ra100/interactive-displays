import type { DisplayStatus, ShowOverview, VideoCommand } from "@interactive-displays/core";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type ApiResult } from "../tools/api.ts";
import { QrCode } from "../tools/QrCode.tsx";
import { ToolGate, type Tools } from "../tools/ToolGate.tsx";
import { type ScreenRef, useScreenDocs } from "../tools/useScreenDocs.ts";
import { publicOrigin } from "../tools/useSession.ts";
import { useToast } from "../tools/useToast.tsx";
import { DisplayCard } from "./DisplayCard.tsx";
import { LookPicker } from "./LookPicker.tsx";
import { ShowSwitches } from "./ShowSwitches.tsx";
import { SignalControls } from "./SignalControls.tsx";
import { StateButtons } from "./StateButtons.tsx";
import "./operator.css";

// What a display shows right now: the draft it previews, or the published copy of its screen.
const shownRef = (display: DisplayStatus, overview: ShowOverview): ScreenRef | undefined => {
  if (display.preview) {
    const draft = overview.screens.find((screen) => screen.id === display.preview);
    return draft ? { id: draft.id, revision: draft.revision, source: "draft" } : undefined;
  }
  const screen = overview.screens.find((entry) => entry.id === display.showing);
  return screen && screen.published !== null
    ? { id: screen.id, revision: screen.published, source: "published" }
    : undefined;
};

const OperatorConsole = ({ overview, connection, session }: Tools) => {
  const toast = useToast();
  const refs = overview.displays.flatMap((display) => shownRef(display, overview) ?? []);
  const screenFor = useScreenDocs(refs);
  const origin = publicOrigin(session);
  const connectedCount = overview.displays.filter((display) => display.connected).length;
  // Thumbnails show shared values as they move, like the displays themselves.
  const live = useMemo(() => ({ signals: overview.show.signals, store: connection.signals }), [overview.show.signals, connection.signals]);

  const run = async (action: Promise<ApiResult<unknown>>, done?: string) => {
    const result = await action;
    if (!result.ok) toast.show(result.error, "danger");
    else if (done) toast.show(done);
  };

  const actionsFor = (display: DisplayStatus) => {
    const path = `/api/displays/${display.id}`;
    return {
      assign: (screen: string | null) => void run(api("PUT", path, { screen })),
      rename: (name: string | null) => void run(api("PUT", path, { name })),
      resize: (scale: number | null) => void run(api("PUT", path, { scale })),
      identify: () => void run(api("POST", `${path}/identify`)),
      reload: () => void run(api("POST", `${path}/reload`), `Reloading ${display.name ?? display.id}`),
      endPreview: () => void run(api("DELETE", `${path}/preview`)),
      forget: () => void run(api("DELETE", path)),
      video: (target: string, command: VideoCommand) => void run(api("POST", `${path}/video`, { target, command })),
    };
  };

  return (
    <main className="tool operator">
      <header className="operator__header">
        <div className="operator__title">
          <p className="tool-label">Operator</p>
          <h1>{overview.show.name}</h1>
        </div>
        <span className="tool-chip" data-tone={connection.connected ? "success" : "danger"}>
          <span className="tool-dot" data-on={connection.connected} aria-hidden="true" />
          {connection.connected ? "Live" : "Offline"}
        </span>
        <Link className="tool-button tool-button--quiet tool-button--small" to="/builder">
          Editor
        </Link>
      </header>

      <div className="operator__layout">
        <div className="operator__controls">
          <section className="operator__section" aria-labelledby="states-title">
            <h2 id="states-title" className="tool-label">
              Show state
            </h2>
            <StateButtons overview={overview} onSet={(state) => void run(api("POST", "/api/state", { state }))} />
          </section>

          <section className="operator__section" aria-labelledby="values-title">
            <h2 id="values-title" className="tool-label">
              Live values
            </h2>
            <SignalControls
              signals={overview.show.signals}
              store={connection.signals}
              onSet={(id, change) => void run(api("PUT", `/api/signals/${id}/value`, change))}
            />
          </section>

          <section className="operator__section" aria-labelledby="look-title">
            <h2 id="look-title" className="tool-label">
              Look
            </h2>
            <LookPicker
              theme={overview.show.theme}
              scale={overview.show.scale}
              onChange={(theme) => void run(api("PUT", "/api/show/theme", theme))}
              onScale={(scale) => void run(api("PUT", "/api/show/scale", { scale }))}
            />
          </section>

          <section className="operator__section" aria-labelledby="switches-title">
            <h2 id="switches-title" className="tool-label">
              Display controls
            </h2>
            <ShowSwitches
              settings={overview.show.settings}
              onChange={(patch) => void run(api("PUT", "/api/show/settings", patch))}
            />
          </section>
        </div>

        <section className="operator__displays" aria-labelledby="displays-title">
          <h2 id="displays-title" className="tool-label">
            Displays · {connectedCount} of {overview.displays.length} connected
          </h2>
          <ul className="display-list">
            {overview.displays.map((display) => (
              <DisplayCard
                key={display.id}
                display={display}
                overview={overview}
                screen={screenFor(shownRef(display, overview))}
                url={`${origin}/d/${display.id}`}
                live={live}
                actions={actionsFor(display)}
              />
            ))}
          </ul>

          <details className="operator__join">
            <summary className="tool-button">Add a display</summary>
            <p>
              Open this address on the new screen, or scan the code with a tablet. It gets its own id and appears in
              the list above, ready to be named and assigned.
            </p>
            <QrCode value={`${origin}/d`} label="a new display" />
          </details>
        </section>
      </div>
      {toast.element}
    </main>
  );
};

export const OperatorPage = () => <ToolGate role="operator">{(tools) => <OperatorConsole {...tools} />}</ToolGate>;
