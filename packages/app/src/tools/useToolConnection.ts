import {
  type ClientToServerEvents,
  PROTOCOL_VERSION,
  type ProtocolError,
  type ServerToClientEvents,
  type ShowOverview,
} from "@interactive-displays/core";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { createSignalStore, type SignalStore } from "../runtime/live.ts";
import { readToken } from "./token.ts";

export type ToolSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ToolConnection {
  connected: boolean;
  overview: ShowOverview | null;
  error: ProtocolError | null;
  socket: ToolSocket | null;
  // Shared signal values: the overview's, then every change as it happens.
  signals: SignalStore;
}

// The operator console's and editor's live link: one hello, then the show overview whenever it changes.
// `attempt` reconnects, for example after the crew enters the editor token.
export const useToolConnection = (role: "operator" | "builder", attempt = 0): ToolConnection => {
  const [signals] = useState(() => createSignalStore());
  const [connection, setConnection] = useState<Omit<ToolConnection, "signals">>({
    connected: false,
    overview: null,
    error: null,
    socket: null,
  });

  useEffect(() => {
    const socket: ToolSocket = io();
    setConnection((current) => ({ ...current, socket, error: null }));

    socket.on("connect", () => {
      const token = readToken();
      socket.emit("hello", { role, protocol: PROTOCOL_VERSION, ...(token ? { token } : {}) });
      setConnection((current) => ({ ...current, connected: true }));
    });
    socket.on("disconnect", (reason) => {
      setConnection((current) => ({ ...current, connected: false }));
      if (reason === "io server disconnect") socket.connect();
    });
    socket.on("connect_error", () => setConnection((current) => ({ ...current, connected: false })));
    socket.on("overview", (overview) => {
      signals.replace(overview.signals);
      setConnection((current) => ({ ...current, overview, error: null }));
    });
    socket.on("signals", ({ values }) => signals.merge(values));
    // State changes arrive first as the small event every client gets.
    socket.on("state", ({ state }) =>
      setConnection((current) =>
        current.overview ? { ...current, overview: { ...current.overview, state } } : current,
      ),
    );
    socket.on("error", (error) => setConnection((current) => ({ ...current, error })));

    return () => {
      socket.disconnect();
    };
  }, [role, attempt, signals]);

  return { ...connection, signals };
};
