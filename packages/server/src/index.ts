import Fastify from "fastify";
import { Server } from "socket.io";

const fastify = Fastify({ logger: true });

const io = new Server(fastify.server, {
  cors: { origin: "*" },
});

let globalState: "normal" | "alert" | "active" | "damaged" = "normal";

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.emit("state", globalState);

  socket.on("stateChange", (newState: typeof globalState) => {
    globalState = newState;
    io.emit("state", globalState);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const start = async () => {
  const port = Number(process.env["PORT"]) || 3000;
  await fastify.listen({ port, host: "0.0.0.0" });
  console.log(`Server listening on port ${port}`);
};

start();
