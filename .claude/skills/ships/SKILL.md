---
name: ships
description: Turn a 3D model of a ship (or a shuttle, station or other vessel) into schematic line art for the ship-schematic widget - top, side and front views, systems, and a turning 3D lines plan. Use when someone hands over a .blend, .fbx, .obj or .gltf model, asks for tactical, engineering or damage control views of a ship class, wants another class next to the Norway, or a model changed and its views need tracing again.
---

# Ship line art from a 3D model

The `ship-schematic` widget (`packages/core/src/catalog/shipSchematic.ts`, renderer
`packages/themes/src/base/BaseShip.tsx`) draws a ship from data traced out of a model once, offline:
`packages/themes/src/ships/<class>.json`. Nothing 3D runs in the browser; the turning view is a lines plan
projected in SVG. The tools are in `tools/ships/` (Python with Blender as the `bpy` module); its README lists
what each output is. The Norway class (`norway.config.json`) is the worked example for every step below.

```
model.blend ─ blender_survey.py ─▶ you write <class>.config.json ─▶ confirm the systems with the owner
            ─ blender_dump.py ──▶ geometry.npz (triangles, parts, windows, depth maps)
            ─ blender_lineart.py top|side|front ─▶ Freestyle strokes + alpha renders
            ─ build.py ─▶ packages/themes/src/ships/<class>.json ─ preview.py ─▶ check by eye
            ─▶ SHIP_CLASSES + ships record ─▶ tests ─▶ look at it in the app, every view, mode and theme
```

## 1. Set up (once per container)

- `bpy` only exists for one Python: the wheel for Blender 5.2 is `cp313`. Read the version from the file's
  header before choosing: `head -c 17 model.blend` gives `BLENDER17-01v0502` for 5.2 (older files say
  `BLENDER-v405` for 4.5). A newer `bpy` opens older files; an older one cannot open newer files.
- Rendering without a screen needs software OpenGL: `apt-get install -y libegl1 libgl1-mesa-dri libgles2`.
  `EGL Error (0x3009): EGL_BAD_MATCH` lines are harmless; renders still save. Missing texture warnings are too:
  only geometry matters.
- Work in a venv in the scratchpad, never in the repo: `python3 -m venv venv && venv/bin/pip install bpy numpy
  scipy scikit-image pillow`. Extract uploaded archives into their own empty directory and run Python with `-I`.
- To stop a background render or server, never `pkill -f <pattern>`: the pattern is in your own shell's command
  line and kills it. Match the exact command: `ps -eo pid,args | awk '$2=="node" && $3=="…" {print $1}'`.

## 2. Survey the model

```bash
venv/bin/python -I tools/ships/blender_survey.py model.blend out/survey [Object,Object]
```

It prints every mesh with its bounding box, polygon count, modifiers and materials; the loose parts of the
objects you name (sorted port to starboard, bow to stern); and renders six sides with each object in its own
colour. Read the renders before you read names. Settle:

- **Orientation.** The tools expect the bow towards -Y, port towards +X, Z up. Port is the side with the red
  navigation light. If the model faces elsewhere, rotate it in Blender, apply the rotation and save a copy; do
  not teach the scripts another frame.
- **Units.** Metres, at the real size (the Norway model is 358 m, canon about 364). A model in centimetres or
  arbitrary units makes LENGTH readouts and every tolerance below wrong; scale it and apply the scale.
- **What is the ship and what is not.** Cameras, lens rigs, reference figures, lights, interiors, shield
  bubbles and lighting helpers are not structure. List the structural objects (`structure`) and the subset that
  makes good lines (`lineart`).
- **Other formats.** Import into Blender first (`bpy.ops.import_scene.gltf`, `bpy.ops.wm.obj_import`,
  `bpy.ops.import_scene.fbx`) and save a `.blend`.

## 3. Write `<class>.config.json`

Copy `tools/ships/norway.config.json`. All coordinates are Blender's.

| Field | What it is | Notes |
|---|---|---|
| `id`, `name`, `decks` | Class id (also the JSON's name), display name, deck count for deck lines | |
| `structure` | Objects that make up the solid ship | Used for outlines, depth maps, the lines plan, visibility |
| `lineart` | Objects Freestyle traces | Leave out panel-line meshes, plating, greebles and subdivided glass |
| `windows` | One object of window quads, or leave it out | Each loose part becomes a dash where it faces a view |
| `parts` | The systems, one entry per piece | See below |
| `conduits` | Polylines power runs along in engineering mode | Drawn by hand: core to nacelles, impulse, deflector |
| `sections` | Station spacing, waterline and buttock planes for the turning view | About 30 stations, 5 and 5 |

A part is `{ id, system, label }` plus where its triangles come from:

- `objects`: whole objects. Add `box: [[minX, minY, minZ], [maxX, maxY, maxZ]]` to keep only the triangles
  whose centre lies inside it. Boxes split mirrored objects into port and starboard (x > 0 is port) and carve a
  system out of the hull (the nacelles are hull triangles beyond |x| = 84).
- `cylinder: { from, to, radius }` stands in for what the model does not have, such as a warp core inside a
  hull with no interior. It is drawn see-through in every view.

`system` must be one of `SHIP_SYSTEMS` (bridge, deflector, warp-core, nacelles, impulse, phasers, torpedoes,
shuttlebay). Several parts can share one; the label goes to the part nearest the edge of the drawing.

**Confirm the systems with the owner before building on them.** Object names mislead: the Norway model's
`Launchers` are four blocks on the saucer rim, while the torpedo launcher is `LaunchersBottom` under the hull
(the owner pointed that out). Show the survey renders or `preview.py` with each part in its colour and ask.

## 4. Trace

```bash
T=tools/ships OUT=/tmp/<class>
venv/bin/python -I $T/blender_dump.py model.blend $T/<class>.config.json $OUT
for view in top side front; do venv/bin/python -I $T/blender_lineart.py model.blend $T/<class>.config.json $OUT $view & done; wait
venv/bin/python -I $T/build.py $T/<class>.config.json $OUT packages/themes/src/ships/<class>.json
venv/bin/python -I $T/preview.py packages/themes/src/ships/<class>.json $OUT/preview.png
```

The dump takes seconds, each line-art render about a minute on 500k polygons (they run in parallel), the build
about 20 s. Changing only `parts` or `conduits` needs the dump and build again, not the line art; changing
`lineart` needs only the line art and build.

## 5. Check the data, then tune

Open `preview.png`: three flat views with every system in its colour (dashed where the hull hides it, a dot on
its label anchor) and the lines plan from four angles. Then check the size: aim for 200 KB or less per class
(the Norway is 180 KB, 55 KB compressed); every class ships in the display bundle.

| Looks wrong | Turn this |
|---|---|
| Every hull panel drawn, data too big | Take plating and outline meshes out of `lineart`; lower `CREASE_DEGREES` in `blender_lineart.py` (115 now; lower keeps only sharper creases) |
| Concentric rings on glass or domes | Subdivided glass in `lineart`: take it out, keep it as a part |
| Lines too fine or too coarse | `length(page) < 1.2` (shortest stroke kept) and the 4 m split between `lines` and `detail` in `build.py` |
| Lines plan full of fragments or vertical walls | Pits where rays slipped into openings: the `grey_opening`/`grey_closing` size (9 cells of 0.4 m) in `build.py` |
| A system shows dashed where you can see it | `visible_share` threshold (0.25) or the 0.8 m surface tolerance; it is a heuristic |
| Labels point at the wrong piece | The part split (`box`), or several parts per system: the label takes the one nearest the edge |

Two approaches that did not work, so you need not try them: Blender's voxel remesh of the hull (open,
overlapping shells come back as thin crusts that slice into slivers) and filling slices of the raw mesh (gaps
between panels leak). The depth hull (the intersection of three depth maps) is what the build uses.

## 6. Wire the class in

1. Add the id to `SHIP_CLASSES` in `packages/core/src/catalog/shipSchematic.ts`.
2. Import the JSON in `packages/themes/src/ships/model.ts` and add it to `ships`.
3. `pnpm test`: `ships.test.ts` checks every class in `SHIP_CLASSES` has data, and runs for each one (outlines
   and anchors inside their boxes, unique parts, conduits inside the hull, a decodable lines plan).
4. If the class lacks a system the screens rely on, nothing breaks: labels and marks for a system with no parts
   are skipped.

## 7. Look at it

Build (`pnpm build`), start a server on a scratch data directory and publish a screen with a 2×2 grid of
`ship-schematic` widgets (top tactical, side engineering, front damage, turn), as `tests/e2e/showcase.spec.ts`
does in "showcase ship". Screenshot it at 1920×1080 and 3840×2160 in LCARS, HUD and Terminal, in the normal,
red alert and damaged states, and a dorsal view in a tall box (it must stand bow up, port on the left). Wait
three seconds after loading: the drawing sweeps in. `SHOWCASE=ship pnpm test:e2e showcase` captures the demo
screens.

## Other kinds of models

- **Other fleets and eras.** The systems are Trek words. Map what you can (main engines to `nacelles` or
  `impulse`, a reactor to `warp-core`, point defence to `phasers`). If a genre needs its own (`reactor`,
  `hangar`, `railguns`), add it to `SHIP_SYSTEMS` with a name in `SYSTEM_NAMES`, a tone in `ACTIVE_TONES` and
  a place in `MODE_SYSTEMS` (`packages/themes/src/ships/layout.ts`), and extend the catalog tests. Adding is
  safe for saved screens; renaming or removing breaks them.
- **Without a clear bow** (stations, starbases): pick a front and rotate the model so it faces -Y. Top, side and
  front still read; the turning view suits them best. A ring station may want fewer stations and more
  waterlines.
- **Small craft** (shuttles, fighters): fewer decks (`decks` 1 to 3), closer section spacing (`step` 2 to 4 m),
  a higher `PIXELS_PER_METRE` in `blender_lineart.py` so Freestyle samples the small hull finely, and the limits
  in `build.py` that are in metres (shortest stroke, the 4 m line split, the simplify tolerances) scaled down to
  the craft.
- **Very heavy models** (millions of polygons): Freestyle time grows with them. Keep `lineart` to the hull and
  the parts that read in a schematic; interiors and greebles add strokes nobody sees at display size.
- **Not a vessel at all** (a planet base, a creature): the tools still trace views and a lines plan, but the
  widget speaks of bows, decks and shields. Write a widget of its own that reads the same data format rather
  than stretching this one.

## Done when

- The owner has confirmed which parts are which systems.
- `preview.py` looks right in every view; the data is under about 200 KB.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm knip` pass.
- You have looked at every view and mode in every theme, in a tall box, and in red alert and damaged states.
- Screenshots, the showcase page (`docs/showcase/README.md`) and the acceptance guide are updated if the class
  ships in the demo.
