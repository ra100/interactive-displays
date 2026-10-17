"""Draws a ship data file the way the widget will, without the app: the three flat views with their line art,
windows and every system in its own colour (dashed outline where the hull hides it, a dot on its label anchor),
and the turning view's lines plan from four angles with the conduits. Check it before wiring a class in:

    python preview.py ../../packages/themes/src/ships/norway.json out/preview.png

Needs Pillow.
"""

import json
import math
import re
import sys

from PIL import Image, ImageDraw

NUMBER = re.compile(r"-?(?:\d+\.?\d*|\.\d+)")
SYSTEM_COLOURS = {
    "bridge": (255, 255, 255),
    "deflector": (0, 230, 230),
    "warp-core": (255, 210, 0),
    "nacelles": (90, 160, 255),
    "impulse": (255, 120, 220),
    "phasers": (255, 70, 70),
    "torpedoes": (255, 160, 40),
    "shuttlebay": (120, 255, 120),
}
SCALE = 3.0
MARGIN = 20


def loops(data):
    """Points of path data as tools/ships writes it: an absolute move, then relative steps."""
    result = []
    for piece in data.split("M")[1:]:
        head, _, tail = piece.rstrip("z").partition("l")
        x, y = (float(n) for n in NUMBER.findall(head)[:2])
        points = [(x, y)]
        steps = [float(n) for n in NUMBER.findall(tail)]
        for dx, dy in zip(steps[0::2], steps[1::2]):
            x, y = x + dx, y + dy
            points.append((x, y))
        result.append(points)
    return result


def rects(data):
    """Windows: rectangles written as M x y h width v height h -width z."""
    result = []
    for piece in data.split("M")[1:]:
        x, y, width, height = (float(n) for n in NUMBER.findall(piece)[:4])
        result.append([(x, y), (x + width, y), (x + width, y + height), (x, y + height)])
    return result


def section(text):
    values = [float(n) for n in NUMBER.findall(text)]
    points = [values[0:3]]
    for index in range(3, len(values) - 2, 3):
        last = points[-1]
        points.append([last[0] + values[index], last[1] + values[index + 1], last[2] + values[index + 2]])
    return points


def dashed(draw, points, colour):
    for index, (start, end) in enumerate(zip(points, points[1:])):
        if index % 2 == 0:
            draw.line([start, end], fill=colour, width=1)


def flat(ship, view):
    x0, y0, width, height = ship["views"][view]["box"]
    image = Image.new("RGB", (int(width * SCALE) + 2 * MARGIN, int(height * SCALE) + 2 * MARGIN))
    draw = ImageDraw.Draw(image)

    def page(points):
        return [((x - x0) * SCALE + MARGIN, (y - y0) * SCALE + MARGIN) for x, y in points]

    art = ship["views"][view]
    for loop in loops(art["outline"]):
        draw.polygon(page(loop), fill=(18, 24, 48), outline=(140, 200, 255))
    for layer, colour in (("decks", (90, 70, 110)), ("detail", (60, 90, 130)), ("lines", (130, 190, 255))):
        for line in loops(art[layer]):
            draw.line(page(line), fill=colour, width=1)
    for rect in rects(art["windows"]):
        draw.polygon(page(rect), fill=(255, 200, 100))
    for part in ship["parts"]:
        colour = SYSTEM_COLOURS.get(part["system"], (255, 255, 255))
        entry = part["views"][view]
        for loop in loops(entry["path"]):
            outline = page(loop + loop[:1])
            if entry.get("hidden"):
                dashed(draw, outline, colour)
            else:
                draw.line(outline, fill=colour, width=2)
        ax, ay = page([entry["anchor"]])[0]
        draw.ellipse([ax - 3, ay - 3, ax + 3, ay + 3], fill=colour)
    draw.text((6, 4), view.upper(), fill=(255, 255, 255))
    return image


def turned(ship, yaw, pitch=math.radians(20)):
    radius = math.hypot(ship["size"]["length"], ship["size"]["beam"]) / 2 * 1.05
    size = int(2 * radius * SCALE * 0.6)
    image = Image.new("RGB", (size, int(size * 0.62)))
    draw = ImageDraw.Draw(image)

    def project(x, y, z):
        across = x * math.sin(yaw) + y * math.cos(yaw)
        sx = x * math.cos(yaw) - y * math.sin(yaw)
        sy = across * math.sin(pitch) - z * math.cos(pitch)
        return sx * SCALE * 0.6 + size / 2, sy * SCALE * 0.6 + image.height / 2

    for text in ship["sections"]:
        points = section(text)
        draw.line([project(*p) for p in points + points[:1]], fill=(130, 190, 255), width=1)
    for conduit in ship["conduits"]:
        draw.line([project(*p) for p in conduit["points"]], fill=SYSTEM_COLOURS.get(conduit["system"], (255, 255, 0)), width=2)
    return image


ship = json.load(open(sys.argv[1]))
tiles = [flat(ship, view) for view in ("top", "side", "front")] + [turned(ship, math.radians(a)) for a in (-35, 55, 145, 235)]
width = max(tile.width for tile in tiles[:3])
sheet = Image.new("RGB", (max(width, sum(t.width for t in tiles[3:5])), sum(t.height for t in tiles[:3]) + tiles[3].height * 2))
y = 0
for tile in tiles[:3]:
    sheet.paste(tile, (0, y))
    y += tile.height
for index, tile in enumerate(tiles[3:]):
    sheet.paste(tile, ((index % 2) * tile.width, y + (index // 2) * tile.height))
sheet.save(sys.argv[2])
print(f"{sys.argv[2]}: {len(ship['parts'])} parts, {len(ship['sections'])} section loops")
