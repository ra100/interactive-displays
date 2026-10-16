import { catalog, type LintIssue, type Screen, type ShowOverview, type ValidationIssue } from "@interactive-displays/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestServer, eventMatching, nextEvent } from "../testing/testServer.ts";

interface CatalogBody {
  widgets: Array<{ kind: string; props: { properties: object } }>;
  archetypes: object;
  effects: string[];
  themes: Array<{ id: string; variants: object; decor: Array<{ kind: string }> }>;
}

interface ScreenBody {
  screen: Screen;
  lint: LintIssue[];
  onAir?: string[];
}

interface IssuesBody {
  issues: ValidationIssue[];
}

const server = createTestServer();
const TOKEN = "set-secret-1";

beforeEach(async ({ task }) => {
  await server.setup(task.suite?.name === "with an editor token" ? { editorToken: TOKEN, publicUrl: "http://10.0.0.5:3010" } : {});
  await server.start();
});
afterEach(server.teardown);

describe("GET /api/catalog", () => {
  it("describes widgets as JSON Schema, plus archetypes, effects and themes", async () => {
    const { status, body } = await server.api<CatalogBody>("GET", "/api/catalog");

    expect(status).toBe(200);
    expect(body.widgets.map((widget) => widget.kind)).toEqual([...catalog.keys()]);
    expect(body.widgets[2]?.props.properties).toHaveProperty("label");
    expect(Object.keys(body.archetypes)).toEqual(["sidebar", "header-main", "dashboard", "split", "console", "panel"]);
    expect(body.effects).toContain("blackout");

    const lcars = body.themes.find((theme) => theme.id === "lcars");
    expect(lcars?.variants).toEqual({ nemesis: "Nemesis blue", ds9: "Deep Space Nine", voyager: "Voyager", "lower-decks": "Lower Decks", picard: "Picard grey" });
    expect(lcars?.decor.map((decor) => decor.kind)).toContain("lcars.elbow");
  });
});

describe("GET /api/show", () => {
  it("lists screens and every known display with what it shows", async () => {
    await server.display("d-new123");
    const { body } = await server.api<ShowOverview>("GET", "/api/show");

    expect(body.state).toBe("normal");
    expect(body.show.settings).toEqual({ liveEdit: false, displayGlobalActions: true, sounds: false, aiPublish: false, aiLiveControl: false });
    expect(body.screens.map((screen) => screen.id)).toEqual([
      "bridge",
      "sensors",
      "engineering",
      "operations",
      "schematic",
      "standby",
      "tactical",
      "viewscreen",
    ]);
    expect(body.screens[0]).toMatchObject({ name: "Bridge operations", revision: 0, published: 0, profile: { aspect: "16:9" } });
    const { displays } = body;
    expect(displays.find((display) => display.id === "d-new123")).toMatchObject({
      showing: "bridge",
      connected: true,
    });
    expect(displays.find((display) => display.id === "tactical-1")).toMatchObject({
      name: "Tactical 1",
      assigned: "tactical",
      showing: "tactical",
      connected: false,
      lastSeen: null,
      preview: null,
    });
  });

  it("switches live edit on and off", async () => {
    const on = await server.api<{ settings: object }>("PUT", "/api/show/settings", { liveEdit: true });
    expect(on.body.settings).toMatchObject({ liveEdit: true });
    expect((await server.api("PUT", "/api/show/settings", { liveEdit: "yes" })).status).toBe(400);
    expect((await server.api("PUT", "/api/show/settings", { colour: "red" })).status).toBe(400);
  });
});

describe("screens", () => {
  it("returns a screen with its lint report", async () => {
    const { status, body } = await server.api<ScreenBody>("GET", "/api/screens/bridge");

    expect(status).toBe(200);
    expect(body.screen).toMatchObject({ id: "bridge", revision: 0 });
    expect(body.lint).toEqual([]);
    expect(body.onAir).toEqual(["test"]);
  });

  it("lists every draft for the screen library", async () => {
    const { body } = await server.api<{ screens: Screen[] }>("GET", "/api/screens");
    expect(body.screens.map((screen) => screen.name)).toEqual([
      "Bridge operations",
      "Long range sensors",
      "Main engineering",
      "Operations",
      "Ship schematic",
      "Standby",
      "Tactical",
      "Viewscreen",
    ]);
  });

  it("returns 404 for a missing screen and 400 for a bad id", async () => {
    expect((await server.api("GET", "/api/screens/nope")).status).toBe(404);
    expect((await server.api("GET", "/api/screens/Not%20An%20Id")).status).toBe(400);
  });

  it("creates a screen and reports lint for it", async () => {
    const { status, body } = await server.api<ScreenBody>("POST", "/api/screens", {
      schemaVersion: 2,
      id: "helm",
      name: "Helm",
      root: { id: "root", type: "container", layout: { kind: "stack", direction: "column" }, children: [] },
    });

    expect(status).toBe(201);
    expect(body.lint).toEqual([expect.objectContaining({ rule: "empty-container" })]);
  });

  it("applies ops and answers a stale revision with 409 and the current revision", async () => {
    const ops = [{ op: "update", id: "title", props: { text: "Battle bridge" } }];

    const first = await server.api<ScreenBody>("POST", "/api/screens/bridge/ops", { baseRevision: 0, ops });
    expect(first.status).toBe(200);
    expect(first.body.screen).toMatchObject({ revision: 1 });

    const stale = await server.api("POST", "/api/screens/bridge/ops", { baseRevision: 0, ops });
    expect(stale).toMatchObject({ status: 409, body: { error: "The screen changed; reload it", revision: 1 } });
  });

  it("explains rejected ops: which op failed, or where the result is invalid", async () => {
    const missing = await server.api<IssuesBody>("POST", "/api/screens/bridge/ops", {
      baseRevision: 0,
      ops: [{ op: "remove", id: "ghost" }],
    });
    expect(missing.status).toBe(422);
    expect(missing.body.issues[0]?.path).toBe("ops.0");

    const invalid = await server.api<IssuesBody>("POST", "/api/screens/bridge/ops", {
      baseRevision: 0,
      ops: [{ op: "update", id: "title", props: { text: "" } }],
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.issues[0]?.path).toBe("root.children.0.node.props.text");
  });

  it("rejects a body without a base revision", async () => {
    expect((await server.api("POST", "/api/screens/bridge/ops", { ops: [] })).status).toBe(400);
  });
});

describe("publishing and revisions", () => {
  const rename = (baseRevision: number, text: string) =>
    server.api<ScreenBody>("POST", "/api/screens/bridge/ops", {
      baseRevision,
      ops: [{ op: "update", id: "title", props: { text } }],
    });

  it("publishes the current draft and says where it is on air", async () => {
    await rename(0, "Helm");

    const published = await server.api<ScreenBody>("POST", "/api/screens/bridge/publish", { revision: 1 });
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ screen: { revision: 1, published: 1 }, onAir: ["test"] });

    const onAir = await server.api<{ screen: Screen }>("GET", "/api/screens/bridge/published");
    expect(onAir.body.screen.revision).toBe(1);
  });

  it("refuses to publish a revision that is not the draft", async () => {
    await rename(0, "Helm");
    expect(await server.api("POST", "/api/screens/bridge/publish", { revision: 0 })).toMatchObject({
      status: 409,
      body: { revision: 1 },
    });
    expect((await server.api("POST", "/api/screens/bridge/publish", { revision: -1 })).status).toBe(400);
  });

  it("publishes without a revision check when none is given", async () => {
    expect((await server.api("POST", "/api/screens/bridge/publish")).status).toBe(200);
  });

  it("lists, reads and reverts to earlier revisions", async () => {
    await rename(0, "One");
    await rename(1, "Two");

    const list = await server.api<{ revisions: Array<{ revision: number; savedAt: string | null }> }>(
      "GET",
      "/api/screens/bridge/revisions",
    );
    expect(list.body.revisions.map((entry) => entry.revision)).toEqual([2, 1, 0]);
    expect(list.body.revisions[0]?.savedAt).toEqual(expect.any(String));

    const old = await server.api<{ screen: Screen }>("GET", "/api/screens/bridge/revisions/0");
    expect(old.body.screen.revision).toBe(0);
    expect((await server.api("GET", "/api/screens/bridge/revisions/42")).status).toBe(404);
    expect((await server.api("GET", "/api/screens/bridge/revisions/x")).status).toBe(400);

    const reverted = await server.api<ScreenBody>("POST", "/api/screens/bridge/revert", { baseRevision: 2, revision: 0 });
    expect(reverted.body.screen.revision).toBe(3);
    expect(reverted.body.screen.root).toEqual(old.body.screen.root);
  });

  it("duplicates and deletes screens", async () => {
    const copy = await server.api<{ screen: Screen }>("POST", "/api/screens/tactical/duplicate", { name: "Weapons" });
    expect(copy.status).toBe(201);
    expect(copy.body.screen).toMatchObject({ id: "weapons", name: "Weapons", revision: 0 });

    expect(await server.api("DELETE", "/api/screens/weapons")).toMatchObject({ status: 200, body: { deleted: "weapons" } });
    expect((await server.api("GET", "/api/screens/weapons")).status).toBe(404);
    expect((await server.api("DELETE", "/api/screens/tactical")).status).toBe(409);
  });
});

describe("state and displays", () => {
  it("sets the show state", async () => {
    expect(await server.api("POST", "/api/state", { state: "yellow-alert" })).toMatchObject({
      status: 200,
      body: { state: "yellow-alert" },
    });
    expect((await server.api("POST", "/api/state", { state: "plaid" })).status).toBe(404);
  });

  it("names and assigns a display, and clears the assignment with null", async () => {
    const assigned = await server.api<{ display: object }>("PUT", "/api/displays/bridge-2", { name: "Bridge 2", screen: "tactical" });
    expect(assigned.body.display).toEqual({ id: "bridge-2", name: "Bridge 2", screen: "tactical" });

    const cleared = await server.api<{ display: object }>("PUT", "/api/displays/bridge-2", { screen: null });
    expect(cleared.body.display).toEqual({ id: "bridge-2", name: "Bridge 2" });
  });

  it("rejects unknown fields and unknown screens", async () => {
    expect((await server.api("PUT", "/api/displays/bridge-2", { colour: "red" })).status).toBe(400);
    expect((await server.api("PUT", "/api/displays/bridge-2", { screen: "nope" })).status).toBe(404);
  });

  it("previews a draft on a display and ends the preview", async () => {
    expect(await server.api("PUT", "/api/displays/test/preview", { screen: "tactical" })).toMatchObject({
      status: 200,
      body: { preview: "tactical" },
    });
    const { body } = await server.api<ShowOverview>("GET", "/api/show");
    expect(body.displays.find((display) => display.id === "test")?.preview).toBe("tactical");

    expect((await server.api("DELETE", "/api/displays/test/preview")).body).toEqual({ preview: null });
    expect((await server.api("PUT", "/api/displays/test/preview", { screen: "nope" })).status).toBe(404);
  });

  it("asks a display to reload and forgets a display", async () => {
    expect((await server.api("POST", "/api/displays/test/reload")).body).toEqual({ reloaded: "test" });
    expect((await server.api("DELETE", "/api/displays/tactical-1")).body).toEqual({ forgotten: "tactical-1" });
    const { body } = await server.api<ShowOverview>("GET", "/api/show");
    expect(body.displays.map((display) => display.id)).not.toContain("tactical-1");
  });

  it("identifies a display", async () => {
    expect(await server.api("POST", "/api/displays/test/identify")).toMatchObject({
      status: 200,
      body: { label: "Test display" },
    });
  });
});

describe("signals, settings and video", () => {
  it("sets a shared manual signal by value or by delta", async () => {
    expect(await server.api("PUT", "/api/signals/shields/value", { value: 42 })).toMatchObject({
      status: 200,
      body: { id: "shields", value: 40 },
    });
    expect(await server.api("PUT", "/api/signals/shields/value", { delta: -15 })).toMatchObject({
      status: 200,
      body: { value: 25 },
    });
    expect(await server.api("GET", "/api/signals")).toMatchObject({ status: 200, body: { values: { shields: 25 } } });
  });

  it("refuses bad signal changes", async () => {
    expect((await server.api("PUT", "/api/signals/shields/value", { value: 1, delta: 1 })).status).toBe(400);
    expect((await server.api("PUT", "/api/signals/shields/value", {})).status).toBe(400);
    expect((await server.api("PUT", "/api/signals/Bad%20Id/value", { value: 1 })).status).toBe(400);
    expect((await server.api("PUT", "/api/signals/eps.load/value", { value: 1 })).status).toBe(409);
    expect((await server.api("PUT", "/api/signals/nope/value", { value: 1 })).status).toBe(404);
  });

  it("replaces the show's signal definitions", async () => {
    const signals = [{ id: "reactor", label: "Reactor", source: { kind: "wave", min: 0, max: 10 } }];
    const { status, body } = await server.api<{ signals: Array<{ id: string; scope: string }> }>("PUT", "/api/show/signals", { signals });

    expect(status).toBe(200);
    expect(body.signals).toMatchObject([{ id: "reactor", scope: "ambient" }]);
    expect((await server.api<ShowOverview>("GET", "/api/show")).body.show.signals).toHaveLength(1);
    expect(await server.api("PUT", "/api/show/signals", { signals: [{ id: "x" }] })).toMatchObject({ status: 422 });
    expect((await server.api("PUT", "/api/show/signals", [])).status).toBe(400);
  });

  it("switches display controls and sounds", async () => {
    const { body } = await server.api<{ settings: object }>("PUT", "/api/show/settings", { displayGlobalActions: false, sounds: true });
    expect(body.settings).toEqual({ liveEdit: false, displayGlobalActions: false, sounds: true, aiPublish: false, aiLiveControl: false });
  });

  it("lets the operator allow AI to publish and run the show", async () => {
    const { body } = await server.api<{ settings: object }>("PUT", "/api/show/settings", { aiPublish: true, aiLiveControl: true });
    expect(body.settings).toMatchObject({ aiPublish: true, aiLiveControl: true });
  });

  it("re-skins the show and re-sends every display its snapshot", async () => {
    const { client } = await server.display("test");
    const snapshot = nextEvent(client, "snapshot");
    const { status, body } = await server.api<{ theme: object }>("PUT", "/api/show/theme", { id: "crt", variant: "ice" });
    expect(status).toBe(200);
    expect(body.theme).toEqual({ id: "crt", variant: "ice" });
    expect(await snapshot).toMatchObject({ show: { theme: { id: "crt", variant: "ice" } } });
    expect((await server.api("PUT", "/api/show/theme", { id: "holodeck" })).status).toBe(422);
    expect((await server.api("PUT", "/api/show/theme", { theme: "crt" })).status).toBe(400);
  });

  it("plays another theme's sound pack on the displays", async () => {
    const { client } = await server.display("test");
    let snapshot = nextEvent(client, "snapshot");
    expect(await server.api("PUT", "/api/show/sound-pack", { pack: "lcars" })).toMatchObject({ status: 200, body: { pack: "lcars" } });
    expect(await snapshot).toMatchObject({ show: { soundPack: "lcars" } });
    snapshot = nextEvent(client, "snapshot");
    expect((await server.api("PUT", "/api/show/sound-pack", { pack: null })).status).toBe(200);
    expect((await snapshot).show).not.toHaveProperty("soundPack");
    expect((await server.api("PUT", "/api/show/sound-pack", { pack: "holodeck" })).status).toBe(422);
  });

  it("sends each display the scale it draws at", async () => {
    const { client } = await server.display("test");
    let snapshot = nextEvent(client, "snapshot");
    expect(await server.api("PUT", "/api/show/scale", { scale: 0.5 })).toMatchObject({ status: 200, body: { scale: 0.5 } });
    expect(await snapshot).toMatchObject({ display: { id: "test", scale: 0.5 } });
    snapshot = nextEvent(client, "snapshot");
    expect((await server.api("PUT", "/api/displays/test", { scale: 0.8 })).status).toBe(200);
    expect(await snapshot).toMatchObject({ display: { id: "test", scale: 0.8 } });
    expect((await server.api("PUT", "/api/show/scale", { scale: 3 })).status).toBe(400);
  });

  it("sends each display the panel it draws on, so buttons come out in real centimetres", async () => {
    const { client } = await server.display("test");
    let snapshot = nextEvent(client, "snapshot");
    expect(await server.api("PUT", "/api/show/panel", { buttonCm: 2 })).toMatchObject({ status: 200, body: { panel: { inches: 90, buttonCm: 2 } } });
    expect(await snapshot).toMatchObject({ display: { id: "test", panel: { inches: 90, buttonCm: 2 } } });
    snapshot = nextEvent(client, "snapshot");
    expect((await server.api("PUT", "/api/displays/test", { inches: 11 })).status).toBe(200);
    expect(await snapshot).toMatchObject({ display: { id: "test", panel: { inches: 11, buttonCm: 2 } } });
    expect((await server.api("PUT", "/api/show/panel", { buttonCm: 9 })).status).toBe(400);
  });

  it("runs cues with GO and tells the console which ran", async () => {
    const operator = await server.tool("operator");
    let overview = eventMatching(operator.client, "overview", (update) => update.cue === "top");
    expect(await server.api("POST", "/api/cues/go")).toMatchObject({ status: 200, body: { cue: "top", skipped: [] } });
    expect(await overview).toMatchObject({ cue: "top" });
    expect(await server.api("POST", "/api/cues/breach/run")).toMatchObject({ status: 200, body: { cue: "breach" } });
    expect((await server.api<{ state: string }>("GET", "/health")).body.state).toBe("damaged");
    expect((await server.api("POST", "/api/cues/go")).body).toMatchObject({ cue: "all-clear" });
    expect((await server.api("POST", "/api/cues/go")).status).toBe(409);
    overview = eventMatching(operator.client, "overview", (update) => update.cue === null);
    expect((await server.api("POST", "/api/cues/reset")).status).toBe(200);
    expect(await overview).toMatchObject({ cue: null });
    expect((await server.api("PUT", "/api/show/cues", { cues: [{ id: "x", label: "X", state: "panic" }] })).status).toBe(422);
    expect(await server.api("PUT", "/api/show/cues", { cues: [{ id: "x", label: "X", state: "normal" }] })).toMatchObject({
      status: 200,
      body: { cues: [{ id: "x", label: "X", state: "normal" }] },
    });
  });

  it("changes only the settings a request names", async () => {
    await server.api("PUT", "/api/show/settings", { displayGlobalActions: false });
    await server.api("PUT", "/api/show/settings", { liveEdit: true });
    const { body } = await server.api<{ settings: object }>("PUT", "/api/show/settings", { sounds: true });
    expect(body.settings).toEqual({ liveEdit: true, displayGlobalActions: false, sounds: true, aiPublish: false, aiLiveControl: false });
  });

  it("sends video commands only for videos the display shows", async () => {
    expect(await server.api("POST", "/api/displays/viewscreen-1/video", { target: "feed", command: "toggle" })).toMatchObject({
      status: 200,
      body: { target: "feed", command: "toggle" },
    });
    expect((await server.api("POST", "/api/displays/test/video", { target: "feed", command: "play" })).status).toBe(404);
    expect((await server.api("POST", "/api/displays/viewscreen-1/video", { target: "feed", command: "rewind" })).status).toBe(400);
  });
});

describe("assets", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("uploads, lists, serves and deletes an asset", async () => {
    const uploaded = await server.api("PUT", "/api/assets/warp-core.png", undefined, {
      raw: { contentType: "image/png", data: png },
    });
    expect(uploaded).toMatchObject({ status: 201, body: { asset: "warp-core.png" } });

    const list = await server.api<{ assets: Array<{ name: string; size: number }> }>("GET", "/api/assets");
    expect(list.body.assets.map((asset) => asset.name)).toEqual(["schematic.svg", "viewscreen.webm", "warp-core.png"]);

    const file = await fetch(`${server.url()}/media/warp-core.png`);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(png);

    expect((await server.api("DELETE", "/api/assets/warp-core.png")).status).toBe(200);
    expect((await server.api("DELETE", "/api/assets/warp-core.png")).status).toBe(404);
  });

  it("serves SVG sandboxed, so it cannot run scripts when opened directly", async () => {
    const file = await fetch(`${server.url()}/media/schematic.svg`);
    expect(file.headers.get("content-type")).toContain("image/svg+xml");
    expect(file.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("rejects bad names, empty bodies and other content types", async () => {
    const raw = { contentType: "image/png", data: png };
    expect((await server.api("PUT", "/api/assets/..%2Fshow.json", undefined, { raw })).status).toBe(400);
    expect((await server.api("PUT", "/api/assets/notes.txt", undefined, { raw })).status).toBe(400);
    expect(
      (await server.api("PUT", "/api/assets/a.png", undefined, { raw: { contentType: "image/png", data: new Uint8Array() } }))
        .status,
    ).toBe(400);
    expect(
      (await server.api("PUT", "/api/assets/a.png", undefined, { raw: { contentType: "text/html", data: png } })).status,
    ).toBe(415);
    expect((await fetch(`${server.url()}/media/..%2Fshow.json`)).status).toBe(404);
  });
});

describe("with an editor token", () => {
  it("needs the token for every write", async () => {
    expect(await server.api("POST", "/api/state", { state: "red-alert" })).toMatchObject({
      status: 401,
      body: { error: "This server needs the editor token" },
    });
    expect((await server.api("POST", "/api/state", { state: "red-alert" }, { token: "wrong-token" })).status).toBe(401);
    expect((await server.api("POST", "/api/state", { state: "red-alert" }, { token: TOKEN })).status).toBe(200);
  });

  it("keeps reads open", async () => {
    expect((await server.api("GET", "/api/show")).status).toBe(200);
    expect((await server.api("GET", "/api/screens/bridge")).status).toBe(200);
  });

  it("reports whether a token is needed and valid, and the public URL", async () => {
    expect((await server.api("GET", "/api/session")).body).toEqual({
      tokenRequired: true,
      tokenValid: false,
      publicUrl: "http://10.0.0.5:3010",
      ai: null,
    });
    expect((await server.api("GET", "/api/session", undefined, { token: TOKEN })).body).toMatchObject({ tokenValid: true });
  });
});

describe("without an editor token", () => {
  it("reports that none is needed", async () => {
    expect((await server.api("GET", "/api/session")).body).toEqual({ tokenRequired: false, tokenValid: true, publicUrl: null, ai: null });
  });
});
