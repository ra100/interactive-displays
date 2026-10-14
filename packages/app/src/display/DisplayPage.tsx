import { IdSchema } from "@interactive-displays/core";
import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ScreenView } from "../runtime/ScreenView.tsx";
import { getOrCreateDisplayId, rememberDisplayId } from "./displayId.ts";
import { StatusMessage } from "./StatusMessage.tsx";
import { useDisplayConnection } from "./useDisplayConnection.ts";
import "./display.css";

const ConnectedDisplay = ({ displayId }: { displayId: string }) => {
  const { status, snapshot, error } = useDisplayConnection(displayId);

  useEffect(() => {
    rememberDisplayId(displayId);
  }, [displayId]);

  if (!snapshot) {
    return error ? (
      <StatusMessage title="DISPLAY ERROR" detail={error} />
    ) : (
      <StatusMessage title="CONNECTING" detail={displayId} />
    );
  }

  return (
    <>
      {snapshot.screen ? (
        <ScreenView screen={snapshot.screen} themeId={snapshot.show.theme.id} />
      ) : (
        <StatusMessage title="NO SCREEN ASSIGNED" detail={`${displayId} · ${snapshot.show.name}`} />
      )}
      {/* The last screen stays up while reconnecting, so a network blip never blanks a display on camera. */}
      {status === "connected" ? null : <div className="connection-badge">RECONNECTING</div>}
      {error && status === "connected" ? <div className="connection-badge">{error}</div> : null}
    </>
  );
};

export const DisplayPage = () => {
  const { displayId = "" } = useParams();

  if (!IdSchema.safeParse(displayId).success) {
    return (
      <StatusMessage
        title="INVALID DISPLAY ID"
        detail="Use lowercase letters, digits, '-' or '_', for example /d/bridge-1"
      />
    );
  }

  // Keyed so switching ids starts a fresh connection and state.
  return <ConnectedDisplay key={displayId} displayId={displayId} />;
};

// /d gives this browser a stable id and moves it to /d/<id>.
export const NewDisplayRedirect = () => <Navigate to={`/d/${getOrCreateDisplayId()}`} replace />;
