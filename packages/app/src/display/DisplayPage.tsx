import { findNode, IdSchema } from "@interactive-displays/core";
import { useEffect, useMemo, useRef } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { runLocal } from "../runtime/live.ts";
import { ScreenView } from "../runtime/ScreenView.tsx";
import { getOrCreateDisplayId, rememberDisplayId } from "./displayId.ts";
import { IdentifyOverlay } from "./IdentifyOverlay.tsx";
import { StatusMessage } from "./StatusMessage.tsx";
import { useDisplayConnection } from "./useDisplayConnection.ts";
import { useKiosk } from "./useKiosk.ts";
import { useSounds } from "./useSounds.ts";
import "./display.css";

// One empty list, so memoised values do not change on every render before the first snapshot.
const NONE: never[] = [];

const ConnectedDisplay = ({ displayId }: { displayId: string }) => {
  const { status, snapshot, error, identify, entered, signals, media, press, onCommand } = useDisplayConnection(displayId);
  // ?theme=base&variant=nemesis previews the show in another look on this display only.
  const [params] = useSearchParams();
  // ?fullscreen goes fullscreen on the first touch.
  useKiosk({ fullscreen: params.has("fullscreen") });
  const themeId = params.get("theme") ?? snapshot?.show.theme.id ?? "base";
  const playSound = useSounds(snapshot?.show.soundPack ?? themeId, snapshot?.show.sounds ?? false, entered, snapshot?.show.states ?? NONE);
  const showSignals = snapshot?.show.signals;
  const live = useMemo(
    () => ({ signals: showSignals ?? NONE, store: signals, media, press, playSound }),
    [showSignals, signals, media, press, playSound],
  );

  useEffect(() => {
    rememberDisplayId(displayId);
  }, [displayId]);

  // A control on another display used one of ours: it flashes and plays its own sounds and videos here.
  const current = useRef({ screen: snapshot?.screen ?? null, live });
  current.current = { screen: snapshot?.screen ?? null, live };
  useEffect(
    () =>
      onCommand((command) => {
        const { screen, live: now } = current.current;
        if (command.type === "sound") {
          now.playSound(command.sound);
          return;
        }
        const node = screen ? findNode(screen.root, command.nodeId)?.node : undefined;
        if (node?.type !== "widget") return;
        now.media.flash(node.id);
        runLocal(now, node);
      }),
    [onCommand],
  );

  if (!snapshot) {
    return error ? (
      <StatusMessage title="DISPLAY ERROR" detail={error} />
    ) : (
      <StatusMessage title="CONNECTING" detail={displayId} />
    );
  }

  // An unknown state (a show edited mid-session) renders as normal rather than failing.
  const effect = snapshot.show.states.find((state) => state.id === snapshot.state)?.effect ?? "none";

  return (
    <>
      {snapshot.screen ? (
        <ScreenView
          screen={snapshot.screen}
          themeId={themeId}
          variant={params.get("variant") ?? snapshot.show.theme.variant}
          state={snapshot.state}
          effect={effect}
          states={snapshot.show.states}
          live={live}
          scale={snapshot.display.scale}
          panel={snapshot.display.panel}
        />
      ) : (
        // The id is big so the operator can read it from across the room and assign a screen to it.
        <StatusMessage title="NO SCREEN ASSIGNED" code={displayId} detail={snapshot.show.name} />
      )}
      <IdentifyOverlay request={identify} />
      {/* Sent from the editor: the crew should know this is not what goes on air. */}
      {snapshot.preview ? <div className="preview-badge">DRAFT PREVIEW</div> : null}
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
