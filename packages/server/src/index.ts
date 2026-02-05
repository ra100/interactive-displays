import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type {
  GlobalState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./types.js";
import {
  getLayout,
  listLayouts,
  saveLayout,
  ensureDefaultLayout,
} from "./layouts.js";
import {
  validateScreenId,
  validateGlobalState,
  validateLayoutId,
  validateLayout,
} from "./validation.js";
import { ZodError } from "zod";

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });

const io = new Server<ClientToServerEvents, ServerToClientEvents>(
  fastify.server,
  {
    cors: { origin: "*" },
  }
);

// Global state
let globalState: GlobalState = "normal";
const connectedScreens = new Map<string, string>(); // socketId -> screenId

// Broadcast connected screens list
function broadcastScreens(): void {
  const screens = Array.from(connectedScreens.values());
  io.emit("connectedScreens", screens);
}

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
      broadcastScreens();

      // Send default layout on identify
      const layout = await getLayout("default");
      if (layout) {
        socket.emit("layout", layout);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid screen ID from ${socket.id}: ${screenId}`);
        return;
      }
      fastify.log.error(`Error handling identify: ${error}`);
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
        return;
      }
      fastify.log.error(`Error handling stateChange: ${error}`);
    }
  });

  // Builder requests a specific layout
  socket.on("getLayout", async (layoutId) => {
    try {
      const validLayoutId = validateLayoutId(layoutId);
      const layout = await getLayout(validLayoutId);
      if (layout) {
        socket.emit("layout", layout);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid layout ID from ${socket.id}: ${layoutId}`);
        return;
      }
      fastify.log.error(`Error handling getLayout: ${error}`);
    }
  });

  // Builder saves a layout
  socket.on("saveLayout", async (layout) => {
    try {
      const saved = await saveLayout(layout);
      fastify.log.info(`Layout saved: ${saved.id}`);
      // Broadcast to all clients so displays update
      io.emit("layout", saved);
    } catch (error) {
      if (error instanceof ZodError) {
        fastify.log.warn(`Invalid layout from ${socket.id}: ${JSON.stringify(error.errors)}`);
        return;
      }
      fastify.log.error(`Error handling saveLayout: ${error}`);
    }
  });

  socket.on("disconnect", () => {
    connectedScreens.delete(socket.id);
    fastify.log.info(`Client disconnected: ${socket.id}`);
    broadcastScreens();
  });
});

// HTTP routes with validation
fastify.get("/api/layouts", async () => {
  return listLayouts();
});

fastify.get<{ Params: { id: string } }>("/api/layouts/:id", async (request, reply) => {
  try {
    const validId = validateLayoutId(request.params.id);
    const layout = await getLayout(validId);
    if (!layout) {
      return reply.status(404).send({ error: "Layout not found" });
    }
    return layout;
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "Invalid layout ID" });
    }
    throw error;
  }
});

fastify.post("/api/layouts", {
  schema: {
    body: {
      type: "object",
      // Fastify schema for initial validation
    },
  },
}, async (request, reply) => {
  try {
    const validated = validateLayout(request.body);
    return await saveLayout(validated);
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "Invalid layout", details: error.errors });
    }
    throw error;
  }
});

// Health check
fastify.get("/health", async () => {
  return { status: "ok", connectedScreens: connectedScreens.size };
});

// Start server
const start = async () => {
  await ensureDefaultLayout();
  const port = Number(process.env["PORT"]) || 3010;
  await fastify.listen({ port, host: "0.0.0.0" });
  fastify.log.info(`Server listening on port ${port}`);
};

start().catch((err) => {
  fastify.log.error("Server failed to start:", err);
  process.exit(1);
});
