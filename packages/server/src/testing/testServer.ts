import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type ClientToServerEvents,
  type DisplaySnapshot,
  PROTOCOL_VERSION,
  type ProtocolError,
  type ServerToClientEvents,
} from "@interactive-displays/core";
import type { FastifyInstance } from "fastify";
import { io as connect, type Socket } from "socket.io-client";
import { buildServer } from "../app.ts";
import type { Config } from "../config.ts";

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

// A real server on a random port with a temporary data directory and a fake app build.
export const createTestServer = () => {
  let root = "";
  let app: FastifyInstance | undefined;
  const clients: Client[] = [];
  let config: Config | undefined;
  let url = "";

  const currentConfig = (): Config => {
    if (!config) throw new Error("call setup() first");
    return config;
  };

  const setup = async () => {
    root = await mkdtemp(path.join(tmpdir(), "displays-app-"));
    const appDist = path.join(root, "dist");
    await mkdir(path.join(appDist, "assets"), { recursive: true });
    await writeFile(path.join(appDist, "index.html"), "<!doctype html><title>shell</title>");
    await writeFile(path.join(appDist, "assets", "app-123.js"), "console.log(1)");
    config = { port: 0, host: "127.0.0.1", dataDir: path.join(root, "data"), appDist, logLevel: "silent" };
  };

  const start = async (): Promise<string> => {
    app = await buildServer(currentConfig());
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no address");
    url = `http://127.0.0.1:${address.port}`;
    return url;
  };

  const stop = async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await app?.close();
    app = undefined;
  };

  const teardown = async () => {
    await stop();
    await rm(root, { recursive: true, force: true });
  };

  // Connects, says hello and resolves with the first snapshot or protocol error.
  const hello = (payload: unknown): Promise<{ client: Client; reply: DisplaySnapshot | ProtocolError }> =>
    new Promise((resolve, reject) => {
      const client: Client = connect(url, { transports: ["websocket"], reconnection: false });
      clients.push(client);
      client.on("connect_error", reject);
      client.once("snapshot", (reply) => resolve({ client, reply }));
      client.once("error", (reply) => resolve({ client, reply }));
      client.on("connect", () => {
        (client.emit as (event: string, payload: unknown) => void)("hello", payload);
      });
    });

  const display = async (displayId: string) => {
    const { client, reply } = await hello({ role: "display", displayId, protocol: PROTOCOL_VERSION });
    if (!("protocol" in reply)) throw new Error(`hello failed: ${reply.message}`);
    return { client, snapshot: reply };
  };

  // The caller states the response body it expects; tests then check it.
  const api = async <Body = unknown>(
    method: string,
    route: string,
    body?: unknown,
  ): Promise<{ status: number; body: Body }> => {
    const response = await fetch(`${url}${route}`, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as Body };
  };

  return { config: currentConfig, setup, start, stop, teardown, hello, display, api };
};

export const nextEvent = <Event extends keyof ServerToClientEvents>(
  client: Client,
  event: Event,
): Promise<Parameters<ServerToClientEvents[Event]>[0]> =>
  new Promise((resolve) => {
    (client.once as (event: string, listener: (payload: never) => void) => void)(event, resolve);
  });
