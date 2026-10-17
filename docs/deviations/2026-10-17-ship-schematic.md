# Deviation: ship schematic traced from a 3D model

## Date
2026-10-17

## Original Plan
Ship cutaways and schematics are `image` widgets showing an uploaded picture (the demo used a hand-drawn
`schematic.svg`), "later with callouts". The LCARS reference lists ship line art that draws itself as not drawn
yet.

## What Changed
1. **`ship-schematic` widget** (category `tactical`): the Norway class from above, the side or the front, or
   turning in three dimensions. Props: `view` (`top`, `side`, `front`, `turn`), `mode` (`schematic`,
   `tactical`, `engineering`, `damage`), `highlight`, `damaged` and `offline` (lists of ship systems),
   `shields`, `armed` and `power` (bindable), `labels`, `seconds` (one turn) and `tone`. Systems are a fixed
   vocabulary: bridge, deflector, warp core, nacelles, impulse, phasers, torpedoes, shuttlebay.
2. **Ship data in the themes package** (`packages/themes/src/ships/`): line art, outlines, system parts, windows,
   deck lines, power conduits and a lines plan for each class, in metres, checked against a Zod schema on load.
   It is drawn with the theme's tones like any other widget, so a ship re-skins with the show.
3. **Extraction tools** (`tools/ships/`, Python with Blender's `bpy` module) that make that data from a
   `.blend` file; the model itself stays out of the repository. A playbook skill (`.claude/skills/ships`)
   covers adding other ships and other kinds of models.
4. **Generation**: `ship-schematic` is an instrument a recipe system can list. The Starship pack shows it for
   shields, alert, EPS, structure, shuttlebay and deflector.
5. **Demo show**: the `schematic` screen is now a master systems display built from four ship schematics, and
   the tactical screen plots the ship beside its weapon controls. The `schematic.svg` asset stays in the seed.

## Justification
A real model gives believable, consistent line art in every view and at any size, which a picture cannot: the
same drawing turns bow up in a tall box, re-colours with the theme and the show's state, marks systems that the
screen names and follows live values (shields, power). Storing meaning (systems, modes) rather than pictures keeps
documents themeable, as the rest of the system does. Tracing once offline keeps the browser free of 3D engines:
the turning view is an SVG lines plan projected at 20 frames a second.

## Impact
New widget, new data and new instrument only; existing screens and packs are unchanged apart from the two demo
screens. The display bundle grows by the Norway data (about 180 KB, 55 KB compressed); further classes add about
as much each. A class is one entry in `SHIP_CLASSES` (core) and one data file (themes).
