import {
  type ClientToServerEvents,
  type DisplaySnapshot,
  HelloSchema,
  PressSchema,
  PROTOCOL_VERSION,
  type Role,
  type ScreenUpdate,
  type ServerToClientEvents,
  type ShowOverview,
  type SignalValues,
  WatchSchema,
  displayPanel,
  displayScale,
} from "@interactive-displays/core";
import type { Server, Socket } from "socket.io";
import { tokenAccepted } from "./auth.ts";
import { buildOverview } from "./overview.ts";
import type { ShowService } from "./showService.ts";

interface SocketData {
  role?: Role;
  displayId?: string;
  watching?: string;
}

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Rooms keep traffic to the clients that need it: a display hears about its own screen, a builder about the
// screen it edits, operators and builders about the show as a whole.
const displayRoom = (displayId: string) => `display:${displayId}`;
const screenRoom = (screenId: string) => `screen:${screenId}`;
const OVERVIEW_ROOMS = ["operators", "builders"];
// Shared signal changes go out at most this often, merged.
const SIGNALS_EVERY_MS = 100;

export const buildSnapshot = (service: ShowService, displayId: string): DisplaySnapshot | null => {
  const loaded = service.loaded();
  if (!loaded) return null;
  const { show } = loaded;
  const definition = show.displays.find((display) => display.id === displayId);
  const { screen, preview } = service.screenForDisplay(displayId);
  return {
    protocol: PROTOCOL_VERSION,
    show: {
      id: show.id,
      name: show.name,
      theme: show.theme,
      states: show.states,
      signals: show.signals,
      sounds: show.settings.sounds,
      ...(show.soundPack ? { soundPack: show.soundPack } : {}),
    },
    state: service.state(),
    signals: service.signalValues(),
    display: {
      id: displayId,
      ...(definition?.name ? { name: definition.name } : {}),
      scale: displayScale(show, displayId),
      panel: displayPanel(show, displayId),
    },
    screen,
    preview,
    navigated: !preview && service.navigated(displayId) !== null,
  };
};

const screenUpdate = (service: ShowService, screenId: string): ScreenUpdate => {
  const screen = service.loaded()?.screens.get(screenId) ?? null;
  return { screenId, screen, lint: screen ? service.lint(screen) : [] };
};

const displaySockets = (io: RealtimeServer): ClientSocket[] =>
  [...io.of("/").sockets.values()].filter((socket) => socket.data.role === "display");

export const connectedDisplayIds = (io: RealtimeServer): Set<string> =>
  new Set(displaySockets(io).flatMap((socket) => (socket.data.displayId ? [socket.data.displayId] : [])));

export const countDisplays = (io: RealtimeServer): number => displaySockets(io).length;

// A client says hello and gets everything it needs in one message (a display its snapshot, operators and
// builders the show overview); reconnecting is just another hello. Afterwards displays get a new snapshot
// whenever what they show changes, and a small event for show-wide state changes, which must reach every
// display within 100 ms.
export const attachRealtime = (
  io: RealtimeServer,
  service: ShowService,
  { editorToken }: { editorToken?: string | undefined } = {},
): void => {
  const sendSnapshot = (socket: ClientSocket) => {
    const displayId = socket.data.displayId;
    const snapshot = displayId ? buildSnapshot(service, displayId) : null;
    if (snapshot) socket.emit("snapshot", snapshot);
  };

  const snapshotDisplays = (matches: (displayId: string) => boolean) => {
    for (const socket of displaySockets(io)) {
      if (socket.data.displayId && matches(socket.data.displayId)) sendSnapshot(socket);
    }
  };

  const overview = (): ShowOverview | null => buildOverview(service, connectedDisplayIds(io));

  // Several changes in one tick (a publish is a draft and a published change) go out as one overview.
  let overviewQueued = false;
  const queueOverview = () => {
    if (overviewQueued) return;
    overviewQueued = true;
    setImmediate(() => {
      overviewQueued = false;
      const current = overview();
      if (current) io.to(OVERVIEW_ROOMS).emit("overview", current);
    });
  };

  // Signal changes from ticks, sliders and buttons go out together, at most ten times a second.
  let pendingSignals: SignalValues = {};
  let signalsTimer: NodeJS.Timeout | undefined;
  let signalsSentAt = 0;
  const sendSignals = () => {
    signalsTimer = undefined;
    signalsSentAt = Date.now();
    const values = pendingSignals;
    pendingSignals = {};
    io.emit("signals", { values });
  };
  const queueSignals = (values: SignalValues) => {
    pendingSignals = { ...pendingSignals, ...values };
    if (signalsTimer) return;
    signalsTimer = setTimeout(sendSignals, Math.max(0, SIGNALS_EVERY_MS - (Date.now() - signalsSentAt)));
    signalsTimer.unref();
  };

  const welcomeDisplay = (socket: ClientSocket, displayId: string) => {
    if (socket.data.displayId && socket.data.displayId !== displayId) void socket.leave(displayRoom(socket.data.displayId));
    socket.data.displayId = displayId;
    void socket.join(displayRoom(displayId));
    if (!service.loaded()) {
      socket.emit("error", { code: "NO_ACTIVE_SHOW", message: "The server has no active show; check its log" });
      return;
    }
    service.markSeen(displayId);
    sendSnapshot(socket);
    queueOverview();
  };

  const welcomeTool = (socket: ClientSocket, role: "operator" | "builder") => {
    void socket.join(role === "operator" ? "operators" : "builders");
    const current = overview();
    if (current) socket.emit("overview", current);
    else socket.emit("error", { code: "NO_ACTIVE_SHOW", message: "The server has no active show; check its log" });
  };

  io.on("connection", (socket) => {
    socket.on("hello", (payload) => {
      const parsed = HelloSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { code: "INVALID_HELLO", message: "Hello was not understood by this server" });
        return;
      }
      const hello = parsed.data;
      if (hello.role !== "display" && !tokenAccepted(editorToken, hello.token)) {
        socket.emit("error", { code: "UNAUTHORIZED", message: "This server needs the editor token" });
        return;
      }

      socket.data.role = hello.role;
      if (hello.role === "display") welcomeDisplay(socket, hello.displayId);
      else welcomeTool(socket, hello.role);
    });

    // A builder follows the draft of the screen it has open.
    socket.on("watch", (payload) => {
      const watch = WatchSchema.safeParse(payload);
      if (socket.data.role !== "builder" || !watch.success) return;
      if (socket.data.watching) void socket.leave(screenRoom(socket.data.watching));
      const { screenId } = watch.data;
      if (screenId === null) {
        delete socket.data.watching;
        return;
      }
      socket.data.watching = screenId;
      void socket.join(screenRoom(screenId));
      socket.emit("screen", screenUpdate(service, screenId));
    });

    // A display control was used; the server runs the actions that are its to run.
    socket.on("press", (payload) => {
      const press = PressSchema.safeParse(payload);
      const displayId = socket.data.displayId;
      if (socket.data.role !== "display" || !displayId || !press.success) return;
      service.press(displayId, press.data).catch(() => undefined);
    });

    socket.on("disconnect", () => {
      if (socket.data.role === "display") queueOverview();
    });
  });

  service.subscribe((event) => {
    if (!service.loaded()) return;

    switch (event.type) {
      case "state":
        io.emit("state", { state: event.state });
        queueOverview();
        return;
      case "identify":
        io.to(displayRoom(event.displayId)).emit("identify", { label: event.label });
        return;
      case "reload":
        io.to(displayRoom(event.displayId)).emit("reload");
        return;
      case "display":
      case "preview":
        snapshotDisplays((displayId) => displayId === event.displayId);
        queueOverview();
        return;
      case "screen":
        io.to(screenRoom(event.screenId)).emit("screen", screenUpdate(service, event.screenId));
        snapshotDisplays((displayId) => service.previews().get(displayId) === event.screenId);
        queueOverview();
        return;
      case "published":
        snapshotDisplays((displayId) => {
          const { screen, preview } = service.screenForDisplay(displayId);
          return !preview && screen?.id === event.screenId;
        });
        queueOverview();
        return;
      case "deleted":
        io.to(screenRoom(event.screenId)).emit("screen", screenUpdate(service, event.screenId));
        queueOverview();
        return;
      case "show":
        snapshotDisplays(() => true);
        queueOverview();
        return;
      case "signals":
        queueSignals(event.values);
        return;
      case "cue":
        queueOverview();
        return;
      case "video":
        io.to(displayRoom(event.displayId)).emit("video", { target: event.target, command: event.command });
        break;
      case "sound":
        io.to(displayRoom(event.displayId)).emit("sound", { sound: event.sound });
        break;
      case "trigger":
        io.to(displayRoom(event.displayId)).emit("trigger", { nodeId: event.nodeId });
        return;
    }
  });
};
