import { describe, expect, it } from "vitest";
import { NodeSchema } from "../schema/node.ts";
import { nodeInState } from "./when.ts";

const status = NodeSchema.parse({
  id: "status",
  type: "widget",
  kind: "text",
  props: { text: "ALL SYSTEMS NOMINAL", tone: "secondary" },
  when: [
    { state: "red-alert", props: { text: "RED ALERT", tone: "danger" } },
    { state: "blackout", hidden: true },
  ],
});

describe("nodeInState", () => {
  it("returns the node untouched in a state without overrides", () => {
    expect(nodeInState(status, "normal")).toBe(status);
  });

  it("merges the state's props over the node's", () => {
    expect(nodeInState(status, "red-alert")).toMatchObject({ props: { text: "RED ALERT", tone: "danger" } });
  });

  it("hides the node in a state that says so", () => {
    expect(nodeInState(status, "blackout").hidden).toBe(true);
  });

  it("can show a node that is hidden by default", () => {
    const hidden = NodeSchema.parse({
      id: "warning",
      type: "widget",
      kind: "text",
      hidden: true,
      props: { text: "EVACUATE" },
      when: [{ state: "damaged", hidden: false }],
    });
    expect(nodeInState(hidden, "damaged").hidden).toBe(false);
  });

  it("applies several entries for the same state in order", () => {
    const layered = NodeSchema.parse({
      id: "x",
      type: "widget",
      kind: "text",
      props: { text: "a", tone: "info" },
      when: [
        { state: "s", props: { text: "b" } },
        { state: "s", props: { tone: "danger" } },
      ],
    });
    expect(nodeInState(layered, "s")).toMatchObject({ props: { text: "b", tone: "danger" } });
  });

  it("ignores props on a container", () => {
    const container = NodeSchema.parse({
      id: "c",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [],
      when: [{ state: "s", props: { colour: "red" }, hidden: true }],
    });
    const result = nodeInState(container, "s");
    expect(result.hidden).toBe(true);
    expect(result).not.toHaveProperty("props");
  });
});
