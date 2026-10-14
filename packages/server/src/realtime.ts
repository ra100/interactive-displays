import {
  type ClientToServerEvents,
  type DisplaySnapshot,
  HelloSchema,
  PROTOCOL_VERSION,
  resolveScreenId,
  type ServerToClientEvents,
} from "@interactive-displays/core";
import type { Server, Socket } from "socket.io";
import type { ShowService } from "./showService.ts";
import type { LoadedShow } from "./storage/repository.ts";

interface SocketData {
  displayId?: string;
}

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type DisplaySocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const room = (displayId: string) => `display:${displayId}`;

export const buildSnapshot = ({ show, screens }: LoadedShow, state: string, displayId: string): DisplaySnapshot => {
  const definition = show.displays.find((display) => display.id === displayId);
  const screenId = resolveScreenId(show, displayId);
  return {
    protocol: PROTOCOL_VERSION,
    show: { id: show.id, name: show.name, theme: show.theme, states: show.states },
    state,
    display: definition?.name ? { id: displayId, name: definition.name } : { id: displayId },
    screen: (screenId && screens.get(screenId)) || null,
  };
};

const displaySockets = (io: RealtimeServer): DisplaySocket[] =>
  [...io.of("/").sockets.values()].filter((socket) => socket.data.displayId !== undefined);

// A display says hello and gets everything it needs in one snapshot; reconnecting is just another hello.
// Afterwards it receives a new snapshot whenever its screen or assignment changes, and small events for
// show-wide state changes, which must reach every display within 100 ms.
export const attachRealtime = (io: RealtimeServer, service: ShowService): void => {
  const sendSnapshot = (socket: DisplaySocket) => {
    const loaded = service.loaded();
    const displayId = socket.data.displayId;
    if (!loaded || !displayId) return;
    socket.emit("snapshot", buildSnapshot(loaded, service.state(), displayId));
  };

  io.on("connection", (socket) => {
    socket.on("hello", (payload) => {
      const hello = HelloSchema.safeParse(payload);
      if (!hello.success) {
        socket.emit("error", { code: "INVALID_HELLO", message: "Hello was not understood by this server" });
        return;
      }

      const { displayId } = hello.data;
      if (socket.data.displayId && socket.data.displayId !== displayId) void socket.leave(room(socket.data.displayId));
      socket.data.displayId = displayId;
      void socket.join(room(displayId));

      if (!service.loaded()) {
        socket.emit("error", { code: "NO_ACTIVE_SHOW", message: "The server has no active show; check its log" });
        return;
      }
      service.markSeen(displayId);
      sendSnapshot(socket);
    });
  });

  service.subscribe((event) => {
    const loaded = service.loaded();
    if (!loaded) return;

    switch (event.type) {
      case "state":
        io.emit("state", { state: event.state });
        return;
      case "identify":
        io.to(room(event.displayId)).emit("identify", { label: event.label });
        return;
      case "display":
        for (const socket of displaySockets(io).filter((s) => s.data.displayId === event.displayId)) sendSnapshot(socket);
        return;
      case "screen":
        for (const socket of displaySockets(io)) {
          const displayId = socket.data.displayId;
          if (displayId && resolveScreenId(loaded.show, displayId) === event.screenId) sendSnapshot(socket);
        }
        return;
    }
  });
};

export const connectedDisplayIds = (io: RealtimeServer): Set<string> =>
  new Set(displaySockets(io).flatMap((socket) => (socket.data.displayId ? [socket.data.displayId] : [])));

export const countDisplays = (io: RealtimeServer): number => displaySockets(io).length;
