"""Dump what the ship views need from a Blender model: triangles of the structure and of each part, the
windows, and depth maps along the three axes. Runs with the `bpy` module (pip install bpy):

    python blender_dump.py model.blend norway.config.json out/
"""

import json
import os
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

blend, config_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
config = json.load(open(config_path))
os.makedirs(out, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend, load_ui=False)
depsgraph = bpy.context.evaluated_depsgraph_get()


def triangles(name):
    """World-space triangles of an object with its modifiers applied, as an (n, 3, 3) array."""
    source = bpy.data.objects[name]
    evaluated = source.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.transform(source.matrix_world)
    mesh.calc_loop_triangles()
    vertices = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", vertices)
    indices = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int64)
    mesh.loop_triangles.foreach_get("vertices", indices)
    result = vertices.reshape(-1, 3)[indices.reshape(-1, 3)]
    evaluated.to_mesh_clear()
    return result


def cylinder(start, end, radius, sides=24):
    start, end = np.array(start, float), np.array(end, float)
    axis = end - start
    axis /= np.linalg.norm(axis)
    side = np.cross(axis, [1.0, 0.0, 0.0] if abs(axis[0]) < 0.9 else [0.0, 1.0, 0.0])
    side /= np.linalg.norm(side)
    other = np.cross(axis, side)
    ring = [radius * (np.cos(a) * side + np.sin(a) * other) for a in np.linspace(0, 2 * np.pi, sides, endpoint=False)]
    result = []
    for index in range(sides):
        a, b = ring[index], ring[(index + 1) % sides]
        result += [[start + a, start + b, end + b], [start + a, end + b, end + a], [start, start + b, start + a], [end, end + a, end + b]]
    return np.array(result)


structure = np.concatenate([triangles(name) for name in config["structure"]])
arrays = {"structure": structure.astype(np.float32)}
for part in config["parts"]:
    if "cylinder" in part:
        shape = part["cylinder"]
        tris = cylinder(shape["from"], shape["to"], shape["radius"])
    else:
        tris = np.concatenate([triangles(name) for name in part["objects"]])
        if "box" in part:
            low, high = np.array(part["box"][0]), np.array(part["box"][1])
            centres = tris.mean(axis=1)
            tris = tris[np.all((centres >= low) & (centres <= high), axis=1)]
    print(part["id"], len(tris))
    arrays["part:" + part["id"]] = tris.astype(np.float32)

# Windows: one entry per loose part (centre and extent), so the views can draw them as dashes. A model
# without a windows object has none.
rows = []
if config.get("windows"):
    windows = triangles(config["windows"])
    keys = {}
    parent = list(range(len(windows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for index, tri in enumerate(windows):
        for vertex in tri:
            key = tuple(np.round(vertex, 3))
            if key in keys:
                a, b = find(index), find(keys[key])
                if a != b:
                    parent[a] = b
            else:
                keys[key] = index
    groups = {}
    for index in range(len(windows)):
        groups.setdefault(find(index), []).append(index)
    for members in groups.values():
        points = windows[members].reshape(-1, 3)
        rows.append(np.concatenate([points.mean(axis=0), points.min(axis=0), points.max(axis=0)]))
arrays["windows"] = np.array(rows, dtype=np.float32).reshape(-1, 9)
print("windows", len(rows))

# Depth maps: the first surface hit from each side along each axis, on a grid of `step` metres.
step = 0.4
flat = structure.reshape(-1, 3)
low, high = flat.min(axis=0) - 1, flat.max(axis=0) + 1
tree = BVHTree.FromPolygons([Vector(v) for v in flat], [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(structure))], all_triangles=True)
for axis in range(3):
    u, v = [a for a in range(3) if a != axis]
    us = np.arange(low[u], high[u], step)
    vs = np.arange(low[v], high[v], step)
    near = np.full((len(vs), len(us)), np.nan, dtype=np.float32)
    far = np.full((len(vs), len(us)), np.nan, dtype=np.float32)
    for sign, target in ((1, near), (-1, far)):
        direction = Vector([0, 0, 0])
        direction[axis] = sign
        for j, vv in enumerate(vs):
            for i, uu in enumerate(us):
                origin = Vector([0, 0, 0])
                origin[u], origin[v] = uu, vv
                origin[axis] = low[axis] - 5 if sign > 0 else high[axis] + 5
                hit = tree.ray_cast(origin, direction)
                if hit[0] is not None:
                    target[j, i] = hit[0][axis]
    arrays[f"depth{axis}:near"] = near
    arrays[f"depth{axis}:far"] = far
    arrays[f"depth{axis}:origin"] = np.array([low[u], low[v], step], dtype=np.float32)
    print("depth", axis, near.shape)

np.savez_compressed(os.path.join(out, "geometry.npz"), **arrays)
