import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type ClientToServerEvents,
  type DisplaySnapshot,
  PROTOCOL_VERSION,
  type ProtocolError,
  type ServerToClientEvents,
  type ShowOverview,
} from "@interactive-displays/core";
import type { FastifyInstance } from "fastify";
import { io as connect, type Socket } from "socket.io-client";
import { buildServer } from "../app.ts";
import type { Config } from "../config.ts";

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RequestOptions {
  token?: string;
  // Sends `data` as the raw body with this content type instead of JSON.
  raw?: { contentType: string; data: Uint8Array };
}

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

  const setup = async (options: Pick<Config, "editorToken" | "publicUrl" | "ai"> = {}) => {
    root = await mkdtemp(path.join(tmpdir(), "displays-app-"));
    const appDist = path.join(root, "dist");
    await mkdir(path.join(appDist, "assets"), { recursive: true });
    await writeFile(path.join(appDist, "index.html"), "<!doctype html><title>shell</title>");
    await writeFile(path.join(appDist, "assets", "app-123.js"), "console.log(1)");
    config = { port: 0, host: "127.0.0.1", dataDir: path.join(root, "data"), appDist, logLevel: "silent", ...options };
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

  // Connects, says hello and resolves with the first reply: a snapshot (displays), an overview (operators and
  // builders) or a protocol error.
  const hello = (
    payload: unknown,
  ): Promise<{ client: Client; reply: DisplaySnapshot | ShowOverview | ProtocolError }> =>
    new Promise((resolve, reject) => {
      const client: Client = connect(url, { transports: ["websocket"], reconnection: false });
      clients.push(client);
      client.on("connect_error", reject);
      client.once("snapshot", (reply) => resolve({ client, reply }));
      client.once("overview", (reply) => resolve({ client, reply }));
      client.once("error", (reply) => resolve({ client, reply }));
      client.on("connect", () => {
        (client.emit as (event: string, payload: unknown) => void)("hello", payload);
      });
    });

  const display = async (displayId: string) => {
    const { client, reply } = await hello({ role: "display", displayId, protocol: PROTOCOL_VERSION });
    if (!("display" in reply)) throw new Error(`hello failed: ${JSON.stringify(reply)}`);
    return { client, snapshot: reply };
  };

  const tool = async (role: "operator" | "builder", token?: string) => {
    const { client, reply } = await hello({ role, protocol: PROTOCOL_VERSION, ...(token ? { token } : {}) });
    if (!("screens" in reply)) throw new Error(`hello failed: ${JSON.stringify(reply)}`);
    return { client, overview: reply };
  };

  // The caller states the response body it expects; tests then check it.
  const api = async <Body = unknown>(
    method: string,
    route: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<{ status: number; body: Body; headers: Headers }> => {
    const headers: Record<string, string> = options.token ? { authorization: `Bearer ${options.token}` } : {};
    let payload: string | Uint8Array | undefined;
    if (options.raw) {
      headers["content-type"] = options.raw.contentType;
      payload = options.raw.data;
    } else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const response = await fetch(`${url}${route}`, { method, headers, ...(payload === undefined ? {} : { body: payload }) });
    const text = await response.text();
    const parsed: unknown = response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text;
    return { status: response.status, body: parsed as Body, headers: response.headers };
  };

  return { config: currentConfig, url: () => url, setup, start, stop, teardown, hello, display, tool, api };
};

export const nextEvent = <Event extends keyof ServerToClientEvents>(
  client: Client,
  event: Event,
): Promise<Parameters<ServerToClientEvents[Event]>[0]> =>
  new Promise((resolve) => {
    (client.once as (event: string, listener: (payload: never) => void) => void)(event, resolve);
  });

// Resolves with the first event that passes the check, for streams like overview updates.
export const eventMatching = <Event extends keyof ServerToClientEvents>(
  client: Client,
  event: Event,
  check: (payload: Parameters<ServerToClientEvents[Event]>[0]) => boolean,
): Promise<Parameters<ServerToClientEvents[Event]>[0]> =>
  new Promise((resolve) => {
    const listener = (payload: Parameters<ServerToClientEvents[Event]>[0]) => {
      if (!check(payload)) return;
      (client.off as (event: string, listener: unknown) => void)(event, listener);
      resolve(payload);
    };
    (client.on as (event: string, listener: unknown) => void)(event, listener);
  });
