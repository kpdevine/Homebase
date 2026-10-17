"""Stepped Inter companion for small LCD labels. Local source, SIL OFL 1.1."""
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
source=TTFont(ROOT/'prototype/assets/fonts/InterVariable.woff2')
source=instantiateVariableFont(source,{'wght':450,'opsz':14},inplace=True)
cmap=source.getBestCmap()
source.flavor=None;buffer=BytesIO();source.save(buffer)
face=ImageFont.truetype(BytesIO(buffer.getvalue()),48);scale=1000/48
points=set(range(32,127))|set(range(160,256))
for path in (ROOT/'prototype').glob('*'):
 if path.suffix in ['.html','.mjs','.css']:points.update(ord(char) for char in path.read_text(encoding='utf-8') if ord(char)>126)
names={cp:f'uni{cp:04X}' for cp in sorted(points) if cp in cmap}
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
   first=x
   while x<bitmap.width and bitmap.getpixel((x,y))>=100:x+=1
   x0=round((left+first)*scale);x1=round((left+x)*scale)
   y0=round(-(top+y+1)*scale);y1=round(-(top+y)*scale)
   pen.moveTo((x0,y0));pen.lineTo((x0,y1));pen.lineTo((x1,y1));pen.lineTo((x1,y0));pen.closePath()
 glyphs[name]=pen.glyph();metrics[name]=(round(face.getlength(char)*scale),round(left*scale))
glyphs['.notdef']=glyphs[names[63]];metrics['.notdef']=metrics[names[63]]
fb=FontBuilder(1000,isTTF=True);fb.setupGlyphOrder(['.notdef']+list(names.values()));fb.setupCharacterMap(names)
fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=970,descent=-250)
fb.setupNameTable({'familyName':'Radio UI','styleName':'Regular','uniqueFontIdentifier':'Radio UI 1.0','fullName':'Radio UI Regular','psName':'RadioUI-Regular','version':'Version 1.000','copyright':'Derived from Inter. Copyright 2016 The Inter Project Authors. Pixel outline adaptation 2026. Licensed under SIL OFL 1.1.','licenseDescription':'SIL Open Font License 1.1. See Inter-OFL.txt.'})
fb.setupOS2(sTypoAscender=970,sTypoDescender=-250,usWinAscent=1100,usWinDescent=300,sCapHeight=730,sxHeight=550)
fb.setupPost();fb.setupMaxp();fb.font.flavor='woff2'
output=ROOT/'prototype/assets/fonts/RadioUI-Regular.woff2';fb.save(output)
print(f'Built {output.name}: {len(names)} characters, {output.stat().st_size} bytes')
