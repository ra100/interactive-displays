import type { LintIssue, Screen, ValidationIssue } from "@interactive-displays/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestServer } from "../testing/testServer.ts";

interface CatalogBody {
  widgets: Array<{ kind: string; props: { properties: object } }>;
  archetypes: object;
  effects: string[];
  themes: Array<{ id: string; variants: object; decor: Array<{ kind: string }> }>;
}

interface ShowBody {
  state: string;
  screens: Array<{ id: string }>;
  displays: Array<{ id: string }>;
}

interface ScreenBody {
  screen: Screen;
  lint: LintIssue[];
}

interface IssuesBody {
  issues: ValidationIssue[];
}

const server = createTestServer();

beforeEach(async () => {
  await server.setup();
  await server.start();
});
afterEach(server.teardown);

describe("GET /api/catalog", () => {
  it("describes widgets as JSON Schema, plus archetypes, effects and themes", async () => {
    const { status, body } = await server.api<CatalogBody>("GET", "/api/catalog");

    expect(status).toBe(200);
    expect(body.widgets.map((widget) => widget.kind)).toEqual(["title", "text", "button"]);
    expect(body.widgets[2]?.props.properties).toHaveProperty("label");
    expect(Object.keys(body.archetypes)).toEqual(["sidebar", "header-main", "dashboard"]);
    expect(body.effects).toContain("blackout");

    const lcars = body.themes.find((theme) => theme.id === "lcars");
    expect(lcars?.variants).toEqual({ nemesis: "Nemesis blue", picard: "Picard grey" });
    expect(lcars?.decor.map((decor) => decor.kind)).toContain("lcars.elbow");
  });
});

describe("GET /api/show", () => {
  it("lists screens and every known display with what it shows", async () => {
    await server.display("d-new123");
    const { body } = await server.api<ShowBody>("GET", "/api/show");

    expect(body.state).toBe("normal");
    expect(body.screens.map((screen) => screen.id)).toEqual([
      "bridge",
      "engineering",
      "standby",
      "tactical",
    ]);
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
    });
  });
});

describe("screens", () => {
  it("returns a screen with its lint report", async () => {
    const { status, body } = await server.api<ScreenBody>("GET", "/api/screens/bridge");

    expect(status).toBe(200);
    expect(body.screen).toMatchObject({ id: "bridge", revision: 0 });
    expect(body.lint).toEqual([]);
  });

  it("returns 404 for a missing screen and 400 for a bad id", async () => {
    expect((await server.api("GET", "/api/screens/nope")).status).toBe(404);
    expect((await server.api("GET", "/api/screens/Not%20An%20Id")).status).toBe(400);
  });

  it("creates a screen and reports lint for it", async () => {
    const { status, body } = await server.api<ScreenBody>("POST", "/api/screens", {
      schemaVersion: 1,
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
    expect(stale).toEqual({ status: 409, body: { error: "The screen changed; reload it", revision: 1 } });
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

describe("state and displays", () => {
  it("sets the show state", async () => {
    expect(await server.api("POST", "/api/state", { state: "yellow-alert" })).toEqual({
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

  it("identifies a display", async () => {
    expect(await server.api("POST", "/api/displays/test/identify")).toEqual({
      status: 200,
      body: { label: "Test display" },
    });
  });
});
