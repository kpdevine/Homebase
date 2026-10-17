"""Build a subtly stepped LCD face from the bundled SIL-OFL Space Grotesk.
No downloads. Requires fonttools, brotli and Pillow; .font-build/deps is supported.
"""
from pathlib import Path
from io import BytesIO
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.font-build/deps'))
from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
bold='--bold' in sys.argv
variant='Bold' if bold else 'Regular'
source=TTFont(ROOT/'prototype/assets/fonts/SpaceGrotesk.woff2')
source=instantiateVariableFont(source,{'wght':700 if bold else 450},inplace=True)
source.flavor=None
buffer=BytesIO();source.save(buffer)
face=ImageFont.truetype(BytesIO(buffer.getvalue()),48)
scale=1000/48
points=list(range(32,127))+[160,8211,8212,8216,8217,8220,8221]
names={cp:f'uni{cp:04X}' for cp in points}
glyphs={};metrics={}
for cp,name in names.items():
 char=chr(cp);left,top,right,bottom=face.getbbox(char,anchor='ls')
 bitmap=Image.new('L',(max(1,right-left),max(1,bottom-top)))
 ImageDraw.Draw(bitmap).text((-left,-top),char,font=face,fill=255,anchor='ls')
 pen=TTGlyphPen(None)
 for y in range(bitmap.height):
  x=0
  while x<bitmap.width:
   if bitmap.getpixel((x,y))<100:x+=1;continue
   start=x
   while x<bitmap.width and bitmap.getpixel((x,y))>=100:x+=1
   x0=round((left+start)*scale);x1=round((left+x)*scale)
   y0=round(-(top+y+1)*scale);y1=round(-(top+y)*scale)
   pen.moveTo((x0,y0));pen.lineTo((x0,y1));pen.lineTo((x1,y1));pen.lineTo((x1,y0));pen.closePath()
 glyphs[name]=pen.glyph()
 metrics[name]=(round(face.getlength(char)*scale),round(left*scale))
glyphs['.notdef']=glyphs[names[63]];metrics['.notdef']=metrics[names[63]]
number_width=max(metrics[names[cp]][0] for cp in range(48,58))
for cp in range(48,58):metrics[names[cp]]=(number_width,metrics[names[cp]][1])
fb=FontBuilder(1000,isTTF=True);fb.setupGlyphOrder(['.notdef']+list(names.values()));fb.setupCharacterMap(names)
fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=1000,descent=-250)
fb.setupNameTable({'familyName':'Radio Display','styleName':variant,'uniqueFontIdentifier':f'Radio Display {variant} 1.0','fullName':f'Radio Display {variant}','psName':f'RadioDisplay-{variant}','version':'Version 1.000','copyright':'Derived from Space Grotesk. Copyright 2020 The Space Grotesk Project Authors. Pixel outline adaptation 2026. Licensed under SIL OFL 1.1.','licenseDescription':'SIL Open Font License 1.1. See SpaceGrotesk-OFL.txt.'})
fb.setupOS2(sTypoAscender=1000,sTypoDescender=-250,usWinAscent=1100,usWinDescent=300,sCapHeight=700,sxHeight=500,usWeightClass=700 if bold else 450)
fb.setupPost();fb.setupMaxp();fb.font.flavor='woff2'
output=ROOT/f'prototype/assets/fonts/RadioDisplay-{variant}.woff2';fb.save(output)
print(f'Built {output.name}: {len(names)} characters, {output.stat().st_size} bytes')
