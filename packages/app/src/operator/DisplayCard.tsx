import type { DisplayStatus, Screen, ShowOverview, VideoCommand } from "@interactive-displays/core";
import { type FormEvent, useState } from "react";
import type { Live } from "../runtime/live.ts";
import { QrCode } from "../tools/QrCode.tsx";
import { ScreenThumbnail } from "../tools/ScreenThumbnail.tsx";
import { timeAgo } from "../tools/timeAgo.ts";

export interface DisplayActions {
  assign: (screenId: string | null) => void;
  rename: (name: string | null) => void;
  identify: () => void;
  reload: () => void;
  endPreview: () => void;
  forget: () => void;
  video: (target: string, command: VideoCommand) => void;
}

const TRANSPORT: Array<{ command: VideoCommand; label: string }> = [
  { command: "play", label: "Play" },
  { command: "pause", label: "Pause" },
  { command: "restart", label: "Restart" },
];

export const DisplayCard = ({
  display,
  overview,
  screen,
  url,
  live,
  actions,
}: {
  display: DisplayStatus;
  overview: ShowOverview;
  // What the display shows right now (its published screen, or the draft it previews).
  screen: Screen | undefined;
  url: string;
  live: Pick<Live, "signals" | "store">;
  actions: DisplayActions;
}) => {
  const [qr, setQr] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(display.name ?? "");
  const effect = overview.show.states.find((state) => state.id === overview.state)?.effect ?? "none";
  const screenName = (id: string | null) => overview.screens.find((entry) => entry.id === id)?.name ?? id;
  const defaultName = screenName(overview.show.defaultScreen ?? null);
  const title = display.name ?? display.id;

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    actions.rename(name.trim() || null);
    setRenaming(false);
  };

  return (
    <li className="display-card" data-connected={display.connected} aria-label={title}>
      <div className="display-card__top">
        <div className="display-card__preview">
          {screen ? (
            <ScreenThumbnail
              screen={screen}
              theme={overview.show.theme}
              state={overview.state}
              effect={effect}
              states={overview.show.states}
              live={live}
            />
          ) : (
            <div className="display-card__empty">{display.showing ? "Not published" : "No screen"}</div>
          )}
        </div>
        <div className="display-card__heading">
          <h3 className="display-card__name">
            <span className="tool-dot" data-on={display.connected} aria-hidden="true" /> {title}
          </h3>
          <p className="display-card__meta">
            {display.id} ·{" "}
            {display.connected ? "connected" : display.lastSeen ? `seen ${timeAgo(display.lastSeen)}` : "never connected"}
          </p>
          {display.preview ? (
            <span className="tool-chip" data-tone="warning">
              Draft preview
            </span>
          ) : null}
          {display.navigated && !display.preview ? (
            <span className="tool-chip" data-tone="info">
              On {screenName(display.navigated)}
            </span>
          ) : null}
          {display.connected ? null : (
            <button className="tool-button tool-button--quiet tool-button--small" type="button" onClick={actions.forget}>
              Forget
            </button>
          )}
        </div>
      </div>
      <div className="display-card__body">
        {renaming ? (
          <form className="display-card__rename" onSubmit={saveName}>
            <input
              className="tool-input"
              aria-label={`Name for ${display.id}`}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            <button className="tool-button tool-button--primary" type="submit">
              Save
            </button>
            <button className="tool-button" type="button" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : null}

        <label className="display-card__assign">
          <span className="tool-label">Screen</span>
          <select
            className="tool-select"
            value={display.assigned ?? ""}
            onChange={(event) => actions.assign(event.target.value || null)}
          >
            <option value="">Show default{defaultName ? ` (${defaultName})` : ""}</option>
            {overview.screens.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.published === null ? " (not published)" : ""}
              </option>
            ))}
          </select>
        </label>

        {display.preview ? (
          <p className="display-card__note">
            Showing the draft of {screenName(display.preview)} from the editor.{" "}
            <button className="tool-button tool-button--small" type="button" onClick={actions.endPreview}>
              End preview
            </button>
          </p>
        ) : null}

        {display.navigated && !display.preview ? (
          <p className="display-card__note">
            A button on the display moved it to {screenName(display.navigated)}.{" "}
            <button
              className="tool-button tool-button--small"
              type="button"
              onClick={() => actions.assign(display.assigned ?? null)}
            >
              Send back
            </button>
          </p>
        ) : null}

        {display.videos.map((target) => (
          <div key={target} className="display-card__video" role="group" aria-label={`Video ${target}`}>
            <span className="tool-label">Video · {target}</span>
            <div className="display-card__transport">
              {TRANSPORT.map(({ command, label }) => (
                <button
                  key={command}
                  className="tool-button"
                  type="button"
                  disabled={!display.connected}
                  onClick={() => actions.video(target, command)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="display-card__actions">
          <button className="tool-button" type="button" onClick={actions.identify} disabled={!display.connected}>
            Identify
          </button>
          <button className="tool-button" type="button" onClick={actions.reload} disabled={!display.connected}>
            Reload
          </button>
          <button
            className="tool-button"
            type="button"
            aria-expanded={renaming}
            onClick={() => {
              setName(display.name ?? "");
              setRenaming((open) => !open);
            }}
          >
            Rename
          </button>
          <button className="tool-button" type="button" aria-expanded={qr} onClick={() => setQr((open) => !open)}>
            QR
          </button>
        </div>
        {qr ? <QrCode value={url} label={title} /> : null}
      </div>
    </li>
  );
};
