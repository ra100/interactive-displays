# Freestyle style module used by blender_lineart.py: chains the visible feature edges and appends each
# stroke (its nature and its points in pixels) to the JSON lines file named by SHIP_STROKES.
import json
import os

from freestyle.chainingiterators import ChainSilhouetteIterator
from freestyle.predicates import NotUP1D, QuantitativeInvisibilityUP1D, TrueUP1D
from freestyle.shaders import ConstantThicknessShader
from freestyle.types import Operators, StrokeShader


class Dump(StrokeShader):
    def __init__(self):
        StrokeShader.__init__(self)
        self.file = open(os.environ["SHIP_STROKES"], "a")

    def shade(self, stroke):
        edge = stroke[0].fedge
        points = [(round(v.point.x, 2), round(v.point.y, 2)) for v in stroke]
        self.file.write(json.dumps({"nature": int(edge.nature) if edge else 0, "points": points}) + "\n")
        self.file.flush()


visible = QuantitativeInvisibilityUP1D(0)
Operators.select(visible)
Operators.bidirectional_chain(ChainSilhouetteIterator(), NotUP1D(visible))
Operators.create(TrueUP1D(), [ConstantThicknessShader(1), Dump()])
