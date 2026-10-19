"""Give handwriting entry a compact native baseline on Safari and other browsers.

Only font metrics and identity change. Preserve every glyph and advance width;
long descenders intentionally paint outside the compact text line.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.font-build' / 'deps'))
from fontTools.ttLib import TTFont

SOURCE = ROOT / 'prototype/assets/fonts/KieranHandwriting-LCD.woff2'
TARGET = ROOT / 'prototype/assets/fonts/KieranHandwriting-Entry.woff2'


def verify():
    original, entry = TTFont(SOURCE), TTFont(TARGET)
    units = entry['head'].unitsPerEm
    assert (entry['hhea'].ascent, entry['hhea'].descent, entry['hhea'].lineGap) == (units * 3 // 4, -units // 4, 0)
    os2 = entry['OS/2']
    assert (os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap) == (units * 3 // 4, -units // 4, 0)
    assert (os2.usWinAscent, os2.usWinDescent) == (units * 3 // 4, units // 4)
    assert os2.fsSelection & (1 << 7)
    for table in ['glyf', 'loca', 'hmtx', 'cmap']:
        assert original.getTableData(table) == entry.getTableData(table), f'{table} changed'
    assert entry['name'].getDebugName(6) == 'KieranHandwriting-Entry'
    print('Entry metrics verified: 75% ascent, 25% descent, no line gap; glyphs and widths unchanged.')


if '--check' not in sys.argv:
    font = TTFont(SOURCE, recalcTimestamp=False)
    units = font['head'].unitsPerEm
    font['hhea'].ascent, font['hhea'].descent, font['hhea'].lineGap = units * 3 // 4, -units // 4, 0
    os2 = font['OS/2']
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = units * 3 // 4, -units // 4, 0
    os2.usWinAscent, os2.usWinDescent = units * 3 // 4, units // 4
    os2.fsSelection |= 1 << 7
    names = {1: 'Kieran Handwriting Entry', 2: 'Regular', 3: 'Homebase:KieranHandwriting-Entry:1.0',
             4: 'Kieran Handwriting Entry', 6: 'KieranHandwriting-Entry',
             16: 'Kieran Handwriting Entry', 17: 'Regular'}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font.flavor = 'woff2'
    font.save(TARGET)
verify()
