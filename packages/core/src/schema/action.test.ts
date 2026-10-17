import { describe, expect, it } from "vitest";
import { ActionSchema, ActionsSchema, actionTarget, isRemoteAction, isServerAction } from "./action.ts";

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
    { do: "sound", sound: "klaxon", on: "all" },
    { do: "navigate", screen: "alarm", on: "others", after: 1.5 },
    { do: "back", on: { displays: ["bridge-1"] } },
    { do: "video", target: "viewscreen", command: "play", on: { screens: ["bridge"] } },
    { do: "trigger", target: "launch", on: { displays: ["helm-1"], screens: ["engineering"] } },
    { do: "setState", state: "red-alert", after: 3 },
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

  it("rejects targets that name nothing, unsafe ids and long waits", () => {
    expect(ActionSchema.safeParse({ do: "sound", sound: "x", on: {} }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "sound", sound: "x", on: { displays: [] } }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "sound", sound: "x", on: { displays: ["../x"] } }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "sound", sound: "x", on: "everyone" }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "sound", sound: "x", after: -1 }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "sound", sound: "x", after: 601 }).success).toBe(false);
  });

  it("only lets display actions run elsewhere, and a trigger must say where", () => {
    expect(ActionSchema.safeParse({ do: "setState", state: "x", on: "all" }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "cue", cue: "x", on: "others" }).success).toBe(false);
    expect(ActionSchema.safeParse({ do: "trigger", target: "launch" }).success).toBe(false);
  });

  it("allows at most eight actions on one control", () => {
    expect(ActionsSchema.safeParse(Array.from({ length: 9 }, () => ({ do: "back" }))).success).toBe(false);
  });

  it("knows which actions the server runs", () => {
    expect(isServerAction({ do: "navigate", screen: "x" })).toBe(true);
    expect(isServerAction({ do: "setState", state: "x" })).toBe(true);
    expect(isServerAction({ do: "sound", sound: "x" })).toBe(false);
    expect(isServerAction({ do: "video", target: "x", command: "play" })).toBe(false);
    expect(isServerAction({ do: "sound", sound: "x", on: "others" })).toBe(true);
    expect(isServerAction({ do: "sound", sound: "x", after: 2 })).toBe(true);
    expect(isServerAction({ do: "sound", sound: "x", on: "self", after: 0 })).toBe(false);
    expect(isServerAction({ do: "trigger", target: "x", on: "self" })).toBe(true);
  });

  it("works out where an action runs", () => {
    expect(actionTarget({ do: "sound", sound: "x" })).toBe("self");
    expect(actionTarget({ do: "setState", state: "x" })).toBe("self");
    expect(actionTarget({ do: "back", on: { screens: ["bridge"] } })).toEqual({ screens: ["bridge"] });
    expect(isRemoteAction({ do: "back", on: "all" })).toBe(true);
    expect(isRemoteAction({ do: "back" })).toBe(false);
  });
});
