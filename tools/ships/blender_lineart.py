"""Line art of one view with Freestyle: the visible silhouettes, borders and creases of the structure, as
strokes in pixels. Runs with the `bpy` module:

    python blender_lineart.py model.blend norway.config.json out/ top|side|front

Views: top looks down with the bow to the left and port at the bottom; side looks at the port side with the
bow to the left; front looks at the bow with port on the right. The camera is centred on the structure's
bounding box and covers `PIXELS_PER_METRE` pixels per metre; build.py turns pixels back into metres.
"""

import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

PIXELS_PER_METRE = 4
CREASE_DEGREES = 115

blend, config_path, out, view = sys.argv[1:5]
config = json.load(open(config_path))
os.makedirs(out, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend, load_ui=False)
scene = bpy.context.scene

keep = set(config["lineart"])
for obj in bpy.data.objects:
    if obj.type in ("MESH", "LIGHT", "EMPTY", "CURVE"):
        obj.hide_render = obj.name not in keep

# The structure's bounding box, the same one blender_dump.py and build.py centre on.
corners = [obj.matrix_world @ Vector(c) for name in config["structure"] for obj in [bpy.data.objects[name]] for c in obj.bound_box]
low = Vector([min(c[i] for c in corners) for i in range(3)])
high = Vector([max(c[i] for c in corners) for i in range(3)])
centre = (low + high) / 2
size = high - low
margin = 10

scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.use_denoising = False
scene.cycles.device = "CPU"
scene.render.film_transparent = True
scene.render.use_freestyle = True
settings = scene.view_layers[0].freestyle_settings
settings.mode = "SCRIPT"
settings.crease_angle = math.radians(CREASE_DEGREES)
settings.use_culling = False
module = settings.modules.new()
module.script = bpy.data.texts.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "freestyle_strokes.py"))

camera = bpy.data.objects.new("ShipCamera", bpy.data.cameras.new("ShipCamera"))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = "ORTHO"
camera.data.clip_start = 1
camera.data.clip_end = 5000
far = 1000
if view == "top":
    width, height = size.y, size.x
    camera.location = (centre.x, centre.y, high.z + far)
    camera.rotation_euler = Euler((0, 0, math.pi / 2))
elif view == "side":
    width, height = size.y, size.z
    camera.location = (high.x + far, centre.y, centre.z)
    camera.rotation_euler = Euler((math.pi / 2, 0, math.pi / 2))
elif view == "front":
    width, height = size.x, size.z
    camera.location = (centre.x, low.y - far, centre.z)
    camera.rotation_euler = Euler((math.pi / 2, 0, 0))
else:
    raise SystemExit(f"unknown view {view}")
width, height = width + 2 * margin, height + 2 * margin
scene.render.resolution_x = round(width * PIXELS_PER_METRE)
scene.render.resolution_y = round(height * PIXELS_PER_METRE)
scene.render.resolution_percentage = 100
camera.data.ortho_scale = max(scene.render.resolution_x, scene.render.resolution_y) / PIXELS_PER_METRE

strokes = os.path.join(out, f"strokes-{view}.jsonl")
open(strokes, "w").close()
os.environ["SHIP_STROKES"] = strokes
scene.render.filepath = os.path.join(out, f"lineart-{view}.png")
bpy.ops.render.render(write_still=True)
json.dump(
    {
        "view": view,
        "width": scene.render.resolution_x,
        "height": scene.render.resolution_y,
        "pixelsPerMetre": PIXELS_PER_METRE,
        "centre": list(centre),
    },
    open(os.path.join(out, f"strokes-{view}.json"), "w"),
)
