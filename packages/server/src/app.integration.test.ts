import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./app.ts";
import type { Config } from "./config.ts";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let root: string;
let config: Config;
let app: FastifyInstance | undefined;
const clients: Client[] = [];

const start = async (): Promise<string> => {
  app = await buildServer(config);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return `http://127.0.0.1:${address.port}`;
};

const stop = async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await app?.close();
  app = undefined;
};

const hello = (url: string, payload: unknown): Promise<DisplaySnapshot | ProtocolError> =>
  new Promise((resolve, reject) => {
    const client: Client = connect(url, { transports: ["websocket"], reconnection: false });
    clients.push(client);
    client.on("connect_error", reject);
    client.on("snapshot", resolve);
    client.on("error", resolve);
    client.on("connect", () => {
      (client.emit as (event: string, payload: unknown) => void)("hello", payload);
    });
  });

const displayHello = (displayId: string) => ({ role: "display", displayId, protocol: PROTOCOL_VERSION });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "displays-app-"));
  const appDist = path.join(root, "dist");
  await mkdir(path.join(appDist, "assets"), { recursive: true });
  await writeFile(path.join(appDist, "index.html"), "<!doctype html><title>shell</title>");
  await writeFile(path.join(appDist, "assets", "app-123.js"), "console.log(1)");
  config = { port: 0, host: "127.0.0.1", dataDir: path.join(root, "data"), appDist, logLevel: "silent" };
});

afterEach(async () => {
  await stop();
  await rm(root, { recursive: true, force: true });
});

describe("server", () => {
  it("reports health with the seeded demo show", async () => {
    const url = await start();
    const response = await fetch(`${url}/health`);

    expect(await response.json()).toEqual({ status: "ok", protocol: PROTOCOL_VERSION, show: "demo", displays: 0 });
  });

  it("sends a snapshot with the default screen in reply to hello", async () => {
    const url = await start();
    const snapshot = (await hello(url, displayHello("bridge-1"))) as DisplaySnapshot;

    expect(snapshot.protocol).toBe(PROTOCOL_VERSION);
    expect(snapshot.show).toEqual({ id: "demo", name: "Demo Show", theme: { id: "base" } });
    expect(snapshot.display).toEqual({ id: "bridge-1" });
    expect(snapshot.screen?.id).toBe("welcome");
  });

  it("includes the display's name from the show", async () => {
    const url = await start();
    const snapshot = (await hello(url, displayHello("test"))) as DisplaySnapshot;

    expect(snapshot.display).toEqual({ id: "test", name: "Test display" });
  });

  it("counts connected displays", async () => {
    const url = await start();
    await hello(url, displayHello("a"));
    await hello(url, displayHello("b"));

    const health = (await (await fetch(`${url}/health`)).json()) as { displays: number };
    expect(health.displays).toBe(2);
  });

  it("rejects an invalid hello", async () => {
    const url = await start();
    const reply = await hello(url, { role: "display", displayId: "../../etc" });

    expect(reply).toMatchObject({ code: "INVALID_HELLO" });
  });

  it("serves the app shell for client routes and 404 for missing files", async () => {
    const url = await start();

    const shell = await fetch(`${url}/d/bridge-1`);
    expect(shell.status).toBe(200);
    expect(await shell.text()).toContain("shell");
    expect(shell.headers.get("cache-control")).toBe("no-cache");

    const asset = await fetch(`${url}/assets/app-123.js`);
    expect(asset.headers.get("cache-control")).toContain("immutable");

    expect((await fetch(`${url}/assets/missing.js`)).status).toBe(404);
    expect((await fetch(`${url}/api/nothing`)).status).toBe(404);
  });

  it("keeps its data across a restart", async () => {
    await start();
    await stop();

    // Edit the data while the server is down; the next start must read it, not re-seed.
    const screenFile = path.join(config.dataDir, "shows/demo/screens/welcome.json");
    const screen = JSON.parse(await readFile(screenFile, "utf8"));
    await writeFile(screenFile, JSON.stringify({ ...screen, name: "Edited" }));

    const url = await start();
    const snapshot = (await hello(url, displayHello("bridge-1"))) as DisplaySnapshot;
    expect(snapshot.screen?.name).toBe("Edited");
  });

  it("tells displays when there is no usable show", async () => {
    await mkdir(config.dataDir, { recursive: true });
    await writeFile(path.join(config.dataDir, "settings.json"), JSON.stringify({ schemaVersion: 1, activeShow: "gone" }));

    const url = await start();
    expect(await hello(url, displayHello("bridge-1"))).toMatchObject({ code: "NO_ACTIVE_SHOW" });

    const health = (await (await fetch(`${url}/health`)).json()) as { status: string };
    expect(health.status).toBe("degraded");
  });
});
