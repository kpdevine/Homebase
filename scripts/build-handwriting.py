"""Trace the user's character sheet into Kieran Handwriting (no source photo published).

Usage: python scripts/build-handwriting.py PATH_TO_PHOTO
Build dependencies: Pillow, numpy, opencv-python-headless, fonttools, brotli.
Optional project-local packages are loaded from .font-build/deps.
"""
from pathlib import Path
from shutil import copyfile
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.font-build' / 'deps'))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

OUT = ROOT / 'prototype' / 'assets' / 'fonts'
SOURCE = ROOT / 'docs' / 'handwriting'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)

# Crop coordinates refer to the 1727 x 1472 preview. Each crop contains one
# complete glyph, including disconnected dots; no recognition model is used.
ROWS = [
    ('AaBbCcDdEeFf', [(70,90,165,190),(190,115,259,185),(350,82,430,190),(442,94,516,188),(590,82,666,185),(670,110,730,180),(799,70,900,185),(900,80,976,180),(1018,65,1119,183),(1118,104,1188,180),(1260,57,1361,192),(1360,75,1460,195)]),
    ('GgHhIiJjKkLl', [(55,230,157,372),(169,285,246,420),(344,245,432,354),(431,249,508,350),(629,233,691,341),(699,246,739,334),(821,235,918,343),(910,251,984,394),(1040,230,1148,351),(1135,243,1210,350),(1251,235,1336,347),(1332,236,1370,345)]),
    ('MmNnOoPpQqRr', [(53,417,169,555),(180,474,298,550),(369,398,470,545),(477,465,549,535),(641,403,738,522),(750,452,813,515),(898,395,998,517),(990,445,1059,553),(1126,381,1231,502),(1224,434,1299,552),(1362,369,1461,504),(1464,429,1532,501)]),
    ('SsTtUuVvWw', [(45,595,137,704),(153,633,213,700),(335,582,478,705),(483,601,558,697),(692,572,781,683),(788,603,861,679),(930,554,1029,687),(1029,611,1097,681),(1187,555,1308,685),(1318,604,1424,676)]),
    ('XxYyZz', [(41,739,159,864),(177,781,240,851),(341,715,445,838),(450,768,533,908),(605,719,713,845),(718,777,797,849)]),
    ('0123456789', [(24,1097,104,1186),(148,1098,219,1182),(252,1099,312,1178),(346,1099,412,1182),(419,1095,495,1180),(507,1096,584,1174),(615,1096,687,1174),(694,1095,763,1171),(774,1090,843,1176),(853,1089,917,1177)]),
]
SPECIAL = [
    (',',(1198,806,1238,854),210,-110),
    ('.',(912,800,953,840),90,0), ('!',(1046,726,1094,844),700,0),
    (';',(1185,745,1238,854),570,-80), (':',(1279,748,1326,844),500,80),
    ('-',(1368,781,1428,814),95,270), ('?',(1470,735,1540,871),700,0),
    ('_',(1557,833,1676,866),85,-110),
    ('“',(42,908,98,963),210,510), ('”',(236,907,299,962),210,510),
    ('(',(430,900,480,1036),850,-150), (')',(551,897,598,1035),850,-150),
    ('[',(660,889,709,1029),850,-150), (']',(751,888,804,1028),850,-150),
    ('~',(882,931,962,974),140,250), ('<',(1060,910,1148,1017),510,90),
    ('>',(1211,907,1294,1027),510,90), ('*',(1383,922,1471,1004),430,210),
    ('+',(1546,927,1629,1002),470,100), ('#',(1110,1065,1222,1170),700,0),
    ('=',(1292,1088,1357,1150),300,180),
    ('‘',(1477,1047,1515,1100),210,510), ('’',(1604,1047,1638,1098),210,510),
    ('/',(26,1269,140,1385),760,-60), ('\\',(166,1269,266,1397),760,-60),
    ('|',(373,1251,410,1391),850,-150), ('@',(501,1253,612,1373),760,-60),
    ('&',(727,1264,811,1367),700,0), ('$',(877,1263,951,1357),820,-60),
]
DESCENDERS = {'g':329, 'j':329, 'p':491, 'q':480, 'y':812}
ASCENDERS = set('bdfhkl')
VERSION = '1.500'
RELEASE = '1.5'
BODY_HEIGHT = 430
TARGET_STROKE = 70.0  # Font units. Shared by every glyph and every font size.
ASCENT, DESCENT = 900, 1200
MULTIPART = set('ij!?;:“”=')

def extract(image, box, char=None):
    sx, sy = image.width / 1727, image.height / 1472
    crop = np.asarray(image.convert('L').crop(tuple(round(v * (sx if i % 2 == 0 else sy)) for i,v in enumerate(box))))
    # A gentle blur removes paper texture. Only the dark pen is retained.
    mask = np.uint8(cv2.GaussianBlur(crop, (3,3), 0) < 132) * 255
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    clean = np.zeros_like(mask)
    candidates = [index for index in range(1,count) if stats[index,cv2.CC_STAT_AREA] >= 12*sx*sy]
    expected = 2 if char in MULTIPART else 1
    if char is not None:
        # K/k and P/p overlap the rectangular crop margins. Select whole ink
        # components, retaining deliberate dots and quote strokes only.
        candidates = sorted(candidates,key=lambda i:stats[i,cv2.CC_STAT_AREA],reverse=True)[:expected]
        if len(candidates) != expected:
            raise ValueError(f'{char!r}: expected {expected} ink components')
    for index in candidates:
        clean[labels == index] = 255
    # Discard paper pinholes inside the stroke, keeping drawn counters.
    contours,hierarchy=cv2.findContours(clean,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    for i,contour in enumerate(contours):
        if hierarchy[0,i,3] >= 0 and cv2.contourArea(contour) < 12*sx*sy:
            cv2.drawContours(clean,[contour],-1,255,-1)
    ys, xs = np.where(clean)
    if len(xs) == 0:
        raise ValueError(f'Empty crop: {box}')
    left, top, right, bottom = xs.min(), ys.min(), xs.max()+1, ys.max()+1
    if char is not None and (left == 0 or top == 0 or right == clean.shape[1] or bottom == clean.shape[0]):
        raise ValueError(f'{char!r}: selected ink touches crop boundary')
    return clean[top:bottom,left:right], (box[1]*sy+top)/sy

def stroke_width(mask, compact_dots=False):
    """Measure median shaft width on a measurement-only thinned centerline."""
    distance=cv2.distanceTransform(mask,cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
    count,labels,stats,_=cv2.connectedComponentsWithStats(mask)
    contours,hierarchy=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    # Compact dots have no shaft. Measure their inscribed diameter directly,
    # avoiding unstable skeleton branches in tiny circular punctuation.
    if compact_dots and len(contours)==count-1:
        return float(np.median([2*distance[labels==i].max() for i in range(1,count)]))
    # Work at half resolution for the measurement skeleton. This is never used
    # to draw the font: exported shapes still come from the original outline.
    thin=np.uint8(cv2.resize(mask,None,fx=.5,fy=.5,interpolation=cv2.INTER_AREA)>=128)
    while True:
        changed=False
        for phase in (0,1):
            p=np.pad(thin,1)
            n=[p[:-2,1:-1],p[:-2,2:],p[1:-1,2:],p[2:,2:],p[2:,1:-1],p[2:,:-2],p[1:-1,:-2],p[:-2,:-2]]
            count=sum(n)
            transitions=sum((n[i]==0)&(n[(i+1)%8]==1) for i in range(8))
            if phase==0:
                guard=(n[0]*n[2]*n[4]==0)&(n[2]*n[4]*n[6]==0)
            else:
                guard=(n[0]*n[2]*n[6]==0)&(n[0]*n[4]*n[6]==0)
            remove=(thin==1)&(count>=2)&(count<=6)&(transitions==1)&guard
            if np.any(remove):
                thin[remove]=0
                changed=True
        if not changed:break
    ys,xs=np.where(thin)
    radii=cv2.remap(distance,(xs*2+.5).astype(np.float32),(ys*2+.5).astype(np.float32),cv2.INTER_LINEAR).ravel()
    radii=radii[radii>3]
    if not len(radii): raise ValueError('No measurable stroke')
    # A trimmed median is stable around joins, rounded ends, and dots.
    low,high=np.quantile(radii,[.15,.85])
    return float(2*np.median(radii[(radii>=low)&(radii<=high)]))

def topology(mask):
    contours,hierarchy=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    return tuple(sorted((int(hierarchy[0,i,3] < 0),) for i,c in enumerate(contours) if abs(cv2.contourArea(c))>6))

def balance_weight(mask, scale, compact_dots=False):
    """Offset the existing outline; never stretch, skeletonize, or redraw it."""
    # Rasterize in font units, so every glyph's weight is calibrated AFTER its
    # uniform scale, rather than thickening small letters differently in pixels.
    scaled=cv2.resize(mask,None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
    scaled=np.uint8(scaled>=128)*255
    pad=100
    scaled=cv2.copyMakeBorder(scaled,pad,pad,pad,pad,cv2.BORDER_CONSTANT,value=0)
    before=stroke_width(scaled,compact_dots)
    inside=cv2.distanceTransform(scaled,cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
    outside=cv2.distanceTransform(255-scaled,cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
    field=inside-outside
    desired_topology=topology(scaled)
    best,best_error,best_offset=scaled,abs(before-TARGET_STROKE),0.0
    # Search constant normal offsets. The centerline and all source proportions
    # stay intact; only the thickness moves. Prevent lost counters or strokes.
    center=(before-TARGET_STROKE)/2
    for offset in [center,center-1,center+1,center-2,center+2,center-4,center+4,center*.8,center*.6,center*.4]:
        candidate=np.uint8(field > offset)*255
        width=stroke_width(candidate,compact_dots)
        error=abs(width-TARGET_STROKE)
        if error < best_error and topology(candidate)==desired_topology:
            best,best_error,best_offset=candidate,error,float(offset)
            if error <= 1.5: break
    return best,pad,{'before':round(before,2),'after':round(stroke_width(best,compact_dots),2),'outlineOffset':round(best_offset,2)}

def main():
    image = Image.open(sys.argv[1])
    source_records = [(char,box) for chars,boxes in ROWS for char,box in zip(chars,boxes,strict=True)]
    source_records.extend((char,box) for char,box,*_ in SPECIAL)
    extracted={char:extract(image,box,char) for char,box in source_records}
    records = []
    for chars, boxes in ROWS:
        for char, box in zip(chars, boxes, strict=True):
            height = 700 if char.isupper() or char.isdigit() or char in ASCENDERS else 430
            if char == 't': height = 590
            if char == 'i': height = 630
            records.append((char, box, height, 0))
    records.extend(SPECIAL)
    glyphs, metrics, cmap, previews = {}, {}, {}, []
    glyph_order = ['.notdef', 'space']
    empty = TTGlyphPen(None)
    glyphs['space'], metrics['space'] = empty.glyph(), (330,0)
    missing = TTGlyphPen(None)
    for points in [[(70,0),(70,700),(490,700),(490,0)],[(130,60),(430,60),(430,640),(130,640)]]:
        missing.moveTo(points[0])
        for p in points[1:]: missing.lineTo(p)
        missing.closePath()
    glyphs['.notdef'], metrics['.notdef'] = missing.glyph(), (560,70)
    manifest, source_symbols = [], []
    for char, box, height, offset in records:
        mask, source_top = extracted[char]
        h,w = mask.shape
        sx = image.width / 1727
        sy = image.height / 1472
        scale = height / h
        baseline = None
        body_height = None
        if char in DESCENDERS:
            baseline = (DESCENDERS[char] - source_top) * sy
            # Match the lowercase body, not the capital or total glyph height.
            # j's body starts at the stem, below its separate dot.
            stats=cv2.connectedComponentsWithStats(mask)[2][1:]
            body_top=float(max(stats,key=lambda s:s[cv2.CC_STAT_AREA])[cv2.CC_STAT_TOP]) if char=='j' else 0.0
            body_height=baseline-body_top
            scale=BODY_HEIGHT/body_height
        balanced,pad,weight=balance_weight(mask,scale,char in '.:')
        body_ink_height=None
        if char in DESCENDERS:
            # Outline weight correction moves the top edge slightly. Calibrate
            # the visible body as well, scaling the entire glyph each time.
            for attempt in range(4):
                stats=cv2.connectedComponentsWithStats(balanced)[2][1:]
                top=float(max(stats,key=lambda s:s[cv2.CC_STAT_AREA])[cv2.CC_STAT_TOP]) if char=='j' else float(np.where(balanced)[0].min())
                body_ink_height=baseline*scale-(top-pad)
                if abs(body_ink_height-BODY_HEIGHT)<2:break
                scale*=BODY_HEIGHT/body_ink_height
                balanced,pad,weight=balance_weight(mask,scale,char in '.:')
            assert abs(body_ink_height-BODY_HEIGHT)<3,(char,body_ink_height)
        ys,xs=np.where(balanced)
        ink_left,ink_right=xs.min(),xs.max()+1
        width = ink_right-ink_left
        # Narrow handwritten i/l retain natural widths, with extra breathing room.
        side = 26 if char == 'o' else (36 if char.isalnum() else 42)
        name = f'uni{ord(char):04X}'
        cmap[ord(char)] = name
        glyph_order.append(name)
        raw_pen = TTGlyphPen(None)
        pen = ReverseContourPen(raw_pen)
        contours, hierarchy = cv2.findContours(balanced, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        svg_paths = []
        def transform(point):
            x,y = point
            # Thickness correction is a constant outline offset in font units.
            # Coordinates are already uniformly scaled. Only translation remains.
            source_baseline = h if baseline is None else baseline
            fy = source_baseline*scale-(y-pad)+offset
            return (round(side+x-ink_left), round(fy))
        for contour in contours:
            if abs(cv2.contourArea(contour)) < 3: continue
            pts = cv2.approxPolyDP(contour, 1.0, True)[:,0,:]
            if len(pts) < 3: continue
            pts = [transform(p) for p in pts]
            # Quadratic midpoint interpolation smooths pixel stair-steps without
            # replacing the drawn contours with a generic stroke or skeleton.
            mid = lambda a,b: (round((a[0]+b[0])/2),round((a[1]+b[1])/2))
            start = mid(pts[-1], pts[0])
            pen.moveTo(start)
            commands = [f'M {start[0]} {-start[1]}']
            for i,p in enumerate(pts):
                end = mid(p,pts[(i+1)%len(pts)])
                pen.qCurveTo(p,end)
                commands.append(f'Q {p[0]} {-p[1]} {end[0]} {-end[1]}')
            pen.closePath()
            commands.append('Z')
            svg_paths.append(' '.join(commands))
        glyph = raw_pen.glyph()
        glyphs[name], metrics[name] = glyph, (round(width + side*2),side)
        previews.append((char,mask))
        manifest.append({'character':char,'codepoint':f'U+{ord(char):04X}','crop':box,'advance':metrics[name][0], 'scaleX':round(scale,8),'scaleY':round(scale,8),'baselineInSource':round(baseline if baseline is not None else h,3),'sourceSize':[w,h],'stroke':weight,'components':2 if char in MULTIPART else 1,**({'bodyInkHeight':round(body_ink_height,2)} if body_ink_height is not None else {})})
        source_symbols.append(f'<symbol id="{name}" viewBox="0 -{ASCENT} {metrics[name][0]} {ASCENT+DESCENT}"><path d="{" ".join(svg_paths)}"/></symbol>')
        print(f'{char!r}: stroke {weight["before"]} -> {weight["after"]}',flush=True)
    cmap[32] = 'space'
    cmap[160] = 'space'
    # Straight quotes use the corresponding drawn curly quote shapes.
    cmap[39] = cmap[0x2019]
    cmap[34] = cmap[0x201D]
    fb = FontBuilder(1000,isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT,descent=-DESCENT,lineGap=50)
    fb.setupNameTable({'familyName':'Kieran Handwriting','styleName':'Regular','uniqueFontIdentifier':f'KieranHandwriting-Regular-{VERSION}','fullName':'Kieran Handwriting Regular','psName':'KieranHandwriting-Regular','version':f'Version {VERSION}','description':'Traced from the project owner\u2019s hand-drawn character sheet, October 2026. Uniform scaling; balanced outline weight.'})
    fb.setupOS2(version=4,sTypoAscender=ASCENT,sTypoDescender=-DESCENT,sTypoLineGap=50,usWinAscent=ASCENT,usWinDescent=DESCENT,sxHeight=430,sCapHeight=700,usWeightClass=400,fsType=0,fsSelection=0xC0)
    fb.setupPost()
    fb.setupMaxp()
    # Only familiar problem pairs receive light optical kerning.
    kern = {'AV': -65, 'AW': -50, 'AY': -65, 'AT': -45, 'FA': -45, 'LT': -40, 'LV': -50, 'LY': -60, 'PA': -40, 'Ta': -45, 'Te': -45, 'To': -100, 'Tr': -35, 'Tu': -35, 'VA': -65, 'Va': -40, 'Ve': -40, 'Vo': -65, 'WA': -50, 'Wa': -35, 'Wo': -50, 'YA': -65, 'Ya': -50, 'Yo': -75, 'yo': -95, 'fo': -45, 'ro': -25, 'vo': -35, 'wo': -30, 'go': -30, 'ko': -20, 'Po': -35, 'Lo': -35, 'aj': -405, 'bj': -390, 'cj': -360, 'dj': -400, 'ej': -380, 'fj': -375, 'gj': -65, 'hj': -415, 'ij': -385, 'jj': -35, 'kj': -415, 'lj': -375, 'mj': -405, 'nj': -410, 'oj': -380, 'pj': -390, 'qj': -100, 'rj': -365, 'sj': -365, 'tj': -345, 'uj': -410, 'vj': -345, 'wj': -390, 'xj': -355, 'yj': -110, 'zj': -415, 'Aj': -370, 'Bj': -390, 'Cj': -405, 'Dj': -345, 'Ej': -375, 'Fj': -370, 'Gj': -415, 'Hj': -400, 'Ij': -385, 'Jj': -390, 'Kj': -405, 'Lj': -415, 'Mj': -395, 'Nj': -355, 'Oj': -345, 'Pj': -370, 'Qj': -355, 'Rj': -415, 'Sj': -395, 'Tj': -380, 'Uj': -355, 'Vj': -380, 'Wj': -375, 'Xj': -405, 'Yj': -390, 'Zj': -415}
    rules = '\n'.join(f'pos {cmap[ord(a)]} {cmap[ord(b)]} {v};' for (a,b),v in kern.items())
    addOpenTypeFeaturesFromString(fb.font, 'feature kern {\n'+rules+'\n} kern;')
    legacy=newTable('kern')
    legacy.version=0
    pair_table=KernTable_format_0()
    pair_table.version=0
    pair_table.coverage=1
    pair_table.kernTable={(cmap[ord(a)],cmap[ord(b)]):v for (a,b),v in kern.items()}
    legacy.kernTables=[pair_table]
    fb.font['kern']=legacy
    fb.font['head'].fontRevision=float(RELEASE)
    fb.save(OUT / 'KieranHandwriting-Regular.ttf')
    fb.font.flavor = 'woff2'
    fb.font.save(OUT / 'KieranHandwriting-Regular.woff2')
    (SOURCE/'glyphs.json').write_text(json.dumps({'family':'Kieran Handwriting','version':VERSION,'targetStroke':TARGET_STROKE,'glyphs':manifest},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (SOURCE/'outlines.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg">\n'+'\n'.join(source_symbols)+'\n</svg>\n',encoding='utf-8')
    # Render with FreeType independently of the font-writing code for visual QA.
    font_path = str(OUT/'KieranHandwriting-Regular.ttf')
    sheet = Image.new('RGB',(1500,1450),'#f8f5ef')
    draw = ImageDraw.Draw(sheet)
    samples = [(52,'Kieran Handwriting',45),(26,f'Version {RELEASE} - matched lowercase bodies, original proportions',150),(55,'ABCDEFGHIJKLMNOPQRSTUVWXYZ',230),(55,'abcdefghijklmnopqrstuvwxyz',365),(58,'0123456789',500),(60,'g j p q y   K k P p   gyp jumps quickly',620),(44,'The quick brown fox jumps over the lazy dog.',770),(48,'Daily check-in   Nutrition   Training',885),(52,'Today: 7.8 / 10   |   24 sets   |   + Add a task',1000),(46,'! ? . , ; : - _ ( ) [ ] ~ < > * + # =',1120),(46,'“Hello!”  ‘Homebase’  @ & $ / \\ |',1240)]
    for size,text,y in samples:
        draw.text((55,y),text,font=ImageFont.truetype(font_path,size),fill='#252626')
    sheet.save(SOURCE/'specimen.png')
    for filename in ['KieranHandwriting-Regular.ttf','KieranHandwriting-Regular.woff2']:
        font=TTFont(OUT/filename)
        assert set(range(65,91)) | set(range(97,123)) | set(range(48,58)) <= set(font.getBestCmap())
        assert all(font['hmtx'][name][0] > 0 for name in font.getGlyphOrder())
        for name in font.getGlyphOrder():
            glyph=font['glyf'][name]
            if glyph.numberOfContours:
                assert glyph.yMin >= -DESCENT and glyph.yMax <= ASCENT, (name,glyph.yMin,glyph.yMax)
    assert all(g['scaleX']==g['scaleY'] for g in manifest)
    assert all(abs(g['stroke']['after']-TARGET_STROKE) < 4 for g in manifest if g['character'].isalnum()), 'Stroke weight outlier: inspect manifest'
    # Measure the actual exported outlines through a second renderer, rather
    # than trusting only the intermediate image used to construct the font.
    raster_font=ImageFont.truetype(font_path,1000)
    for record in manifest:
        mask=raster_font.getmask(record['character'],mode='L')
        pixels=np.asarray(mask,dtype=np.uint8).reshape(mask.size[1],mask.size[0])
        pixels=cv2.copyMakeBorder(np.uint8(pixels>=128)*255,10,10,10,10,cv2.BORDER_CONSTANT,value=0)
        width=stroke_width(pixels,record['character'] in '.:')
        # Short punctuation skeletons vary by a few units with raster-grid
        # alignment; longer letter shafts support a tighter measurement bound.
        tolerance=5 if record['character'].isalnum() else 8
        assert abs(width-TARGET_STROKE)<tolerance,(record['character'],width)
        if record['character'] in DESCENDERS:
            _,offset=raster_font.getmask2(record['character'],mode='L',anchor='ls')
            stats=cv2.connectedComponentsWithStats(pixels)[2][1:]
            top=float(max(stats,key=lambda s:s[cv2.CC_STAT_AREA])[cv2.CC_STAT_TOP]) if record['character']=='j' else float(np.where(pixels)[0].min())
            ink_body=-(offset[1]+top-10)
            assert abs(ink_body-BODY_HEIGHT)<4,(record['character'],'exported body',ink_body)
    copyfile(OUT/'KieranHandwriting-Regular.ttf',OUT/f'KieranHandwriting-Regular-v{RELEASE}.ttf')
    print(f'Built {len(records)} traced glyphs; {len(cmap)} mapped characters; TTF and WOFF2 validated.')

if __name__ == '__main__':
    main()
