"""Create a linked Bold face from the current verified Regular outlines.

Run after build-handwriting.py. Requires its same local build dependencies.
"""
from pathlib import Path
from copy import deepcopy
import sys,json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.font-build/deps'))
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.reverseContourPen import ReverseContourPen

OUT=ROOT/'prototype/assets/fonts'
DOCS=ROOT/'docs/handwriting'
regular_path=OUT/'KieranHandwriting-Regular.ttf'
font=TTFont(regular_path)
version=font['name'].getDebugName(5).split()[-1]
release=f'{float(version):.1f}'
raster=ImageFont.truetype(str(regular_path),1000)
reverse={name:chr(code) for code,name in font.getBestCmap().items()}
reverse['.notdef']='\uffff'
radius=18
pad=radius+10
records=[]
original_metrics=deepcopy(font['hmtx'].metrics)
for name in font.getGlyphOrder():
    glyph=font['glyf'][name]
    if not glyph.numberOfContours:continue
    mask,(ox,oy)=raster.getmask2(reverse[name],mode='L',anchor='ls')
    pixels=np.asarray(mask,dtype=np.uint8).reshape(mask.size[1],mask.size[0])
    pixels=cv2.copyMakeBorder(np.uint8(pixels>=128)*255,pad,pad,pad,pad,cv2.BORDER_CONSTANT,value=0)
    before,hierarchy=cv2.findContours(pixels,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    outside=cv2.distanceTransform(255-pixels,cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
    bold=np.uint8(outside<=radius)*255
    contours,after_hierarchy=cv2.findContours(bold,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    components=sum(h[3]<0 for h in hierarchy[0])
    counters=0
    # Protect the actual enclosed bowls. Hairline pockets at overlapping pen
    # strokes (for example the drawn z) naturally fill when made bolder.
    for i,h in enumerate(hierarchy[0]):
        if h[3]<0:continue
        pocket=np.zeros_like(pixels)
        cv2.drawContours(pocket,[before[i]],-1,255,-1)
        depth=cv2.distanceTransform(pocket,cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
        py,px=np.unravel_index(np.argmax(depth),depth.shape)
        if depth[py,px]>radius+3:
            counters+=1
            assert not bold[py,px],(name,'lost counter')
    assert components==sum(h[3]<0 for h in after_hierarchy[0]),(name,'merged components')
    raw=TTGlyphPen(None);pen=ReverseContourPen(raw)
    for contour in contours:
        if abs(cv2.contourArea(contour))<3:continue
        pts=cv2.approxPolyDP(contour,.8,True)[:,0,:]
        if len(pts)<3:continue
        pts=[(round(ox+x-pad+radius),round(-(oy+y-pad))) for x,y in pts]
        mid=lambda a,b:(round((a[0]+b[0])/2),round((a[1]+b[1])/2))
        pen.moveTo(mid(pts[-1],pts[0]))
        for i,p in enumerate(pts):pen.qCurveTo(p,mid(p,pts[(i+1)%len(pts)]))
        pen.closePath()
    font['glyf'][name]=raw.glyph()
    font['glyf'][name].recalcBounds(font['glyf'])
    advance,bearing=original_metrics[name]
    font['hmtx'][name]=(advance+2*radius,font['glyf'][name].xMin)
    records.append({'glyph':name,'outlineExpansion':radius,'components':int(components),'countersRetained':int(counters)})

font['OS/2'].usWeightClass=700
font['OS/2'].fsSelection=(font['OS/2'].fsSelection&~0x41)|0x20
font['head'].macStyle=(font['head'].macStyle&~2)|1
names={1:'Kieran Handwriting',2:'Bold',3:f'KieranHandwriting-Bold-{version}',4:'Kieran Handwriting Bold',6:'KieranHandwriting-Bold',16:'Kieran Handwriting',17:'Bold',18:'Kieran Handwriting Bold',21:'Kieran Handwriting',22:'Bold'}
platforms={(n.platformID,n.platEncID,n.langID) for n in font['name'].names}
for name_id,value in names.items():
    for platform,encoding,language in platforms:font['name'].setName(value,name_id,platform,encoding,language)
font.save(OUT/'KieranHandwriting-Bold.ttf')
font.save(OUT/f'KieranHandwriting-Bold-v{release}.ttf')
font.flavor='woff2';font.save(OUT/'KieranHandwriting-Bold.woff2')
for filename in ('KieranHandwriting-Bold.ttf','KieranHandwriting-Bold.woff2'):
    check=TTFont(OUT/filename)
    assert check['name'].getDebugName(1)=='Kieran Handwriting'
    assert check['name'].getDebugName(2)=='Bold'
    assert check['OS/2'].usWeightClass==700
    assert check['OS/2'].fsSelection&0x20 and not check['OS/2'].fsSelection&0x40
    assert check['head'].macStyle&1
    for name in check.getGlyphOrder():
        glyph=check['glyf'][name]
        if glyph.numberOfContours:
            assert -check['OS/2'].usWinDescent<=glyph.yMin<=glyph.yMax<=check['OS/2'].usWinAscent,(name,'clipping')

# Check the same pair adjustments with the heavier outlines.
bold_raster=ImageFont.truetype(str(OUT/'KieranHandwriting-Bold.ttf'),1000)
def bitmap(char):
    mask,offset=bold_raster.getmask2(char,mode='L',anchor='ls')
    return np.asarray(mask,dtype=np.uint8).reshape(mask.size[1],mask.size[0])>128,offset
cmap=font.getBestCmap()
reverse_pairs={name:chr(code) for code,name in cmap.items()}
for (first_name,second_name),adjust in font['kern'].kernTables[0].kernTable.items():
    a,b=reverse_pairs[first_name],reverse_pairs[second_name]
    first,(ax,ay)=bitmap(a);second,(bx,by)=bitmap(b)
    bx+=font['hmtx'][first_name][0]+adjust
    left,top=max(ax,bx),max(ay,by)
    right,bottom=min(ax+first.shape[1],bx+second.shape[1]),min(ay+first.shape[0],by+second.shape[0])
    if left<right and top<bottom:
        overlap=first[top-ay:bottom-ay,left-ax:right-ax]&second[top-by:bottom-by,left-bx:right-bx]
        assert not np.any(overlap),(a+b,'bold pair overlap')
(DOCS/'bold-verification.json').write_text(json.dumps({'family':'Kieran Handwriting','style':'Bold','version':version,'weightClass':700,'glyphs':records},indent=2)+'\n',encoding='utf-8')
canvas=Image.new('RGB',(1500,820),'#f8f5ef');draw=ImageDraw.Draw(canvas)
label=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',22)
for y,style in ((35,'Regular'),(425,'Bold')):
    draw.text((35,y),f'Kieran Handwriting {style} - v{release}',font=label,fill='#626c62')
    face=ImageFont.truetype(str(OUT/f'KieranHandwriting-{style}.ttf'),64)
    draw.text((35,y+45),'you   your   Tom   Tomorrow',font=face,fill='#344e3c')
    draw.text((35,y+190),'A little progress, every day. 012345',font=face,fill='#252626')
canvas.save(DOCS/'regular-bold-preview.png')
print(f'Bold v{release}: {len(records)} outlined glyphs; counters retained; all kerned pairs collision-free; linked family metadata validated.')
