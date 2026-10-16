import { applyOps, catalog, findNode, type Op, type Screen, ScreenSchema } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { describe, expect, it } from "vitest";
import {
  addTrackOps,
  flipOps,
  removeTrackOps,
  shareAfterDrag,
  spanAfterDrag,
  tracksAfterDrag,
  weightOps,
  wrapOps,
} from "./layoutTools.ts";

const text = (id: string) => ({ node: { id, type: "widget", kind: "text", props: { text: id } } });

const screen: Screen = ScreenSchema.parse({
  schemaVersion: 2,
  id: "s",
  name: "S",
  root: {
    id: "root",
    type: "container",
    layout: { kind: "stack", direction: "column" },
    children: [
      { weight: 2, ...text("a") },
      text("b"),
      {
        node: {
          id: "cells",
          type: "container",
          layout: { kind: "grid", columns: ["1fr", "1fr", "1fr"], rows: ["1fr", "1fr"], gap: "medium" },
          children: [{ area: { col: 3, row: 2 }, ...text("c") }, { area: { col: 2, row: 1, colSpan: 2 }, ...text("d") }],
        },
      },
    ],
  },
});

const run = (ops: Op[] | undefined, on: Screen = screen): Screen => {
  if (!ops) throw new Error("no ops");
  const result = applyOps(on, ops, { catalog, decor: decorCatalog });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.screen;
};

const grid = (on: Screen) => {
  const node = findNode(on.root, "cells")?.node;
  if (node?.type !== "container" || node.layout.kind !== "grid") throw new Error("no grid");
  return node;
};

describe("shareAfterDrag", () => {
  it("moves room from one neighbour to the other and keeps their total", () => {
    expect(shareAfterDrag([1, 1], [100, 100], 50)).toEqual([1.5, 0.5]);
    expect(shareAfterDrag([2, 1], [200, 100], -100)).toEqual([1, 2]);
  });

  it("never squeezes either below a twentieth of the pair", () => {
    expect(shareAfterDrag([1, 1], [100, 100], 500)).toEqual([1.9, 0.1]);
    expect(shareAfterDrag([10, 10], [100, 100], -500)).toEqual([1, 19]);
  });

  it("leaves the shares alone when there is no room to measure", () => {
    expect(shareAfterDrag([1, 1], [0, 0], 10)).toEqual([1, 1]);
  });
});

describe("weightOps", () => {
  it("sets both weights and drops the default of 1", () => {
    const after = run(weightOps("a", "b", [1, 2]));
    expect(findNode(after.root, "a")?.entry?.weight).toBeUndefined();
    expect(findNode(after.root, "b")?.entry?.weight).toBe(2);
  });
});

describe("tracksAfterDrag", () => {
  it("resizes two neighbouring fr tracks", () => {
    expect(tracksAfterDrag(["1fr", "1fr", "1fr"], 1, [100, 100], -50)).toEqual(["1fr", "0.5fr", "1.5fr"]);
  });

  it("does not drag auto tracks", () => {
    expect(tracksAfterDrag(["auto", "1fr"], 0, [100, 100], 10)).toBeUndefined();
  });
});

describe("grid tracks", () => {
  it("adds a track like the last one", () => {
    expect(grid(run(addTrackOps(screen, "cells", "rows"))).layout).toMatchObject({ rows: ["1fr", "1fr", "1fr"] });
  });

  it("removes the last track and pulls parts back inside", () => {
    const after = run(removeTrackOps(screen, "cells", "columns"));
    expect(grid(after).layout).toMatchObject({ columns: ["1fr", "1fr"] });
    expect(findNode(after.root, "c")?.entry?.area).toEqual({ col: 2, row: 2 });
    expect(findNode(after.root, "d")?.entry?.area).toEqual({ col: 2, row: 1 });
  });

  it("keeps at least one track and at most twelve", () => {
    const one = run(removeTrackOps(run(removeTrackOps(screen, "cells", "rows")), "cells", "rows"), run(removeTrackOps(screen, "cells", "rows")));
    expect(grid(one).layout).toMatchObject({ rows: ["1fr"] });
    expect(removeTrackOps(one, "cells", "rows")).toEqual([]);
    expect(addTrackOps(screen, "a", "rows")).toEqual([]);
  });
});

describe("spanAfterDrag", () => {
  it("spans up to the track under the pointer, at least its own cell", () => {
    expect(spanAfterDrag({ col: 2, row: 1 }, "right", 3)).toEqual({ col: 2, row: 1, colSpan: 2 });
    expect(spanAfterDrag({ col: 2, row: 1, colSpan: 2 }, "right", 1)).toEqual({ col: 2, row: 1 });
    expect(spanAfterDrag({ col: 1, row: 1, colSpan: 2 }, "bottom", 2)).toEqual({ col: 1, row: 1, colSpan: 2, rowSpan: 2 });
  });
});

describe("wrapOps", () => {
  it("puts a part in a new stack in its place, which keeps its weight", () => {
    const wrapped = wrapOps(screen, "a", "row");
    const after = run(wrapped?.ops);
    const stack = findNode(after.root, wrapped?.id ?? "");
    expect(stack?.entry?.weight).toBe(2);
    expect(stack?.node).toMatchObject({ type: "container", layout: { kind: "stack", direction: "row" } });
    expect(findNode(after.root, "a")?.parent?.id).toBe(wrapped?.id);
  });

  it("cannot wrap the root", () => {
    expect(wrapOps(screen, "root", "row")).toBeUndefined();
  });
});

describe("flipOps", () => {
  it("turns a column into a row", () => {
    expect(run(flipOps(screen, "root")).root).toMatchObject({ layout: { direction: "row" } });
    expect(flipOps(screen, "a")).toEqual([]);
  });
});
