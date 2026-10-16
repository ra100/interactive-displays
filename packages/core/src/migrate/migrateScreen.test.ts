import { describe, expect, it } from "vitest";
import { catalog } from "../catalog/index.ts";
import { SCREEN_SCHEMA_VERSION } from "../schema/screen.ts";
import { validateScreen } from "../validate/validateScreen.ts";
import screenV1 from "./fixtures/screen-v1.json" with { type: "json" };
import { migrateScreen } from "./migrateScreen.ts";

// Fixtures are real documents as an older version saved them; they never change once committed.
const fixtures: Record<string, unknown> = { "screen-v1.json": screenV1 };
const fixture = (name: string): unknown => structuredClone(fixtures[name]);

describe("migrateScreen", () => {
  it("upgrades a v1 screen to the current version", () => {
    const result = validateScreen(fixture("screen-v1.json"), catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SCREEN_SCHEMA_VERSION);
    expect(result.value.revision).toBe(7);
  });

  it("marks the saved v1 revision as published, because v1 screens were on air", () => {
    expect(migrateScreen(fixture("screen-v1.json"))).toMatchObject({ schemaVersion: 2, published: 7 });
  });

  it("treats a v1 screen without a revision as revision 0", () => {
    expect(migrateScreen({ schemaVersion: 1, id: "x" })).toMatchObject({ published: 0 });
  });

  it("leaves current documents untouched", () => {
    const current = { schemaVersion: SCREEN_SCHEMA_VERSION, id: "x", revision: 3 };
    expect(migrateScreen(current)).toBe(current);
  });

  it("returns documents it cannot migrate unchanged, for validation to reject", () => {
    expect(migrateScreen(null)).toBeNull();
    expect(migrateScreen([1])).toEqual([1]);
    expect(migrateScreen({ id: "x" })).toEqual({ id: "x" });
    expect(migrateScreen({ schemaVersion: 99 })).toEqual({ schemaVersion: 99 });
    expect(validateScreen({ ...(fixture("screen-v1.json") as object), schemaVersion: 99 }, catalog).ok).toBe(false);
  });

  it("does not modify its input", () => {
    const input = fixture("screen-v1.json");
    const copy = structuredClone(input);
    migrateScreen(input);
    expect(input).toEqual(copy);
  });
});
