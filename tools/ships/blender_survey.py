"""First look at a model before writing its config: every object with its size, polygons, modifiers and
materials, the loose parts of the objects you name (with their bounding boxes, to tell port from starboard or
dorsal from ventral), and workbench renders from six sides with each object in its own colour. Runs with `bpy`:

    python blender_survey.py model.blend out/ [object,object,...]

Blender coordinates throughout. The other scripts expect the bow towards -Y, port towards +X and Z up, in metres.
"""

import colorsys
import math
import os
import sys

import bpy
import bmesh
from mathutils import Euler, Vector

blend, out = sys.argv[1], sys.argv[2]
named = sys.argv[3].split(",") if len(sys.argv) > 3 and sys.argv[3] else []
os.makedirs(out, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend, load_ui=False)
scene = bpy.context.scene
depsgraph = bpy.context.evaluated_depsgraph_get()


def bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return [min(c[i] for c in corners) for i in range(3)], [max(c[i] for c in corners) for i in range(3)]


def rounded(values):
    return "[" + ", ".join(f"{v:.1f}" for v in values) + "]"


print(f"units {scene.unit_settings.system} x{scene.unit_settings.scale_length}")
print(f"collections {[(c.name, len(c.objects)) for c in bpy.data.collections]}")
meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
for obj in sorted(meshes, key=lambda o: o.name):
    low, high = bounds(obj)
    materials = [slot.material.name for slot in obj.material_slots if slot.material][:3]
    hidden = " hidden" if obj.hide_render else ""
    print(
        f"{obj.name!r:40} polys={len(obj.data.polygons):7} min={rounded(low)} max={rounded(high)}"
        f" mods={[m.type for m in obj.modifiers]} mats={materials}{hidden}"
    )

# Loose parts of the named objects, sorted from port to starboard and bow to stern.
for name in named:
    obj = bpy.data.objects[name]
    mesh = obj.evaluated_get(depsgraph).to_mesh()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.transform(obj.matrix_world)
    bm.verts.ensure_lookup_table()
    seen, islands = set(), []
    for vert in bm.verts:
        if vert.index in seen:
            continue
        stack, island = [vert], []
        seen.add(vert.index)
        while stack:
            current = stack.pop()
            island.append(current.co.copy())
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other.index not in seen:
                    seen.add(other.index)
                    stack.append(other)
        islands.append(island)
    print(f"\n{name}: {len(islands)} loose parts")
    for island in sorted(islands, key=lambda points: (-sum(p.x for p in points) / len(points), sum(p.y for p in points) / len(points)))[:40]:
        low = [min(p[i] for p in island) for i in range(3)]
        high = [max(p[i] for p in island) for i in range(3)]
        print(f"  min={rounded(low)} max={rounded(high)} vertices={len(island)}")
    bm.free()
    obj.evaluated_get(depsgraph).to_mesh_clear()

# Six views, each object in its own colour, so parts can be told apart and named.
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "OBJECT"
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
for index, obj in enumerate(sorted(meshes, key=lambda o: o.name)):
    red, green, blue = colorsys.hsv_to_rgb((index * 0.618) % 1, 0.45, 0.95)
    obj.color = (red, green, blue, 1)
for obj in bpy.data.objects:
    if obj.type in ("LIGHT", "EMPTY"):
        obj.hide_render = True
# Frame the biggest object and whatever sits inside it, so camera rigs and helpers far off do not shrink the ship.
visible = [obj for obj in meshes if not obj.hide_render]
biggest = max(visible, key=lambda obj: len(obj.data.polygons))
outer_low, outer_high = bounds(biggest)
inside = [obj for obj in visible if all(outer_low[i] <= (bounds(obj)[0][i] + bounds(obj)[1][i]) / 2 <= outer_high[i] for i in range(3))]
lows, highs = zip(*(bounds(obj) for obj in inside))
low = Vector([min(v[i] for v in lows) for i in range(3)])
high = Vector([max(v[i] for v in highs) for i in range(3)])
print(f"\nframed on {biggest.name!r} and the {len(inside) - 1} objects inside it")
centre, size = (low + high) / 2, high - low
camera = bpy.data.objects.new("SurveyCamera", bpy.data.cameras.new("SurveyCamera"))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = "ORTHO"
camera.data.ortho_scale = max(size) * 1.1
camera.data.clip_end = 10 * max(size)
far = 3 * max(size)
views = {
    "top": ((centre.x, centre.y, centre.z + far), (0, 0, math.pi / 2)),
    "bottom": ((centre.x, centre.y, centre.z - far), (math.pi, 0, math.pi / 2)),
    "port": ((centre.x + far, centre.y, centre.z), (math.pi / 2, 0, math.pi / 2)),
    "starboard": ((centre.x - far, centre.y, centre.z), (math.pi / 2, 0, -math.pi / 2)),
    "front": ((centre.x, centre.y - far, centre.z), (math.pi / 2, 0, 0)),
    "rear": ((centre.x, centre.y + far, centre.z), (math.pi / 2, 0, math.pi)),
}
for name, (location, rotation) in views.items():
    camera.location = location
    camera.rotation_euler = Euler(rotation)
    scene.render.filepath = os.path.join(out, f"survey-{name}.png")
    bpy.ops.render.render(write_still=True)
print(f"\nbounding box min={rounded(low)} max={rounded(high)} size={rounded(size)}; renders in {out}")
