import { existsSync } from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { PROTOCOL_VERSION } from "@interactive-displays/core";
import Fastify, { type FastifyInstance } from "fastify";
import { Server } from "socket.io";
import type { Config } from "./config.ts";
import { SEED_DIR } from "./paths.ts";
import { attachRealtime, countDisplays, type RealtimeServer } from "./realtime.ts";
import { ensureSeeded, loadActiveShow } from "./storage/repository.ts";

const hasFileExtension = (url: string): boolean => path.extname(url.split("?")[0] ?? "") !== "";

// One process, one port: health check, Socket.io and the built app.
export const buildServer = async (config: Config): Promise<FastifyInstance> => {
  const app = Fastify({ logger: { level: config.logLevel } });

  await ensureSeeded(config.dataDir, SEED_DIR, app.log);
  const loaded = await loadActiveShow(config.dataDir, app.log);

  const io: RealtimeServer = new Server(app.server, { serveClient: false });
  attachRealtime(io, () => loaded);

  // Long-lived sockets would otherwise keep the HTTP server from closing. Closing the transports
  // (rather than disconnecting sockets) tells displays to reconnect on their own once we are back.
  app.addHook("preClose", async () => {
    io.engine.close();
  });

  app.get("/health", async () => ({
    status: loaded ? "ok" : "degraded",
    protocol: PROTOCOL_VERSION,
    show: loaded?.show.id ?? null,
    displays: countDisplays(io),
  }));

  if (existsSync(path.join(config.appDist, "index.html"))) {
    await app.register(fastifyStatic, {
      root: config.appDist,
      setHeaders: (reply, filePath) => {
        reply.header(
          "cache-control",
          filePath.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    });
  } else {
    app.log.warn({ appDist: config.appDist }, "App build not found; run `pnpm build`. Serving the API only.");
  }

  // Client-side routes (/d/bridge-1) get the app shell; missing files and API paths stay 404.
  app.setNotFoundHandler((request, reply) => {
    const wantsAppShell =
      request.method === "GET" &&
      !request.url.startsWith("/api/") &&
      !hasFileExtension(request.url) &&
      existsSync(path.join(config.appDist, "index.html"));

    if (wantsAppShell) return reply.header("cache-control", "no-cache").sendFile("index.html");
    return reply.code(404).send({ error: "Not found" });
  });

  return app;
};
