import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestServer, nextEvent } from "./testing/testServer.ts";

const server = createTestServer();

beforeEach(async () => {
  await server.setup();
  await server.start();
});
afterEach(server.teardown);

describe("realtime", () => {
  it("sends a state change to every display within the 100 ms budget", async () => {
    const displays = await Promise.all(["a", "b", "c", "engineering-1"].map((id) => server.display(id)));
    const received = displays.map(({ client }) => nextEvent(client, "state"));

    const sent = performance.now();
    await server.api("POST", "/api/state", { state: "red-alert" });
    const updates = await Promise.all(received);
    const elapsed = performance.now() - sent;

    expect(updates).toEqual(displays.map(() => ({ state: "red-alert" })));
    expect(elapsed).toBeLessThan(100);
  });

  it("flashes the label on the identified display only", async () => {
    const target = await server.display("test");
    const other = await server.display("bystander");
    let otherFlashed = false;
    other.client.on("identify", () => {
      otherFlashed = true;
    });

    const flash = nextEvent(target.client, "identify");
    await server.api("POST", "/api/displays/test/identify");

    expect(await flash).toEqual({ label: "Test display" });
    expect(otherFlashed).toBe(false);
  });

  it("moves a display to its new screen when it is reassigned", async () => {
    const { client } = await server.display("bridge-2");
    const next = nextEvent(client, "snapshot");

    await server.api("PUT", "/api/displays/bridge-2", { screen: "tactical", name: "Bridge 2" });

    const snapshot = await next;
    expect(snapshot.screen?.id).toBe("tactical");
    expect(snapshot.display).toEqual({ id: "bridge-2", name: "Bridge 2" });
  });

  it("pushes an edited screen to the displays showing it, and only to them", async () => {
    const bridge = await server.display("test");
    const engineering = await server.display("engineering-1");
    let engineeringUpdated = false;
    engineering.client.on("snapshot", () => {
      engineeringUpdated = true;
    });

    const next = nextEvent(bridge.client, "snapshot");
    await server.api("POST", "/api/screens/bridge/ops", {
      baseRevision: 0,
      ops: [{ op: "update", id: "title", props: { text: "Battle bridge" } }],
    });

    const snapshot = await next;
    expect(snapshot.screen?.revision).toBe(1);
    expect(engineeringUpdated).toBe(false);
  });

  it("includes the current state in a reconnect snapshot", async () => {
    await server.api("POST", "/api/state", { state: "damaged" });
    const { snapshot } = await server.display("late-joiner");

    expect(snapshot.state).toBe("damaged");
  });
});
