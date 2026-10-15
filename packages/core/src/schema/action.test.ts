import { describe, expect, it } from "vitest";
import { ActionSchema, ActionsSchema, isServerAction } from "./action.ts";

describe("actions", () => {
  it.each([
    { do: "navigate", screen: "schematic" },
    { do: "back" },
    { do: "setState", state: "red-alert" },
    { do: "setSignal", signal: "shields", value: 100 },
    { do: "setSignal", signal: "shields", delta: -10 },
    { do: "setSignal", signal: "impulse" },
    { do: "video", target: "viewscreen", command: "play" },
    { do: "sound", sound: "klaxon" },
  ])("accepts $do", (action) => {
    expect(ActionSchema.safeParse(action).success).toBe(true);
  });

  it("rejects a setSignal with both a value and a delta", () => {
    expect(ActionSchema.safeParse({ do: "setSignal", signal: "shields", value: 1, delta: 1 }).success).toBe(false);
  });

  it("rejects unknown actions and extra fields", () => {
    expect(ActionSchema.safeParse({ do: "selfDestruct" }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "back", screen: "bridge" }).success).toBe(false);
  });

  it("allows at most eight actions on one control", () => {
    expect(ActionsSchema.safeParse(Array.from({ length: 9 }, () => ({ do: "back" }))).success).toBe(false);
  });

  it("knows which actions the server runs", () => {
    expect(isServerAction({ do: "navigate", screen: "x" })).toBe(true);
    expect(isServerAction({ do: "setState", state: "x" })).toBe(true);
    expect(isServerAction({ do: "sound", sound: "x" })).toBe(false);
    expect(isServerAction({ do: "video", target: "x", command: "play" })).toBe(false);
  });
});
