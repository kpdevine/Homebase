"""Extract the owner's slash, rotate it upright, and trim away font spacing."""
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.font-build' / 'deps'))
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

font = TTFont(ROOT / 'prototype/assets/fonts/KieranHandwriting-LCD.woff2')
glyphs = font.getGlyphSet()
glyph = glyphs[font.getBestCmap()[ord('/')]]
angle = math.radians(44)
# Rotate in font coordinates, then flip the vertical axis for SVG.
matrix = (math.cos(angle), -math.sin(angle), -math.sin(angle), -math.cos(angle), 0, 0)
bounds = BoundsPen(glyphs)
glyph.draw(TransformPen(bounds, matrix))
left, top, right, bottom = bounds.bounds
path = SVGPathPen(glyphs)
glyph.draw(TransformPen(path, (matrix[0], matrix[1], matrix[2], matrix[3], -left, -top)))
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {right-left:.4f} {bottom-top:.4f}"><path d="{path.getCommands()}"/></svg>\n'
(ROOT / 'prototype/assets/handwriting-caret.svg').write_text(svg, encoding='utf-8')
