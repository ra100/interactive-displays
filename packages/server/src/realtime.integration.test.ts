import { PROTOCOL_VERSION } from "@interactive-displays/core";
import { afterEach, describe, expect, it } from "vitest";
import { eventMatching, createTestServer, nextEvent } from "./testing/testServer.ts";

const server = createTestServer();

const boot = async (options: { editorToken?: string } = {}) => {
  await server.setup(options);
  await server.start();
};

afterEach(server.teardown);

const renameBridge = (baseRevision: number, text: string) =>
  server.api("POST", "/api/screens/bridge/ops", {
    baseRevision,
    ops: [{ op: "update", id: "title", props: { text } }],
  });

describe("displays", () => {
  it("sends a state change to every display within the 100 ms budget", async () => {
    await boot();
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
    await boot();
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

  it("asks one display to reload", async () => {
    await boot();
    const target = await server.display("test");
    const reload = new Promise<boolean>((resolve) => target.client.once("reload", () => resolve(true)));

    expect((await server.api("POST", "/api/displays/test/reload")).status).toBe(200);
    expect(await reload).toBe(true);
  });

  it("moves a display to its new screen when it is reassigned", async () => {
    await boot();
    const { client } = await server.display("bridge-2");
    const next = nextEvent(client, "snapshot");

    await server.api("PUT", "/api/displays/bridge-2", { screen: "tactical", name: "Bridge 2" });

    const snapshot = await next;
    expect(snapshot.screen?.id).toBe("tactical");
    expect(snapshot.display).toEqual({ id: "bridge-2", name: "Bridge 2" });
  });

  it("keeps edits off air until they are published, then updates only the displays showing the screen", async () => {
    await boot();
    const bridge = await server.display("test");
    const engineering = await server.display("engineering-1");
    const snapshots: string[] = [];
    bridge.client.on("snapshot", () => snapshots.push("bridge"));
    engineering.client.on("snapshot", () => snapshots.push("engineering"));

    await renameBridge(0, "Battle bridge");
    expect(snapshots).toEqual([]);

    const next = nextEvent(bridge.client, "snapshot");
    await server.api("POST", "/api/screens/bridge/publish", { revision: 1 });

    const snapshot = await next;
    expect(snapshot.screen).toMatchObject({ revision: 1, published: 1 });
    expect(snapshot.preview).toBe(false);
    expect(snapshots).toEqual(["bridge"]);
  });

  it("previews a draft on one display, follows its edits, and goes back to the published screen", async () => {
    await boot();
    const { client, snapshot } = await server.display("test");
    expect(snapshot.preview).toBe(false);

    const previewing = nextEvent(client, "snapshot");
    await server.api("PUT", "/api/displays/test/preview", { screen: "tactical" });
    expect(await previewing).toMatchObject({ preview: true, screen: { id: "tactical", revision: 0 } });

    const edited = nextEvent(client, "snapshot");
    await server.api("POST", "/api/screens/tactical/ops", {
      baseRevision: 0,
      ops: [{ op: "update", id: "title", props: { text: "Draft tactical" } }],
    });
    expect(await edited).toMatchObject({ preview: true, screen: { id: "tactical", revision: 1 } });

    const back = nextEvent(client, "snapshot");
    await server.api("DELETE", "/api/displays/test/preview");
    expect(await back).toMatchObject({ preview: false, screen: { id: "bridge" } });
  });

  it("includes the current state in a reconnect snapshot", async () => {
    await boot();
    await server.api("POST", "/api/state", { state: "damaged" });
    const { snapshot } = await server.display("late-joiner");

    expect(snapshot.state).toBe("damaged");
  });
});

describe("operators and builders", () => {
  it("gives an operator the show overview", async () => {
    await boot();
    const { overview } = await server.tool("operator");

    expect(overview.protocol).toBe(PROTOCOL_VERSION);
    expect(overview.state).toBe("normal");
    expect(overview.screens.find((screen) => screen.id === "bridge")).toMatchObject({ revision: 0, published: 0 });
    expect(overview.displays.map((display) => display.id)).toEqual(["corridor-1", "engineering-1", "tactical-1", "test"]);
  });

  it("updates the overview when displays connect and disconnect and when the state changes", async () => {
    await boot();
    const { client } = await server.tool("operator");

    const connected = eventMatching(client, "overview", (overview) =>
      overview.displays.some((display) => display.id === "test" && display.connected),
    );
    const display = await server.display("test");
    await connected;

    const disconnected = eventMatching(client, "overview", (overview) =>
      overview.displays.some((entry) => entry.id === "test" && !entry.connected && entry.lastSeen !== null),
    );
    display.client.disconnect();
    await disconnected;

    const alert = eventMatching(client, "overview", (overview) => overview.state === "red-alert");
    await server.api("POST", "/api/state", { state: "red-alert" });
    expect((await alert).state).toBe("red-alert");
  });

  it("sends a builder the draft it watches, and every change to it", async () => {
    await boot();
    const { client } = await server.tool("builder");

    const first = nextEvent(client, "screen");
    client.emit("watch", { screenId: "bridge" });
    expect(await first).toMatchObject({ screenId: "bridge", screen: { revision: 0 }, lint: [] });

    const edited = nextEvent(client, "screen");
    const summary = eventMatching(client, "overview", (overview) =>
      overview.screens.some((screen) => screen.id === "bridge" && screen.revision === 1),
    );
    await renameBridge(0, "Edited elsewhere");
    expect(await edited).toMatchObject({ screenId: "bridge", screen: { revision: 1 } });
    expect((await summary).screens.find((screen) => screen.id === "bridge")?.published).toBe(0);
  });

  it("tells a builder when the screen it watches is deleted", async () => {
    await boot();
    const { client } = await server.tool("builder");
    const first = nextEvent(client, "screen");
    client.emit("watch", { screenId: "schematic" });
    await first;

    const gone = nextEvent(client, "screen");
    await server.api("DELETE", "/api/screens/schematic");
    expect(await gone).toEqual({ screenId: "schematic", screen: null, lint: [] });
  });

  it("ignores watch requests from displays", async () => {
    await boot();
    const { client } = await server.display("test");
    let got = false;
    client.on("screen", () => {
      got = true;
    });
    client.emit("watch", { screenId: "bridge" });
    await server.api("GET", "/health");
    expect(got).toBe(false);
  });
});

describe("with an editor token", () => {
  it("turns away operators and builders without it, but not displays", async () => {
    await boot({ editorToken: "set-secret-1" });

    for (const role of ["operator", "builder"]) {
      const { reply } = await server.hello({ role, protocol: PROTOCOL_VERSION });
      expect(reply).toMatchObject({ code: "UNAUTHORIZED" });
      const wrong = await server.hello({ role, protocol: PROTOCOL_VERSION, token: "wrong-token" });
      expect(wrong.reply).toMatchObject({ code: "UNAUTHORIZED" });
    }

    expect((await server.tool("operator", "set-secret-1")).overview.state).toBe("normal");
    expect((await server.display("test")).snapshot.screen?.id).toBe("bridge");
  });
});
