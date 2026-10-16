import type { ShowOverview } from "@interactive-displays/core";
import { api } from "../../tools/api.ts";
import { Dialog } from "../../tools/Dialog.tsx";

// Shows the draft on one physical display without publishing it, to check it on the real screen.
export const SendDialog = ({
  overview,
  screenId,
  onDone,
  onClose,
}: {
  overview: ShowOverview;
  screenId: string;
  onDone: (message: string, tone?: "info" | "danger") => void;
  onClose: () => void;
}) => {
  const displays = [...overview.displays].sort((a, b) => Number(b.connected) - Number(a.connected));
  const nameOf = (id: string | null) => overview.screens.find((screen) => screen.id === id)?.name ?? id ?? "nothing";

  const run = async (path: string, method: "PUT" | "DELETE", done: string) => {
    const result = await api(method, path, method === "PUT" ? { screen: screenId } : undefined);
    onDone(result.ok ? done : result.error, result.ok ? "info" : "danger");
  };

  return (
    <Dialog title="Send to a display" onClose={onClose}>
      <p className="dialog__body">
        The display shows this draft, with a DRAFT PREVIEW badge, and follows your edits until you end the preview.
        Nothing is published.
      </p>
      {displays.length === 0 ? <p className="panel-empty">No display has connected yet. Open /d on a screen first.</p> : null}
      <ul className="send-list">
        {displays.map((display) => {
          const label = display.name ?? display.id;
          const previewingThis = display.preview === screenId;
          return (
            <li key={display.id} className="send-list__item">
              <span className="tool-dot" data-on={display.connected} aria-hidden="true" />
              <div className="send-list__info">
                <span className="send-list__name">{label}</span>
                <span className="send-list__meta">
                  {display.preview ? `previewing ${nameOf(display.preview)}` : `showing ${nameOf(display.showing)}`}
                  {display.connected ? "" : " · offline"}
                </span>
              </div>
              {previewingThis ? (
                <button
                  type="button"
                  className="tool-button tool-button--small"
                  onClick={() => void run(`/api/displays/${display.id}/preview`, "DELETE", `${label} is back on its screen`)}
                >
                  End preview
                </button>
              ) : (
                <button
                  type="button"
                  className="tool-button tool-button--small tool-button--primary"
                  aria-label={`Preview on ${label}`}
                  onClick={() => void run(`/api/displays/${display.id}/preview`, "PUT", `Previewing on ${label}`)}
                >
                  Preview here
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
};
