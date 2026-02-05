import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type {
  GlobalState,
  Layout,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./types.js";
import {
  getLayout,
  listLayouts,
  saveLayout,
  ensureDefaultLayout,
} from "./layouts.js";

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
  console.log("Client connected:", socket.id);

  // Send current state immediately
  socket.emit("state", globalState);

  // Client identifies itself with a screen ID
  socket.on("identify", async (screenId) => {
    connectedScreens.set(socket.id, screenId);
    console.log(`Screen identified: ${screenId} (${socket.id})`);
    broadcastScreens();

    // Send default layout on identify
    const layout = await getLayout("default");
    if (layout) {
      socket.emit("layout", layout);
    }
  });

  // Operator changes global state
  socket.on("stateChange", (newState) => {
    globalState = newState;
    console.log(`State changed to: ${newState}`);
    io.emit("state", globalState);
  });

  // Builder requests a specific layout
  socket.on("getLayout", async (layoutId) => {
    const layout = await getLayout(layoutId);
    if (layout) {
      socket.emit("layout", layout);
    }
  });

  // Builder saves a layout
  socket.on("saveLayout", async (layout) => {
    const saved = await saveLayout(layout);
    console.log(`Layout saved: ${saved.id}`);
    // Broadcast to all clients so displays update
    io.emit("layout", saved);
  });

  socket.on("disconnect", () => {
    connectedScreens.delete(socket.id);
    console.log("Client disconnected:", socket.id);
    broadcastScreens();
  });
});

// HTTP routes
fastify.get("/api/layouts", async () => {
  return listLayouts();
});

fastify.get<{ Params: { id: string } }>("/api/layouts/:id", async (request, reply) => {
  const layout = await getLayout(request.params.id);
  if (!layout) {
    return reply.status(404).send({ error: "Layout not found" });
  }
  return layout;
});

fastify.post<{ Body: Layout }>("/api/layouts", async (request) => {
  return saveLayout(request.body);
});

// Health check
fastify.get("/health", async () => {
  return { status: "ok", connectedScreens: connectedScreens.size };
});

// Start server
const start = async () => {
  await ensureDefaultLayout();
  const port = Number(process.env["PORT"]) || 3000;
  await fastify.listen({ port, host: "0.0.0.0" });
  console.log(`Server listening on port ${port}`);
};

start();
