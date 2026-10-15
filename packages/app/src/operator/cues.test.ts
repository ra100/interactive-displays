import { CueListSchema, ShowSchema } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { sampleOverview } from "../testing/fixtures.ts";
import { cueFromNow, cueSummary, moveCue } from "./cues.ts";

const withSignals = () =>
  sampleOverview({
    state: "red-alert",
    show: ShowSchema.parse({
      ...sampleOverview().show,
      signals: [
        { id: "shields", label: "Shields", scope: "shared", source: { kind: "manual", initial: 30 } },
        { id: "warp.output", label: "Warp", scope: "shared", source: { kind: "walk", min: 0, max: 100 } },
      ],
      cues: [{ id: "first-hit", label: "First hit", state: "red-alert" }],
    }),
  });

describe("cues", () => {
  it("records the state, shared manual values and screen assignments on air now", () => {
    expect(cueFromNow(withSignals(), { shields: 40, "warp.output": 77 }, "First hit")).toEqual({
      id: "first-hit-2",
      label: "First hit",
      state: "red-alert",
      signals: { shields: 40 },
      screens: { "eng-1": "engineering" },
    });
  });

  it("moves a cue up or down and leaves the ends alone", () => {
    const cues = CueListSchema.parse(["a", "b", "c"].map((id) => ({ id, label: id, state: "normal" })));
    expect(moveCue(cues, "b", -1).map((cue) => cue.id)).toEqual(["b", "a", "c"]);
    expect(moveCue(cues, "b", 1).map((cue) => cue.id)).toEqual(["a", "c", "b"]);
    expect(moveCue(cues, "a", -1).map((cue) => cue.id)).toEqual(["a", "b", "c"]);
  });

  it("sums up what a cue changes", () => {
    const [cue] = CueListSchema.parse([
      { id: "x", label: "X", state: "red-alert", signals: { a: 1, b: 2 }, screens: { d: null }, videos: [{ display: "d", target: "v", command: "play" }] },
    ]);
    expect(cue && cueSummary(cue, sampleOverview())).toBe("Red alert · 2 values · 1 screen · 1 video");
  });
});
