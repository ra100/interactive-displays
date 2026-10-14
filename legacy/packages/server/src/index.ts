import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type {
  GlobalState,
  Layout,
  ServerToClientEvents,
  ClientToServerEvents,
  VideoCommand,
} from "./types.js";
import { getLayout, saveLayout } from "./layouts.js";
import {
  validateScreenId,
  validateGlobalState,
  validateLayoutId,
  validateVideoCommand,
  validateVideoStateUpdate,
} from "./validation.js";
import { ZodError } from "zod";

const fastify = Fastify({ logger: true });

// CORS configuration
// For local LAN use (video production), permissive CORS is acceptable.
// In production deployments, restrict origins appropriately.
const ALLOWED_ORIGINS =
  process.env["NODE_ENV"] === "production"
    ? (process.env["ALLOWED_ORIGINS"]?.split(",") ?? [])
    : true; // Allow all in development

await fastify.register(cors, { origin: ALLOWED_ORIGINS });

const io = new Server<ClientToServerEvents, ServerToClientEvents>(
  fastify.server,
  {
    cors: { origin: ALLOWED_ORIGINS },
  }
);

// Global state
let globalState: GlobalState = "normal";
let cachedDefaultLayout: Layout | null = null;
const connectedScreens = new Map<string, string>(); // socketId -> screenId

// Socket.io handlers
io.on("connection", (socket) => {
  fastify.log.info(`Client connected: ${socket.id}`);

  // Send current state immediately
  socket.emit("state", globalState);

  // Client identifies itself with a screen ID
  socket.on("identify", async (screenId) => {
    try {
      const validScreenId = validateScreenId(screenId);
      connectedScreens.set(socket.id, validScreenId);
      fastify.log.info(`Screen identified: ${validScreenId} (${socket.id})`);

      // Send default layout (cached)
      if (!cachedDefaultLayout) {
        cachedDefaultLayout = await getLayout("default");
      }
      if (cachedDefaultLayout) {
        socket.emit("layout", cachedDefaultLayout);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid screen ID from ${socket.id}: ${screenId}`);
        socket.emit("error", "INVALID_SCREEN_ID", "Invalid screen ID format");
        return;
      }
      fastify.log.error(`Error handling identify: ${error}`);
      socket.emit("error", "IDENTIFY_FAILED", "Failed to identify screen");
    }
  });

  // Operator changes global state
  socket.on("stateChange", (newState) => {
    try {
      const validState = validateGlobalState(newState);
      globalState = validState;
      fastify.log.info(`State changed to: ${validState}`);
      io.emit("state", globalState);
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid state from ${socket.id}: ${newState}`);
        socket.emit("error", "INVALID_STATE", "Invalid state value");
        return;
      }
      fastify.log.error(`Error handling stateChange: ${error}`);
      socket.emit("error", "STATE_CHANGE_FAILED", "Failed to change state");
    }
  });

  // Builder requests a specific layout
  socket.on("getLayout", async (layoutId) => {
    try {
      const validLayoutId = validateLayoutId(layoutId);
      const layout = await getLayout(validLayoutId);
      if (layout) {
        socket.emit("layout", layout);
      } else {
        socket.emit("error", "LAYOUT_NOT_FOUND", "Layout not found");
      }
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid layout ID from ${socket.id}: ${layoutId}`);
        socket.emit("error", "INVALID_LAYOUT_ID", "Invalid layout ID format");
        return;
      }
      fastify.log.error(`Error handling getLayout: ${error}`);
      socket.emit("error", "GET_LAYOUT_FAILED", "Failed to get layout");
    }
  });

  // Builder saves a layout
  socket.on("saveLayout", async (layout) => {
    try {
      const saved = await saveLayout(layout);
      fastify.log.info(`Layout saved: ${saved.id}`);

      // Invalidate cache if default layout was saved
      if (saved.id === "default") {
        cachedDefaultLayout = saved;
      }

      // Broadcast to all clients so displays update
      io.emit("layout", saved);
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(
          `Invalid layout from ${socket.id}: ${JSON.stringify(error.errors)}`
        );
        socket.emit("error", "INVALID_LAYOUT", "Invalid layout format");
        return;
      }
      fastify.log.error(`Error handling saveLayout: ${error}`);
      socket.emit("error", "SAVE_LAYOUT_FAILED", "Failed to save layout");
    }
  });

  // Video control - operator sends command, broadcast to all displays
  socket.on("videoCommand", (command: unknown) => {
    try {
      const validCommand = validateVideoCommand(command);
      fastify.log.info(
        `Video command: ${validCommand.command} for element ${validCommand.elementId}`
      );
      // Broadcast to all clients (including sender for consistency)
      // Cast needed because Zod's optional inference differs from exactOptionalPropertyTypes
      io.emit("videoCommand", validCommand as VideoCommand);
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid video command from ${socket.id}`);
        socket.emit("error", "INVALID_VIDEO_COMMAND", "Invalid video command format");
        return;
      }
      fastify.log.error(`Error handling videoCommand: ${error}`);
      socket.emit("error", "VIDEO_COMMAND_FAILED", "Failed to process video command");
    }
  });

  // Video state updates - displays report their video state
  socket.on("videoState", (state: unknown) => {
    try {
      const validState = validateVideoStateUpdate(state);
      fastify.log.debug(
        `Video state: ${validState.state} for element ${validState.elementId} at ${validState.currentTime}s`
      );
      // Could track state here for synchronization, but for MVP just log
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid video state from ${socket.id}`);
        // Don't emit error for state updates - they're not critical
        return;
      }
      fastify.log.error(`Error handling videoState: ${error}`);
    }
  });

  socket.on("disconnect", () => {
    connectedScreens.delete(socket.id);
    fastify.log.info(`Client disconnected: ${socket.id}`);
  });
});

// Health check
fastify.get("/health", async () => {
  return { status: "ok", connectedScreens: connectedScreens.size };
});

// Start server
const start = async () => {
  // Pre-load default layout into cache
  cachedDefaultLayout = await getLayout("default");

  const port = Number(process.env["PORT"]) || 3010;
  await fastify.listen({ port, host: "0.0.0.0" });
  fastify.log.info(`Server listening on port ${port}`);
};

start().catch((err) => {
  fastify.log.error({ err }, "Server failed to start");
  process.exit(1);
});
