import { describe, expect, it } from "vitest";
import { type Screen, ScreenSchema } from "../schema/screen.ts";
import { ShowSchema } from "../schema/show.ts";
import { lintScreen } from "./lintScreen.ts";

const screenWith = (root: unknown): Screen => ScreenSchema.parse({ schemaVersion: 2, id: "s", name: "S", root });

const button = (id: string, label: string) => ({ node: { id, type: "widget", kind: "button", props: { label } } });

const rules = (screen: Screen, context = {}) => lintScreen(screen, context).map((issue) => issue.rule);

describe("lintScreen", () => {
  it("is quiet for a reasonable screen", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "frame", archetype: "sidebar" },
      children: [{ slot: "nav", ...button("a", "WARP CORE") }, { slot: "main", ...button("b", "ENGAGE") }],
    });
    expect(lintScreen(screen)).toEqual([]);
  });

  it("flags empty containers and frames without main", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "frame", archetype: "sidebar" },
      children: [],
    });
    expect(rules(screen)).toEqual(["empty-container", "frame-without-main"]);
  });

  it("flags crowded stacks", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: Array.from({ length: 13 }, (_, index) => button(`b${index}`, `B${index}`)),
    });
    expect(rules(screen)).toContain("crowded-stack");
  });

  it("flags duplicate and long labels, with a tighter limit in nav", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "frame", archetype: "sidebar" },
      children: [
        { slot: "main", ...button("a", "ENGAGE") },
        { slot: "main", ...button("b", "engage") },
        { slot: "nav", ...button("c", "INERTIAL DAMPENERS X") },
      ],
    });
    const issues = lintScreen(screen);
    expect(issues.map((issue) => [issue.rule, issue.nodeId])).toEqual([
      ["duplicate-label", "b"],
      ["label-length", "c"],
    ]);
  });

  it("flags canvas children without a rect", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "canvas" },
      children: [button("a", "A"), { rect: { x: 0, y: 0, w: 0.5, h: 0.5 }, ...button("b", "B") }],
    });
    expect(lintScreen(screen).map((issue) => issue.nodeId)).toEqual(["a"]);
  });

  it("flags overrides for states the show does not have", () => {
    const show = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } });
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: { id: "a", type: "widget", kind: "button", props: { label: "A" }, when: [{ state: "red-alert", hidden: true }] } }],
    });
    expect(rules(screen, { show })).toEqual(["unknown-state"]);
  });

  it("flags buttons that run a cue the show does not have", () => {
    const show = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" }, cues: [{ id: "go", label: "Go", state: "normal" }] });
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [
        { node: { id: "a", type: "widget", kind: "button", props: { label: "A" }, actions: [{ do: "cue", cue: "go" }] } },
        { node: { id: "b", type: "widget", kind: "button", props: { label: "B" }, actions: [{ do: "cue", cue: "gone" }] } },
      ],
    });
    expect(lintScreen(screen, { show }).filter((issue) => issue.rule === "unknown-cue").map((issue) => issue.nodeId)).toEqual(["b"]);
  });

  it("flags live values that change in states the show does not have", () => {
    const show = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } });
    const gauge = {
      id: "g",
      type: "widget",
      kind: "gauge",
      props: { label: "OUTPUT" },
      bind: { value: { ambient: { kind: "walk", min: 1, max: 2 }, byState: { "red-alert": { max: 9 }, normal: { min: 0 } } } },
    };
    const screen = screenWith({ id: "root", type: "container", layout: { kind: "stack", direction: "row" }, children: [{ node: gauge }] });
    expect(lintScreen(screen, { show }).map((issue) => issue.message)).toEqual([
      'A live value changes in "red-alert", which the show does not have',
    ]);
  });

  it("flags placeholders still waiting to be filled", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: { id: "p", type: "widget", kind: "placeholder", props: { intent: "Containment status" } } }],
    });
    expect(lintScreen(screen).map((issue) => issue.message)).toEqual([
      'Still a placeholder for "Containment status"; Regenerate fills it',
    ]);
  });

  it("notes decor from another theme", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: { id: "d", type: "decor", kind: "lcars.elbow" } }],
    });
    expect(rules(screen, { decor: new Map() })).toEqual(["foreign-decor"]);
  });

  describe("live values and actions", () => {
    const show = ShowSchema.parse({
      schemaVersion: 1,
      id: "demo",
      name: "Demo",
      theme: { id: "base" },
      states: [{ id: "normal", label: "Normal" }],
      signals: [
        { id: "shields", label: "Shields", scope: "shared", source: { kind: "manual" } },
        { id: "warp", label: "Warp", scope: "shared", source: { kind: "walk", min: 0, max: 1 } },
      ],
    });

    const control = (bind: unknown, actions: unknown[]) =>
      screenWith({
        id: "root",
        type: "container",
        layout: { kind: "stack", direction: "column" },
        children: [
          { node: { id: "go", type: "widget", kind: "slider", props: { label: "GO" }, bind, actions } },
          { node: { id: "clip", type: "widget", kind: "video", props: { asset: "a.mp4" } } },
        ],
      });

    it("is quiet when everything exists", () => {
      const screen = control({ value: { signal: "shields" } }, [
        { do: "setSignal", signal: "shields" },
        { do: "setState", state: "normal" },
        { do: "navigate", screen: "bridge" },
        { do: "video", target: "clip", command: "play" },
      ]);
      expect(rules(screen, { show, screens: new Set(["bridge"]) })).toEqual([]);
    });

    it("flags missing signals, states, screens and videos", () => {
      const screen = control({ value: { signal: "nope" } }, [
        { do: "setState", state: "red-alert" },
        { do: "navigate", screen: "nowhere" },
        { do: "video", target: "go", command: "play" },
        { do: "setSignal", signal: "missing" },
      ]);
      expect(rules(screen, { show, screens: new Set(["bridge"]) })).toEqual([
        "unknown-signal",
        "unknown-state",
        "unknown-screen",
        "video-target",
        "unknown-signal",
      ]);
    });

    it("checks what it can of actions on other displays", () => {
      const fine = control(undefined, [
        { do: "video", target: "elsewhere", command: "play", on: { screens: ["bridge"] } },
        { do: "trigger", target: "launch", on: "others" },
        { do: "trigger", target: "go", on: "self" },
      ]);
      expect(rules(fine, { show, screens: new Set(["bridge"]) })).toEqual([]);

      const wrong = control(undefined, [
        { do: "sound", sound: "alert", on: { screens: ["nowhere"] } },
        { do: "trigger", target: "clip", on: "self" },
      ]);
      expect(rules(wrong, { show, screens: new Set(["bridge"]) })).toEqual(["unknown-screen", "trigger-target"]);
    });

    it("flags controls that try to set a signal nobody can set", () => {
      expect(rules(control(undefined, [{ do: "setSignal", signal: "warp" }]), { show })).toEqual(["signal-not-settable"]);
    });
  });
});
