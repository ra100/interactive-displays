import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROTOCOL_VERSION } from "@interactive-displays/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestServer } from "./testing/testServer.ts";

const server = createTestServer();

beforeEach(server.setup);
afterEach(server.teardown);

describe("server", () => {
  it("reports health with the seeded demo show", async () => {
    await server.start();
    const { body } = await server.api("GET", "/health");

    expect(body).toEqual({ status: "ok", protocol: PROTOCOL_VERSION, show: "demo", state: "normal", displays: 0 });
  });

  it("sends a snapshot with the default screen, theme and states in reply to hello", async () => {
    await server.start();
    const { snapshot } = await server.display("bridge-1");

    expect(snapshot.protocol).toBe(PROTOCOL_VERSION);
    expect(snapshot.show).toMatchObject({ id: "demo", name: "Demo Show", theme: { id: "lcars" } });
    expect(snapshot.show.states.map((state) => state.id)).toEqual([
      "normal",
      "yellow-alert",
      "red-alert",
      "damaged",
      "blackout",
    ]);
    expect(snapshot.state).toBe("normal");
    expect(snapshot.display).toEqual({ id: "bridge-1", scale: 0.7 });
    expect(snapshot.screen?.id).toBe("bridge");
  });

  it("sends an assigned display its own screen and name", async () => {
    await server.start();
    const { snapshot } = await server.display("engineering-1");

    expect(snapshot.display).toEqual({ id: "engineering-1", name: "Engineering 1", scale: 0.7 });
    expect(snapshot.screen?.id).toBe("engineering");
  });

  it("counts connected displays", async () => {
    await server.start();
    await server.display("a");
    await server.display("b");

    expect((await server.api<{ displays: number }>("GET", "/health")).body.displays).toBe(2);
  });

  it("rejects an invalid hello", async () => {
    await server.start();
    const { reply } = await server.hello({ role: "display", displayId: "../../etc" });

    expect(reply).toMatchObject({ code: "INVALID_HELLO" });
  });

  it("serves the app shell for client routes and 404 for missing files", async () => {
    const url = await server.start();

    const shell = await fetch(`${url}/d/bridge-1`);
    expect(shell.status).toBe(200);
    expect(await shell.text()).toContain("shell");
    expect(shell.headers.get("cache-control")).toBe("no-cache");

    const asset = await fetch(`${url}/assets/app-123.js`);
    expect(asset.headers.get("cache-control")).toContain("immutable");

    expect((await fetch(`${url}/assets/missing.js`)).status).toBe(404);
    expect((await fetch(`${url}/api/nothing`)).status).toBe(404);
  });

  it("keeps its data and state across a restart", async () => {
    await server.start();
    await server.api("POST", "/api/state", { state: "red-alert" });
    await server.stop();

    // Edit the data while the server is down; the next start must read it, not re-seed.
    const screenFile = path.join(server.config().dataDir, "shows/demo/published/bridge.json");
    const screen = JSON.parse(await readFile(screenFile, "utf8"));
    await writeFile(screenFile, JSON.stringify({ ...screen, name: "Edited" }));

    await server.start();
    const { snapshot } = await server.display("bridge-1");
    expect(snapshot.screen?.name).toBe("Edited");
    expect(snapshot.state).toBe("red-alert");
  });

  it("tells displays when there is no usable show", async () => {
    const { dataDir } = server.config();
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, "settings.json"), JSON.stringify({ schemaVersion: 1, activeShow: "gone" }));

    await server.start();
    const { reply } = await server.hello({ role: "display", displayId: "bridge-1", protocol: PROTOCOL_VERSION });
    expect(reply).toMatchObject({ code: "NO_ACTIVE_SHOW" });
    expect((await server.api<{ status: string }>("GET", "/health")).body.status).toBe("degraded");
  });
});
