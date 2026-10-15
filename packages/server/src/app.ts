import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { AssetNameSchema, PROTOCOL_VERSION } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import Fastify, { type FastifyInstance } from "fastify";
import { Server } from "socket.io";
import type { Config } from "./config.ts";
import { createGeneration } from "./generation.ts";
import { registerApi } from "./http/api.ts";
import { registerMcp } from "./mcp/route.ts";
import { SEED_DIR } from "./paths.ts";
import { attachRealtime, connectedDisplayIds, countDisplays, type RealtimeServer } from "./realtime.ts";
import { createShowService } from "./showService.ts";
import { assetsDir, ensureSeeded, loadActiveShow } from "./storage/repository.ts";

const SIGNAL_TICK_MS = 250;

const hasFileExtension = (url: string): boolean => path.extname(url.split("?")[0] ?? "") !== "";

// One process, one port: health check, REST API, Socket.io and the built app.
export const buildServer = async (config: Config): Promise<FastifyInstance> => {
  const app = Fastify({ logger: { level: config.logLevel } });

  await ensureSeeded(config.dataDir, SEED_DIR, app.log);
  const loaded = await loadActiveShow(config.dataDir, decorCatalog, app.log);
  const service = createShowService({ dataDir: config.dataDir, decor: decorCatalog, log: app.log, loaded });

  const io: RealtimeServer = new Server(app.server, { serveClient: false });
  attachRealtime(io, service, { editorToken: config.editorToken });

  // Shared walk and wave signals move on the server, so every display shows the same value.
  const signalClock = setInterval(() => service.tickSignals(), SIGNAL_TICK_MS);
  signalClock.unref();

  // Long-lived sockets would otherwise keep the HTTP server from closing. Closing the transports
  // (rather than disconnecting sockets) tells displays to reconnect on their own once we are back.
  app.addHook("preClose", async () => {
    clearInterval(signalClock);
    io.engine.close();
    await service.flush();
  });

  app.get("/health", async () => ({
    status: loaded ? "ok" : "degraded",
    protocol: PROTOCOL_VERSION,
    show: loaded?.show.id ?? null,
    state: loaded ? service.state() : null,
    displays: countDisplays(io),
  }));

  const generation = await createGeneration({ service, dataDir: config.dataDir, log: app.log });
  registerApi(app, service, generation, io, { editorToken: config.editorToken, publicUrl: config.publicUrl });
  registerMcp(app, { service, generation, connected: () => connectedDisplayIds(io) }, { editorToken: config.editorToken });

  // Show assets. Uploads can be SVG, so the files are sandboxed: opened directly they cannot run scripts.
  if (loaded) {
    const root = assetsDir(config.dataDir, loaded.show.id);
    await mkdir(root, { recursive: true });
    await app.register(fastifyStatic, {
      root,
      prefix: "/media/",
      decorateReply: false,
      allowedPath: (pathName) => AssetNameSchema.safeParse(pathName.replace(/^\//, "")).success,
      setHeaders: (reply) => {
        reply.header("cache-control", "no-cache");
        reply.header("content-security-policy", "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
        reply.header("x-content-type-options", "nosniff");
      },
    });
  }

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

  // Client-side routes (/d/bridge-1, /gallery) get the app shell; missing files and API paths stay 404.
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
