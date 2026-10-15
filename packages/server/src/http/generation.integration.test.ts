import type { ContentPack, LintIssue, Screen } from "@interactive-displays/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestServer } from "../testing/testServer.ts";

const server = createTestServer();

beforeEach(async () => {
  await server.setup();
  await server.start();
});
afterEach(server.teardown);

interface Generated {
  screens: Screen[];
  lint: LintIssue[][];
}

describe("generation over REST", () => {
  it("lists the built-in packs", async () => {
    const { status, body } = await server.api<{ packs: ContentPack[] }>("GET", "/api/content");
    expect(status).toBe(200);
    expect(body.packs.map((pack) => pack.id)).toEqual(["trek"]);
    expect(body.packs[0]?.recipes.length).toBeGreaterThanOrEqual(9);
  });

  it("generates a draft from a section and the same one again from the same seed", async () => {
    const first = await server.api<Generated>("POST", "/api/generate", { section: "trek/tactical", seed: 42, id: "weapons" });
    expect(first.status).toBe(201);
    expect(first.body.screens[0]).toMatchObject({ id: "weapons", section: "tactical", revision: 0, generator: { recipe: "trek/tactical", seed: 42 } });
    expect(first.body.lint[0]?.filter((issue) => issue.level === "warning")).toEqual([]);
    const again = await server.api<Generated>("POST", "/api/generate", { section: "tactical", seed: 42, id: "weapons-2" });
    expect(again.body.screens[0]?.root).toEqual(first.body.screens[0]?.root);
  });

  it("generates a suite and refuses unknown sections and taken ids", async () => {
    const suite = await server.api<Generated>("POST", "/api/generate", { section: "trek/medical", seed: 1, suite: true });
    expect(suite.body.screens.map((screen) => screen.id)).toEqual(["medical", "medical-vitals", "medical-biobed", "medical-quarantine"]);
    expect((await server.api("POST", "/api/generate", { section: "trek/lounge" })).status).toBe(404);
    expect((await server.api("POST", "/api/generate", { section: "trek/medical", id: "medical" })).status).toBe(409);
    expect((await server.api("POST", "/api/generate", { section: "trek/medical", seed: -1 })).status).toBe(400);
  });

  it("regenerates around locked parts and rerolls one panel", async () => {
    const { body } = await server.api<Generated>("POST", "/api/generate", { section: "trek/science", seed: 3, archetype: "sidebar" });
    const screen = body.screens[0];
    if (!screen) throw new Error("no screen");
    const locked = await server.api<{ screen: Screen }>("POST", `/api/screens/${screen.id}/ops`, {
      baseRevision: 0,
      ops: [{ op: "set", id: "title", locked: true }],
    });
    const regenerated = await server.api<{ screen: Screen }>("POST", `/api/screens/${screen.id}/regenerate`, { baseRevision: 1, seed: 9 });
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.screen.generator?.seed).toBe(9);
    const title = (s: Screen) => (s.root.type === "container" ? s.root.children.find((child) => child.node.id === "title")?.node : undefined);
    expect(title(regenerated.body.screen)).toEqual(title(locked.body.screen));

    const grid = regenerated.body.screen.root.type === "container" ? regenerated.body.screen.root.children.find((child) => child.slot === "main" && child.node.type === "container")?.node : undefined;
    const panel = grid?.type === "container" ? grid.children[0]?.node.id : undefined;
    if (!panel) throw new Error("no panel");
    const rerolled = await server.api<{ screen: Screen }>("POST", `/api/screens/${screen.id}/regenerate`, { baseRevision: 2, nodes: [panel], seed: 5 });
    expect(rerolled.status).toBe(200);
    expect(rerolled.body.screen.revision).toBe(3);
    expect((await server.api("POST", `/api/screens/${screen.id}/regenerate`, { baseRevision: 3, nodes: ["title"] })).status).toBe(422);
    expect((await server.api("POST", `/api/screens/${screen.id}/regenerate`, { baseRevision: 1 })).status).toBe(409);
  });

  it("saves a show's own recipe, which the generator then uses", async () => {
    const { body } = await server.api<{ packs: ContentPack[] }>("GET", "/api/content");
    const medical = body.packs[0]?.recipes.find((recipe) => recipe.id === "medical");
    if (!medical) throw new Error("no medical recipe");
    const hydroponics = { ...medical, id: "hydroponics", label: "Hydroponics", code: "HYD", titles: ["HYDROPONICS BAY"] };
    expect((await server.api("PUT", "/api/content/trek/recipes", hydroponics)).status).toBe(200);
    expect((await server.api("PUT", "/api/content/trek/recipes", { ...hydroponics, blocks: { prefer: ["nope"] } })).status).toBe(422);
    expect((await server.api("PUT", "/api/content/trek/recipes", { id: "x" })).status).toBe(400);
    expect((await server.api("PUT", "/api/content/elsewhere/recipes", hydroponics)).status).toBe(404);

    const made = await server.api<Generated>("POST", "/api/generate", { section: "trek/hydroponics", seed: 2 });
    expect(made.body.screens[0]?.name).toBe("Hydroponics");

    // Saved with the show: still there after a restart.
    await server.stop();
    await server.start();
    const after = await server.api<{ packs: ContentPack[] }>("GET", "/api/content");
    expect(after.body.packs[0]?.recipes.map((recipe) => recipe.id)).toContain("hydroponics");
  });
});
