import { type Screen, validateScreen, catalog } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { pressTarget, videoIds } from "./press.ts";

const parse = (root: unknown): Screen => {
  const result = validateScreen({ schemaVersion: 2, id: "s", name: "S", root }, catalog);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const screen = parse({
  id: "root",
  type: "container",
  layout: { kind: "stack", direction: "column" },
  children: [
    { node: { id: "go", type: "widget", kind: "button", props: { label: "Go" }, actions: [{ do: "back" }] } },
    { node: { id: "plain", type: "widget", kind: "button", props: { label: "Plain" } } },
    { node: { id: "label", type: "widget", kind: "text", props: { text: "Hi" } } },
    {
      node: {
        id: "panel",
        type: "container",
        layout: { kind: "stack", direction: "row" },
        when: [{ state: "red-alert", hidden: true }],
        children: [
          { node: { id: "inner", type: "widget", kind: "toggle", props: { label: "Lock" }, actions: [{ do: "back" }] } },
          { node: { id: "feed", type: "widget", kind: "video", props: { asset: "feed.mp4" } } },
        ],
      },
    },
    {
      node: {
        id: "standdown",
        type: "widget",
        kind: "button",
        props: { label: "Stand down" },
        hidden: true,
        when: [{ state: "red-alert", hidden: false }],
        actions: [{ do: "setState", state: "normal" }],
      },
    },
  ],
});

describe("pressTarget", () => {
  it("finds a visible control with actions", () => {
    expect(pressTarget(screen, "go", "normal")?.id).toBe("go");
    expect(pressTarget(screen, "inner", "normal")?.id).toBe("inner");
  });

  it("ignores controls without actions, widgets that are not controls and unknown ids", () => {
    expect(pressTarget(screen, "plain", "normal")).toBeUndefined();
    expect(pressTarget(screen, "label", "normal")).toBeUndefined();
    expect(pressTarget(screen, "panel", "normal")).toBeUndefined();
    expect(pressTarget(screen, "nope", "normal")).toBeUndefined();
  });

  it("follows visibility in the current state, including the containers around a control", () => {
    expect(pressTarget(screen, "inner", "red-alert")).toBeUndefined();
    expect(pressTarget(screen, "standdown", "normal")).toBeUndefined();
    expect(pressTarget(screen, "standdown", "red-alert")?.id).toBe("standdown");
  });
});

describe("videoIds", () => {
  it("lists the video widgets on a screen", () => {
    expect(videoIds(screen)).toEqual(["feed"]);
    expect(videoIds(null)).toEqual([]);
  });
});
