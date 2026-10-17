# Ship line art from a 3D model

The `ship-schematic` widget draws ships from data traced out of a Blender model:
`packages/themes/src/ships/<class>.json`. These scripts make that file. The model itself is not in the
repository (the Norway class source is `Norway_2023_MinasTirith_003.blend`, about 90 MB).

What comes out, all in metres in the ship's frame (x aft, y port, z up, centred on the bounding box):

- **Line art** for the top, side and front views: Blender's Freestyle traces the visible silhouettes, borders
  and creases of the structure. Strokes of 4 m or more are `lines`, shorter ones `detail`.
- **Outlines** of each view, traced from the alpha of the same render.
- **Systems** (`parts`): the objects or parts of objects that make up the bridge, deflector, nacelles, phaser
  arrays and so on, each with its outline per view, whether the hull hides it there, and a label anchor.
- **Windows** that face each view, **deck lines** in the side and front views, and the **conduits** power runs
  along from the core (drawn by hand in the config).
- **Lines plan** for the turning view: stations, waterlines and buttocks cut through the solid that depth maps
  along the three axes enclose (works on open, overlapping meshes where a boolean slice would not).

## Running it

Needs Python 3.13 and the `bpy` module (Blender as a library), which renders without a display through
software OpenGL (`libegl1`, `libgl1-mesa-dri`).

```bash
python3 -m venv .venv
.venv/bin/pip install bpy numpy scipy scikit-image pillow

MODEL=path/to/Norway_2023_MinasTirith_003.blend
OUT=/tmp/norway
.venv/bin/python blender_survey.py $MODEL $OUT/survey          # first look: objects, loose parts, six renders
.venv/bin/python blender_dump.py $MODEL norway.config.json $OUT
for view in top side front; do .venv/bin/python blender_lineart.py $MODEL norway.config.json $OUT $view; done
.venv/bin/python build.py norway.config.json $OUT ../../packages/themes/src/ships/norway.json
.venv/bin/python preview.py ../../packages/themes/src/ships/norway.json $OUT/preview.png
```

The dump takes seconds, each line-art render about a minute (they can run in parallel), the build about 20 s.
`preview.py` draws the result without the app: the three views with every system in its colour, and the lines
plan from four angles.

## Another ship

The `ships` skill (`.claude/skills/ships/SKILL.md`) is the playbook: survey, config, confirming the systems with
the model's owner, tracing, tuning, wiring the class in and checking it in every view, mode and theme, and what
changes for other kinds of models.
