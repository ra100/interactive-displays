import {
  type ClientToServerEvents,
  type DisplaySnapshot,
  PROTOCOL_VERSION,
  type ServerToClientEvents,
} from "@interactive-displays/core";
import { io, type Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import { reloadPage } from "./reloadPage.ts";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface DisplayConnection {
  status: ConnectionStatus;
  snapshot: DisplaySnapshot | null;
  error: string | null;
  // The latest identify request; `at` tells repeated requests for the same label apart.
  identify: { label: string; at: number } | null;
}

const RELOAD_KEY = "interactive-displays.protocolReload";

// After a server upgrade the protocol can change: reload once to fetch the matching app bundle.
// The guard stops a reload loop when the server keeps serving an older bundle.
const reloadForProtocol = (serverProtocol: number): boolean => {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === String(serverProtocol)) return false;
    sessionStorage.setItem(RELOAD_KEY, String(serverProtocol));
  } catch {
    return false;
  }
  reloadPage();
  return true;
};

export const useDisplayConnection = (displayId: string): DisplayConnection => {
  const [connection, setConnection] = useState<DisplayConnection>({
    status: "connecting",
    snapshot: null,
    error: null,
    identify: null,
  });

  useEffect(() => {
    // Same origin in production; the Vite dev server proxies /socket.io to the server.
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

    socket.on("connect", () => {
      setConnection((current) => ({ ...current, status: "connected" }));
      socket.emit("hello", { role: "display", displayId, protocol: PROTOCOL_VERSION });
    });

    socket.on("disconnect", (reason) => {
      setConnection((current) => ({ ...current, status: "disconnected" }));
      // Socket.io only auto-reconnects after network loss; a display should also come back
      // after the server deliberately dropped it.
      if (reason === "io server disconnect") socket.connect();
    });

    socket.on("connect_error", () => {
      setConnection((current) => ({ ...current, status: "disconnected" }));
    });

    socket.on("snapshot", (snapshot) => {
      if (snapshot.protocol !== PROTOCOL_VERSION && reloadForProtocol(snapshot.protocol)) return;
      const error =
        snapshot.protocol === PROTOCOL_VERSION
          ? null
          : `This display runs protocol ${PROTOCOL_VERSION}, the server ${snapshot.protocol}. Clear the browser cache.`;
      setConnection((current) => ({ ...current, status: "connected", snapshot, error }));
    });

    // Show-wide state changes arrive as a small event, not a snapshot, to stay inside the 100 ms budget.
    socket.on("state", ({ state }) => {
      setConnection((current) =>
        current.snapshot ? { ...current, snapshot: { ...current.snapshot, state } } : current,
      );
    });

    // The operator's "reload" for a display that misbehaves.
    socket.on("reload", () => {
      reloadPage();
    });

    socket.on("identify", ({ label }) => {
      setConnection((current) => ({ ...current, identify: { label, at: Date.now() } }));
    });

    socket.on("error", (error) => {
      setConnection((current) => ({ ...current, error: error.message }));
    });

    return () => {
      socket.disconnect();
    };
  }, [displayId]);

  return connection;
};
