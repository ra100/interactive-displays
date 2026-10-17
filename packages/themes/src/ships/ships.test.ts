import { SHIP_CLASSES, SHIP_SYSTEMS, widgets } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import {
  type Fit,
  fitFont,
  flatLayout,
  parsePath,
  PITCH,
  projectTurn,
  stateTone,
  systemState,
  taggedSystems,
  turnGeometry,
  turnHull,
  turnTags,
} from "./layout.ts";
import { decodeLoop, ships } from "./model.ts";

const norway = ships.norway;
const props = (overrides: Record<string, unknown> = {}) => widgets["ship-schematic"].props.parse(overrides);
const VIEWS = ["top", "side", "front"] as const;

describe("ship models", () => {
  it("has line art for every class the widget offers", () => {
    expect(Object.keys(ships).sort()).toEqual([...SHIP_CLASSES].sort());
  });

  it("draws the Norway class at its real size, about 360 by 230 by 50 metres", () => {
    expect(norway.size.length).toBeCloseTo(358, -1);
    expect(norway.size.beam).toBeCloseTo(229, -1);
    expect(norway.size.height).toBeCloseTo(50, -1);
    expect(norway.decks).toBe(13);
  });

  it("marks every system on the Norway class", () => {
    for (const system of SHIP_SYSTEMS) expect(norway.parts.some((part) => part.system === system)).toBe(true);
  });

  const classViews = Object.values(ships).flatMap((ship) => VIEWS.map((view) => ({ ship, view })));

  it.each(classViews)("keeps the $ship.id $view view's outline, parts and their anchors inside its box", ({ ship, view }) => {
    const [x, y, width, height] = ship.views[view].box;
    const inside = ([px, py]: readonly [number, number]) => px >= x - 1 && px <= x + width + 1 && py >= y - 1 && py <= y + height + 1;
    const outline = parsePath(ship.views[view].outline).flat();
    expect(outline.length).toBeGreaterThan(20);
    expect(outline.every(inside)).toBe(true);
    for (const part of ship.parts) {
      expect(part.views[view].path).toMatch(/^M/);
      expect(inside(part.views[view].anchor)).toBe(true);
    }
  });

  it.each(Object.values(ships))("gives $id unique part ids and conduits that start inside the hull", (ship) => {
    expect(new Set(ship.parts.map((part) => part.id)).size).toBe(ship.parts.length);
    for (const conduit of ship.conduits) {
      for (const [x, y, z] of conduit.points) {
        expect(Math.abs(x)).toBeLessThan(ship.size.length / 2 + 2);
        expect(Math.abs(y)).toBeLessThan(ship.size.beam / 2 + 2);
        expect(Math.abs(z)).toBeLessThan(ship.size.height / 2 + 2);
      }
    }
  });

  it("decodes the lines plan into loops of points", () => {
    expect(Array.from(decodeLoop("1 2 3 .5-1 0-2.5 1 1"))).toEqual([1, 2, 3, 1.5, 1, 3, -1, 2, 4]);
    for (const ship of Object.values(ships)) {
      expect(ship.loops.length).toBeGreaterThan(20);
      for (const loop of ship.loops) {
        expect(loop.length % 3).toBe(0);
        for (let index = 0; index < loop.length; index += 3) {
          expect(Math.abs(loop[index] ?? 0)).toBeLessThan(ship.size.length / 2 + 2);
          expect(Math.abs(loop[index + 2] ?? 0)).toBeLessThan(ship.size.height / 2 + 2);
        }
      }
    }
  });
});

describe("parsePath", () => {
  it("reads an absolute move and relative steps", () => {
    expect(parsePath("M1 2l3 0 0 4zM-1-1l.5.5")).toEqual([
      [
        [1, 2],
        [4, 2],
        [4, 6],
      ],
      [
        [-1, -1],
        [-0.5, -0.5],
      ],
    ]);
  });
});

describe("system states", () => {
  it("puts damage before offline before marked before what the mode is about", () => {
    const marks = props({ mode: "tactical", damaged: ["phasers"], offline: ["phasers", "deflector"], highlight: ["deflector", "bridge"] });
    expect(systemState("phasers", marks)).toBe("damaged");
    expect(systemState("deflector", marks)).toBe("offline");
    expect(systemState("bridge", marks)).toBe("marked");
    expect(systemState("torpedoes", marks)).toBe("active");
    expect(systemState("nacelles", marks)).toBeUndefined();
  });

  it("leaves a schematic to its line art and shows every system faintly in damage control", () => {
    expect(systemState("bridge", props())).toBeUndefined();
    expect(systemState("nacelles", props({ mode: "damage" }))).toBe("quiet");
  });

  it("colours weapons as danger and trouble by its kind", () => {
    expect(stateTone("phasers", "active")).toBe("danger");
    expect(stateTone("warp-core", "active")).toBe("accent");
    expect(stateTone("bridge", "damaged")).toBe("danger");
    expect(stateTone("bridge", "offline")).toBe("neutral");
  });

  it("names trouble first, then marks, then the mode's systems, once each", () => {
    expect(taggedSystems(props({ mode: "engineering", damaged: ["nacelles"], highlight: ["bridge"] }))).toEqual([
      "nacelles",
      "bridge",
      "warp-core",
      "impulse",
      "deflector",
    ]);
    expect(taggedSystems(props({ mode: "engineering", labels: false }))).toEqual([]);
  });
});

describe("flat layout", () => {
  const fit: Fit = { width: 900, height: 450, text: 18 };

  it.each(VIEWS)("spreads the %s view's labels along their bands without overlap", (view) => {
    const layout = flatLayout(norway, view, ["warp-core", "nacelles", "impulse", "deflector", "bridge"], false, false, fit);
    expect(layout.tags.length).toBeGreaterThan(0);
    for (const band of ["above", "below"] as const) {
      const tags = layout.tags.filter((tag) => tag.band === band).sort((a, b) => a.x - b.x);
      for (const [index, tag] of tags.entries()) {
        const width = (tag.text.length * 0.62 + 1.2) * layout.font;
        expect(tag.x - width / 2).toBeGreaterThanOrEqual(layout.stage.x - 0.01);
        expect(tag.x + width / 2).toBeLessThanOrEqual(layout.stage.x + layout.stage.width + 0.01);
        const next = tags[index + 1];
        if (next) expect(next.x - tag.x).toBeGreaterThanOrEqual(((tag.text.length + next.text.length) * 0.62 + 2.4) * layout.font * 0.5 - 0.01);
      }
      for (const tag of tags) expect(tag.leader.startsWith(`M${tag.anchor[0].toFixed(1)} ${tag.anchor[1].toFixed(1)}`)).toBe(true);
    }
  });

  it("drops the least important labels when a band is full", () => {
    const narrow = flatLayout(norway, "front", ["deflector", "torpedoes", "phasers", "impulse", "shuttlebay", "warp-core"], false, false, {
      width: 400,
      height: 400,
      text: 26,
    });
    const all = narrow.tags.map((tag) => tag.system);
    expect(all.length).toBeLessThan(6);
    expect(all).toContain("deflector");
  });

  it("holds the whole outline inside the shield bubble", () => {
    for (const view of VIEWS) {
      const { shield } = flatLayout(norway, view, [], false, true, fit);
      if (!shield) throw new Error("no shield");
      for (const [x, y] of parsePath(norway.views[view].outline).flat()) {
        expect(((x - shield.cx) / shield.rx) ** 2 + ((y - shield.cy) / shield.ry) ** 2).toBeLessThanOrEqual(1);
      }
    }
  });

  it("stands the top view bow up when turned", () => {
    const flat = flatLayout(norway, "top", [], false, false, fit);
    const turned = flatLayout(norway, "top", [], true, false, fit);
    expect(turned.box.width).toBeCloseTo(flat.box.height);
    expect(turned.box.height).toBeCloseTo(flat.box.width);
  });

  it("sizes labels to the measured text whichever way the stage is limited", () => {
    const frame = { x: 0, y: 0, width: 400, height: 100 };
    const wide = fitFont(frame, 4.8, { width: 800, height: 600, text: 20 });
    expect(wide * (800 / 400)).toBeCloseTo(20);
    const tall = fitFont(frame, 4.8, { width: 4000, height: 300, text: 20 });
    const scale = 300 / (frame.height + 4.8 * tall);
    expect(tall * scale).toBeCloseTo(20);
    expect(fitFont(frame, 4.8, undefined)).toBeGreaterThan(0);
  });
});

describe("turning view", () => {
  it("sees the port side at yaw 0 from a little above", () => {
    const point = projectTurn(0, 10, 20, 5);
    expect(point.x).toBeCloseTo(10);
    expect(point.y).toBeCloseTo(20 * Math.sin(PITCH) - 5 * Math.cos(PITCH));
    expect(projectTurn(0, 0, 50, 0).depth).toBeGreaterThan(projectTurn(0, 0, -50, 0).depth);
  });

  it("keeps the ship on its stage at every angle", () => {
    const { stage } = turnGeometry(norway);
    for (let step = 0; step < 12; step += 1) {
      const yaw = (step / 12) * Math.PI * 2;
      for (const loop of norway.loops) {
        for (let index = 0; index < loop.length; index += 3) {
          const point = projectTurn(yaw, loop[index] ?? 0, loop[index + 1] ?? 0, loop[index + 2] ?? 0);
          expect(point.x).toBeGreaterThanOrEqual(stage.x);
          expect(point.x).toBeLessThanOrEqual(stage.x + stage.width);
          expect(point.y).toBeGreaterThanOrEqual(stage.y);
          expect(point.y).toBeLessThanOrEqual(stage.y + stage.height);
        }
      }
    }
  });

  it("splits the lines plan into a far and a near half", () => {
    const hull = turnHull(norway, 0.7);
    expect(hull.far.length).toBeGreaterThan(100);
    expect(hull.near.length).toBeGreaterThan(100);
  });

  it("stands labels in two columns with leaders to the markers", () => {
    const stage = { x: -100, y: -50, width: 200, height: 100 };
    const tags = turnTags(
      [
        { system: "bridge", at: [10, 5] },
        { system: "deflector", at: [-20, 0] },
        { system: "nacelles", at: [30, -10] },
      ],
      stage,
      5,
    );
    expect(tags.map((tag) => [tag.system, tag.side])).toEqual([
      ["bridge", "left"],
      ["nacelles", "left"],
      ["deflector", "right"],
    ]);
    expect(tags[0]?.leader.startsWith("M10.0 5.0")).toBe(true);
  });
});
