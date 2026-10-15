import { describe, expect, it } from "vitest";
import { ScreenSchema } from "../schema/screen.ts";
import { outlineScreen } from "./outline.ts";

describe("outlineScreen", () => {
  it("lists every node with its slot, what it is and what it does", () => {
    const screen = ScreenSchema.parse({
      schemaVersion: 2,
      id: "bridge",
      name: "Bridge",
      revision: 3,
      published: 2,
      section: "helm",
      root: {
        id: "root",
        type: "container",
        layout: { kind: "frame", archetype: "sidebar" },
        children: [
          { slot: "title", node: { id: "title", type: "widget", kind: "title", props: { text: "BRIDGE" }, locked: true } },
          {
            slot: "main",
            node: {
              id: "grid",
              type: "container",
              layout: { kind: "grid", columns: ["1fr", "1fr"], rows: ["1fr"] },
              children: [
                { node: { id: "go", type: "widget", kind: "button", props: { label: "ENGAGE" }, actions: [{ do: "setState", state: "red-alert" }] } },
                { node: { id: "hole", type: "widget", kind: "placeholder", props: { intent: "Shield status" }, when: [{ state: "red-alert", hidden: true }] } },
              ],
            },
          },
        ],
      },
    });
    expect(outlineScreen(screen)).toBe(
      [
        "Bridge (bridge) · revision 3 · published 2 · 16:9 · section helm",
        "  root frame sidebar",
        '    title: title title "BRIDGE" [locked]',
        "    main: grid grid 2×1",
        '      go button "ENGAGE" [actions setState]',
        '      hole placeholder "Shield status" [changes in red-alert]',
      ].join("\n"),
    );
  });
});
