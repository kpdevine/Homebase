"""Make the dashboard-only LCD variant of Kieran Handwriting v1.5.
Preserves original advances and kerning. The original font is never modified.
"""
from pathlib import Path
from io import BytesIO
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.font-build/deps'))
from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
variant='Bold' if '--bold' in sys.argv else 'Regular'
path=ROOT/f'prototype/assets/fonts/KieranHandwriting-{variant}.woff2'
font=TTFont(path)
original_metrics=dict(font['hmtx'].metrics)
original_kern=font['kern'].compile(font) if 'kern' in font else None
original_gpos=font['GPOS'].compile(font) if 'GPOS' in font else None
font.flavor=None
buffer=BytesIO();font.save(buffer)
face=ImageFont.truetype(BytesIO(buffer.getvalue()),40)
scale=font['head'].unitsPerEm/40
characters={}
for cp,glyph in font.getBestCmap().items():characters.setdefault(glyph,chr(cp))
for glyph,char in characters.items():
 left,top,right,bottom=face.getbbox(char,anchor='ls')
 bitmap=Image.new('L',(max(1,right-left),max(1,bottom-top)))
 ImageDraw.Draw(bitmap).text((-left,-top),char,font=face,fill=255,anchor='ls')
 pen=TTGlyphPen(None)
 for y in range(bitmap.height):
  x=0
  while x<bitmap.width:
   if bitmap.getpixel((x,y))<100:x+=1;continue
   first=x
   while x<bitmap.width and bitmap.getpixel((x,y))>=100:x+=1
   x0=round((left+first)*scale);x1=round((left+x)*scale)
   y0=round(-(top+y+1)*scale);y1=round(-(top+y)*scale)
   pen.moveTo((x0,y0));pen.lineTo((x0,y1));pen.lineTo((x1,y1));pen.lineTo((x1,y0));pen.closePath()
 font['glyf'][glyph]=pen.glyph()
labels={1:'Kieran Handwriting LCD',2:variant,3:f'Kieran-Handwriting-LCD-{variant}-1.000',4:f'Kieran Handwriting LCD {variant}',5:'Version 1.000; derived from Kieran Handwriting 1.500',6:f'KieranHandwritingLCD-{variant}',16:'Kieran Handwriting LCD',17:variant}
font['name'].names=[record for record in font['name'].names if record.nameID not in labels]
for key,value in labels.items():font['name'].setName(value,key,3,1,0x409)
font.flavor='woff2'
out=ROOT/('prototype/assets/fonts/KieranHandwriting-LCD-Bold.woff2' if variant=='Bold' else 'prototype/assets/fonts/KieranHandwriting-LCD.woff2');font.save(out)
check=TTFont(out)
assert check['hmtx'].metrics==original_metrics
assert ('kern' not in check or check['kern'].compile(check)==original_kern)
assert ('GPOS' not in check or check['GPOS'].compile(check)==original_gpos)
print(f'Built {out.name}: {len(characters)} glyphs, {out.stat().st_size} bytes; original spacing and kerning preserved.')
print('Font metrics:',check['head'].unitsPerEm,check['hhea'].ascent,check['hhea'].descent)
