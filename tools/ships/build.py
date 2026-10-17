"""Turn the dumps of blender_dump.py and blender_lineart.py into the ship data the ship-schematic widget draws:

    python build.py norway.config.json out/ ../../packages/themes/src/ships/norway.json

Everything is in metres in the ship's frame, centred on the structure's bounding box: x runs aft, y to port,
z up. A view is a projection of that frame onto the page (y down): top (x, y), side (x, -z), front (y, -z).
Needs numpy, scipy and scikit-image.
"""

import json
import sys

import numpy as np
from scipy import ndimage
from skimage import draw, measure

config_path, work, target = sys.argv[1:4]
config = json.load(open(config_path))
data = np.load(f"{work}/geometry.npz")
structure = data["structure"].astype(np.float64)
flat = structure.reshape(-1, 3)
CENTRE = (flat.min(axis=0) + flat.max(axis=0)) / 2
VIEWS = ("top", "side", "front")
# Blender axis seen along by each view, and the side of the depth map facing the camera.
VIEW_AXIS = {"top": (2, "far"), "side": (0, "far"), "front": (1, "near")}


def ship(points):
    """Blender coordinates to the ship frame (x aft, y port, z up)."""
    p = np.asarray(points, dtype=np.float64) - CENTRE
    return np.stack([p[..., 1], p[..., 0], p[..., 2]], axis=-1)


def project(view, points):
    """Ship frame to page coordinates of a view."""
    p = np.asarray(points)
    if view == "top":
        return np.stack([p[..., 0], p[..., 1]], axis=-1)
    if view == "side":
        return np.stack([p[..., 0], -p[..., 2]], axis=-1)
    return np.stack([p[..., 1], -p[..., 2]], axis=-1)


def fmt(value):
    """A number with one decimal and nothing it does not need: 0.5 is .5, 2.0 is 2."""
    text = f"{value:.1f}".rstrip("0").rstrip(".")
    if text in ("-0", "", "-"):
        return "0"
    if text.startswith("0."):
        return text[1:]
    if text.startswith("-0."):
        return "-" + text[2:]
    return text


def numbers(values):
    """Numbers joined the way SVG path data allows: no space before a minus sign, or before a leading dot
    when the number before already has one."""
    text = ""
    previous = ""
    for value in values:
        token = fmt(value)
        if previous and not (token.startswith("-") or (token.startswith(".") and "." in previous)):
            text += " "
        text += token
        previous = token
    return text


def path(polylines, closed=False):
    """SVG path data with relative moves, on a 0.1 m grid so rounding never drifts along a line."""
    parts = []
    for line in polylines:
        if len(line) < 2:
            continue
        grid = np.round(np.asarray(line, dtype=np.float64) * 10)
        steps = np.diff(grid, axis=0)
        steps = steps[np.any(steps != 0, axis=1)]
        if len(steps) == 0:
            continue
        parts.append("M" + numbers(grid[0] / 10) + "l" + numbers((steps / 10).reshape(-1)) + ("z" if closed else ""))
    return "".join(parts)


def length(line):
    return float(np.sum(np.linalg.norm(np.diff(line, axis=0), axis=1))) if len(line) > 1 else 0.0


def simplify(line, tolerance, closed=False):
    simplified = measure.approximate_polygon(np.asarray(line), tolerance)
    if closed and len(simplified) > 1 and np.allclose(simplified[0], simplified[-1]):
        simplified = simplified[:-1]
    return simplified


def area(loop):
    x, y = loop[:, 0], loop[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


# ---- Depth maps: the first surface from either side along each Blender axis ----


class Depth:
    def __init__(self, axis):
        self.axis = axis
        self.u, self.v = [a for a in range(3) if a != axis]
        near = data[f"depth{axis}:near"].astype(np.float64)
        far = data[f"depth{axis}:far"].astype(np.float64)
        # Close the pinholes rays slip through between panels, so the solid has no tunnels through it.
        hit = np.isfinite(near)
        whole = ndimage.binary_fill_holes(ndimage.binary_closing(hit, iterations=2)) | hit
        _, (rows, cols) = ndimage.distance_transform_edt(~hit, return_indices=True)
        near, far = near[rows, cols], far[rows, cols]
        # Fill the pits where rays went through an opening into the hull (windows, bays, recesses): a pit
        # reads as a spike into the far surface and out of the near one.
        near = ndimage.grey_opening(near, size=(9, 9))
        far = ndimage.grey_closing(far, size=(9, 9))
        self.near = np.where(whole, near, np.nan)
        self.far = np.where(whole, far, np.nan)
        self.hit = whole
        low_u, low_v, self.step = data[f"depth{axis}:origin"]
        self.low = (float(low_u), float(low_v))

    def cell(self, u, v):
        i = np.clip(np.round((u - self.low[0]) / self.step).astype(int), 0, self.near.shape[1] - 1)
        j = np.clip(np.round((v - self.low[1]) / self.step).astype(int), 0, self.near.shape[0] - 1)
        return j, i

    def inside(self, points, slack=0.0):
        j, i = self.cell(points[..., self.u], points[..., self.v])
        near, far = self.near[j, i], self.far[j, i]
        value = points[..., self.axis]
        with np.errstate(invalid="ignore"):
            return (value >= near - slack) & (value <= far + slack)

    def surface(self, points, side):
        j, i = self.cell(points[..., self.u], points[..., self.v])
        return (self.far if side == "far" else self.near)[j, i]


DEPTH = {axis: Depth(axis) for axis in range(3)}


# ---- Silhouettes ----


def camera(view):
    """Pixels of a line-art render to page coordinates: (scale, offset) with page = pixel * scale + offset."""
    meta = json.load(open(f"{work}/strokes-{view}.json"))
    ppm, width, height = meta["pixelsPerMetre"], meta["width"], meta["height"]
    centre = np.array(meta["centre"]) - CENTRE
    offset = {"top": (centre[1], centre[0]), "side": (centre[1], -centre[2]), "front": (centre[0], -centre[2])}[view]
    return ppm, width, height, np.array(offset)


def silhouette(view):
    """The outline of a view, traced from the alpha of its line-art render (smoother than the depth grid)."""
    from PIL import Image

    ppm, width, height, offset = camera(view)
    alpha = np.asarray(Image.open(f"{work}/lineart-{view}.png").convert("RGBA"))[:, :, 3] / 255.0
    loops = []
    for contour in measure.find_contours(np.pad(alpha, 1), 0.5):
        rows, cols = contour[:, 0] - 1 + 0.5, contour[:, 1] - 1 + 0.5
        page = np.stack([(cols - width / 2) / ppm + offset[0], (rows - height / 2) / ppm + offset[1]], axis=-1)
        page = simplify(page, 0.12, closed=True)
        if len(page) >= 3 and area(page) > 6:
            loops.append(page)
    axis, _ = VIEW_AXIS[view]
    return loops, DEPTH[axis].hit, DEPTH[axis]


# ---- Line art strokes from Freestyle ----


def strokes(view):
    ppm, width, height, offset = camera(view)
    lines = []
    for row in open(f"{work}/strokes-{view}.jsonl"):
        stroke = json.loads(row)
        points = np.array(stroke["points"], dtype=np.float64)
        if len(points) < 2:
            continue
        du = (points[:, 0] - width / 2) / ppm
        dv = (points[:, 1] - height / 2) / ppm
        page = np.stack([du + offset[0], -dv + offset[1]], axis=-1)
        if length(page) < 1.2:
            continue
        lines.append(simplify(page, 0.12))
    return lines


# ---- Parts ----

STEP = 0.2


def rasterise(view, tris):
    """Outline loops of a part in a view, and the point deepest inside it, where a label's leader lands."""
    page = project(view, ship(tris))
    low = page.reshape(-1, 2).min(axis=0) - 1
    high = page.reshape(-1, 2).max(axis=0) + 1
    shape = (int((high[1] - low[1]) / STEP) + 2, int((high[0] - low[0]) / STEP) + 2)
    mask = np.zeros(shape, bool)
    for tri in page:
        rows, cols = draw.polygon((tri[:, 1] - low[1]) / STEP, (tri[:, 0] - low[0]) / STEP, shape)
        mask[rows, cols] = True
        # Thin triangles seen edge on cover no pixel centre; mark their corners so they still count.
        mask[((tri[:, 1] - low[1]) / STEP).astype(int), ((tri[:, 0] - low[0]) / STEP).astype(int)] = True
    mask = ndimage.binary_fill_holes(ndimage.binary_closing(mask, iterations=2))
    # Trim the slivers where a box cut through the hull, unless the part is that thin all over.
    opened = ndimage.binary_opening(mask, iterations=2)
    if opened.sum() > 0.7 * mask.sum():
        mask = opened
    loops = []
    for contour in measure.find_contours(np.pad(mask, 1).astype(float), 0.5):
        loop = np.stack([low[0] + (contour[:, 1] - 1) * STEP, low[1] + (contour[:, 0] - 1) * STEP], axis=-1)
        loop = simplify(loop, 0.18, closed=True)
        if len(loop) >= 3 and area(loop) > 0.4:
            loops.append(loop)
    row, col = np.unravel_index(np.argmax(ndimage.distance_transform_edt(mask)), mask.shape)
    anchor = [round(float(low[0] + col * STEP), 1), round(float(low[1] + row * STEP), 1)]
    return loops, anchor


def visible_share(view, tris):
    """How much of a part the camera of a view sees: the share of its drawn area lying on the facing surface."""
    axis, side = VIEW_AXIS[view]
    page = project(view, ship(tris))
    a, b, c = page[:, 0], page[:, 1], page[:, 2]
    drawn = np.abs((b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1]) - (b[:, 1] - a[:, 1]) * (c[:, 0] - a[:, 0]))
    centres = tris.mean(axis=1)
    surface = DEPTH[axis].surface(centres, side)
    with np.errstate(invalid="ignore"):
        close = np.abs(centres[:, axis] - surface) < 0.8
    return float(np.sum(drawn[close]) / max(np.sum(drawn), 1e-9))


def parts():
    result = []
    for part in config["parts"]:
        tris = data["part:" + part["id"]].astype(np.float64)
        frame = ship(tris.reshape(-1, 3))
        views = {}
        for view in VIEWS:
            loops, anchor = rasterise(view, tris)
            entry = {"path": path(loops, closed=True), "anchor": anchor}
            if "cylinder" in part or visible_share(view, tris) < 0.25:
                entry["hidden"] = True
            views[view] = entry
        low, high = frame.min(axis=0), frame.max(axis=0)
        result.append(
            {
                "id": part["id"],
                "system": part["system"],
                "label": part["label"],
                "centre": [round(float(c), 1) for c in (low + high) / 2],
                "views": views,
            }
        )
        print("part", part["id"], {view: len(views[view]["path"]) for view in VIEWS})
    return result


# ---- Windows ----


def windows(view):
    axis, side = VIEW_AXIS[view]
    rows = data["windows"].astype(np.float64)
    if len(rows) == 0:
        return ""
    centre, low, high = rows[:, 0:3], rows[:, 3:6], rows[:, 6:9]
    u, v = [a for a in range(3) if a != axis]
    extent = high - low
    facing = (extent[:, u] > 0.3) & (extent[:, v] > 0.3)
    surface = DEPTH[axis].surface(centre, side)
    with np.errstate(invalid="ignore"):
        seen = np.abs(centre[:, axis] - surface) < 1.2
    rects = []
    for index in np.nonzero(facing & seen)[0]:
        corners = project(view, ship(np.array([low[index], high[index]])))
        x0, y0 = corners.min(axis=0)
        x1, y1 = corners.max(axis=0)
        rects.append((x0, y0, x1 - x0, y1 - y0))
    rects.sort()
    return "".join(f"M{fmt(x)} {fmt(y)}h{fmt(w)}v{fmt(h)}h{fmt(-w)}Z" for x, y, w, h in rects)


# ---- Decks: horizontal lines inside the hull, in the side and front views ----


def decks(view, mask, depth):
    if view == "top":
        return ""
    count = config["decks"]
    inner = ndimage.binary_erosion(mask, iterations=3)
    z_low = float(flat[:, 2].min()) + 2.5
    z_high = float(flat[:, 2].max()) - 4.0
    lines = []
    for level in np.linspace(z_low, z_high, count + 1)[1:-1]:
        row = int(round((level - depth.low[1]) / depth.step))
        runs = inner[row]
        edges = np.flatnonzero(np.diff(np.concatenate([[0], runs.astype(int), [0]])))
        for start, end in zip(edges[0::2], edges[1::2]):
            if end - start < 8:
                continue
            u0 = depth.low[0] + start * depth.step
            u1 = depth.low[0] + (end - 1) * depth.step
            points = np.zeros((2, 3))
            points[:, depth.u] = (u0, u1)
            points[:, depth.v] = level
            lines.append(project(view, ship(points)))
    return path(lines)


# ---- Lines plan (stations, waterlines, buttocks) for the turning view ----


def section(axis, value):
    """Loops where the plane `axis = value` (Blender) cuts the solid the three depth maps enclose."""
    u, v = [a for a in range(3) if a != axis]
    low = flat.min(axis=0) - 1
    high = flat.max(axis=0) + 1
    step = 0.4
    grid_u, grid_v = np.meshgrid(np.arange(low[u], high[u], step), np.arange(low[v], high[v], step))
    points = np.zeros(grid_u.shape + (3,))
    points[..., u], points[..., v], points[..., axis] = grid_u, grid_v, value
    solid = DEPTH[0].inside(points, 0.2) & DEPTH[1].inside(points, 0.2) & DEPTH[2].inside(points, 0.2)
    solid = ndimage.binary_fill_holes(ndimage.binary_opening(solid, iterations=1))
    # The plane's axis in the ship frame (Blender x is the ship's y and the other way round), and the two in it.
    fixed = {0: 1, 1: 0, 2: 2}[axis]
    keep = [a for a in range(3) if a != fixed]
    loops = []
    for contour in measure.find_contours(np.pad(solid, 1).astype(float), 0.5):
        loop = np.zeros((len(contour), 3))
        loop[:, u] = low[u] + (contour[:, 1] - 1) * step
        loop[:, v] = low[v] + (contour[:, 0] - 1) * step
        loop[:, axis] = value
        frame = ship(loop)
        outline = simplify(frame[:, keep], 0.45, closed=True)
        if len(outline) < 3 or area(outline) < 3:
            continue
        loop3 = np.zeros((len(outline), 3))
        loop3[:, keep[0]], loop3[:, keep[1]] = outline[:, 0], outline[:, 1]
        loop3[:, fixed] = frame[0, fixed]
        grid = np.round(loop3 * 10)
        loops.append(numbers(np.concatenate([grid[0], np.diff(grid, axis=0).reshape(-1)]) / 10))
    return loops


def sections():
    plan = config["sections"]
    stations = plan["stations"]
    result = []
    for value in np.arange(stations["from"], stations["to"] + 0.1, stations["step"]):
        result += section(1, float(value))
    for value in plan["waterlines"]:
        result += section(2, float(value))
    for value in plan["buttocks"]:
        result += section(0, float(value))
    return result


def main():
    size = flat.max(axis=0) - flat.min(axis=0)
    output = {
        "id": config["id"],
        "name": config["name"],
        "size": {"length": round(float(size[1]), 1), "beam": round(float(size[0]), 1), "height": round(float(size[2]), 1)},
        "decks": config["decks"],
        "views": {},
    }
    for view in VIEWS:
        outline, mask, depth = silhouette(view)
        art = strokes(view)
        art.sort(key=lambda line: float(np.min(line[:, 0])))
        main_lines = [line for line in art if length(line) >= 4]
        detail = [line for line in art if length(line) < 4]
        every = np.concatenate(outline)
        low, high = every.min(axis=0), every.max(axis=0)
        output["views"][view] = {
            "box": [round(float(low[0]), 1), round(float(low[1]), 1), round(float(high[0] - low[0]), 1), round(float(high[1] - low[1]), 1)],
            "outline": path(outline, closed=True),
            "lines": path(main_lines),
            "detail": path(detail),
            "windows": windows(view),
            "decks": decks(view, mask, depth),
        }
        print(view, {key: len(value) for key, value in output["views"][view].items() if isinstance(value, str)})
    output["parts"] = parts()
    output["conduits"] = [
        {"id": c["id"], "system": c["system"], "points": [[round(float(v), 1) for v in p] for p in ship(np.array(c["points"], float))]}
        for c in config["conduits"]
    ]
    output["sections"] = sections()
    print("sections", len(output["sections"]), sum(len(s) for s in output["sections"]), "characters")
    with open(target, "w") as file:
        json.dump(output, file, separators=(",", ":"))
        file.write("\n")


main()
