import {
  type ClientToServerEvents,
  type DisplaySnapshot,
  HelloSchema,
  PROTOCOL_VERSION,
  resolveScreenId,
  type ServerToClientEvents,
} from "@interactive-displays/core";
import type { Server } from "socket.io";
import type { LoadedShow } from "./storage/repository.ts";

interface SocketData {
  displayId?: string;
}

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export const buildSnapshot = ({ show, screens }: LoadedShow, displayId: string): DisplaySnapshot => {
  const definition = show.displays.find((display) => display.id === displayId);
  const screenId = resolveScreenId(show, displayId);
  return {
    protocol: PROTOCOL_VERSION,
    show: { id: show.id, name: show.name, theme: show.theme },
    display: definition?.name ? { id: displayId, name: definition.name } : { id: displayId },
    screen: (screenId && screens.get(screenId)) || null,
  };
};

// Phase 0 is read-only: a display says hello and gets everything it needs in one snapshot.
// Reconnecting is just another hello, so a display never has to catch up on missed events.
export const attachRealtime = (io: RealtimeServer, getShow: () => LoadedShow | null): void => {
  io.on("connection", (socket) => {
    socket.on("hello", (payload) => {
      const hello = HelloSchema.safeParse(payload);
      if (!hello.success) {
        socket.emit("error", { code: "INVALID_HELLO", message: "Hello was not understood by this server" });
        return;
      }

      socket.data.displayId = hello.data.displayId;
      const loaded = getShow();
      if (!loaded) {
        socket.emit("error", { code: "NO_ACTIVE_SHOW", message: "The server has no active show; check its log" });
        return;
      }
      socket.emit("snapshot", buildSnapshot(loaded, hello.data.displayId));
    });
  });
};

export const countDisplays = (io: RealtimeServer): number =>
  [...io.of("/").sockets.values()].filter((socket) => socket.data.displayId !== undefined).length;
