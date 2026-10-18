# Kieran Handwriting

Version 1.500 (revision 1.5), October 16, 2026. Regular and Bold outline fonts based on the project owner's hand-drawn character sheet. The photo itself is not published in the prototype or stored here.

## Try it

For your computer, open both `prototype/assets/fonts/KieranHandwriting-Regular.ttf` and `KieranHandwriting-Bold.ttf` and choose **Install** in Windows for each. Both styles appear in the **Kieran Handwriting** family. Use the Bold button to select the actual Bold font; reopen an application if its font list does not refresh.

`KieranHandwriting-Regular-v1.5.ttf` and `KieranHandwriting-Bold-v1.5.ttf` are version-labeled copies for download. If an older version is installed, allow Windows to replace it and reopen applications that were using it. `KieranHandwriting-v1.5.zip` bundles both installable TTFs and installation instructions.

Revision 1.3 brings letters closer together by reducing their left and right sidebearings from 58 to 44 font units (punctuation: 65 to 50). The verified v1.2 outlines are translated horizontally without changing any relative outline coordinates, sizes, or stroke weights. Word spaces and kerning pairs retain their prior values.

Revision 1.4 reduces letter sidebearings to 36 units, punctuation to 42, and lowercase o to 26. It adds targeted kerning for yo (-95 units), strengthens To (-100), and adjusts other common pairs around o. Pair adjustments are present in both OpenType GPOS and a compatible legacy kern table. The regular glyph shapes remain identical to v1.3. All 35 kerning pairs are checked for actual ink collisions in both weights.

Revision 1.5 adds pair spacing before j for every preceding Latin letter (52 pairs), allowing its hook to tuck under the prior letter while leaving the stem naturally spaced. The nj pair is -410 units; aj is -405 and oj is -380. Other descending letters such as g, q, y, and j receive gentler adjustments where their tails share the same vertical space. Both weights retain at least 35 units of actual ink clearance in all new j pairs. All 87 pairs remain collision-free. Glyph coordinates, advance widths, stroke weight, and the earlier yo/To adjustments are unchanged. `j-kerning-verification.json` records the pair measurements; `j-spacing-preview.png` compares the result. Pair adjustments require kerning enabled in the writing app.

Bold uses an 18-unit outward outline expansion (about 106-unit shafts compared with Regular's 70). It retains the drawing's proportions and adds width to accommodate the heavier ink. Actual bowls stay open; minute pockets at overlapping pen strokes may fill naturally. Bold is linked through family/style names, weight class 700, and the OpenType bold style flags. It is a separate static font in the same family.

For the optional specimen, run the existing local preview and open `/font-preview.html`. It supports typing, a size slider, a Bold toggle, and both TTF downloads. The dashboard also declares Regular v1.5 in `prototype/typography.css` for checklist item text and the add-item field at 24px. Headings, controls, summaries, and other interface text retain Inter and Space Grotesk. Italic is not supplied.

## Files

- `prototype/assets/fonts/KieranHandwriting-Regular.ttf`: installable desktop font.
- `prototype/assets/fonts/KieranHandwriting-Regular.woff2`: compressed web font served locally.
- `prototype/assets/fonts/KieranHandwriting-Bold.ttf` and `.woff2`: linked Bold style.
- `specimen.png`: sample text rendered independently with FreeType.
- `outlines.svg`: traced quadratic contours, identified by Unicode codepoint in SVG symbols.
- `glyphs.json`: source crop coordinates and advance widths for each traced glyph.

Uppercase, lowercase, digits, and the photographed punctuation are included: 91 traced glyphs and 95 mapped codepoints including spaces and quote aliases. The comma is extracted from the lower portion of the drawn semicolon. Straight apostrophe and quotation marks reuse the corresponding curly shapes. Characters absent from the sheet (for example percent signs, braces, accented letters, and dashes other than the hyphen) use browser fallback; they are not silently filled with invented handwriting.

## Build and verification

Install Pillow, numpy, opencv-python-headless, fonttools, and brotli in a build environment. The script also recognizes local dependencies under the ignored `.font-build/deps` directory. Run:

```sh
python scripts/build-handwriting.py PATH_TO_ORIGINAL_PHOTO
python scripts/build-handwriting-bold.py
```

The crop map is specific to this sheet's layout. The script scales it to the original photo dimensions, thresholds the dark ink, and selects the correct connected ink components, retaining legitimate dots and quotation strokes. It rejects any selected ink that touches a crop edge. This removes neighboring ink formerly captured by K, k, and P. Genuine counters are retained and small paper pinholes are filled.

Every glyph uses a single uniform scale for both axes. The descending glyphs g, j, p, q, and y are sized to match the other lowercase bodies at 430 font units above the baseline. For j, the body begins at the stem, excluding its dot. This corrects the undersized bodies in version 1.1, which used paired capitals as the scale reference. The entire glyph is scaled uniformly, including the tail and dot; below-baseline compression remains removed. Weight correction is recalibrated at the resulting size. The visible body heights are verified in the exported font, and the line metrics provide room for the original long descenders.

Stroke weight is calibrated after scaling, in font units, to a shared median shaft width of 70/1000 em. A constant inward or outward offset adjusts the existing contour without redrawing the centerline or changing the scale along either axis. Counter and component topology must stay unchanged. A temporary thinned copy is used ONLY to measure width, never to construct the exported outlines. Subtle local variation from the original drawing remains; this is a balanced handwritten outline, not a geometric monoline reconstruction. Vector outlines preserve relative weight as the font size changes. Sidebearings and light kerning remain.

Both exported formats are reopened to verify character coverage, positive advance widths, and vertical bounds. Equal scale factors and consistent measured stroke widths are checked. The actual exported TTF is independently rasterized with FreeType at 1000 px to confirm stroke weight. The specimen is rendered with Pillow/FreeType for visual review.

The owner's handwriting is original project artwork. Third-party font licenses in the fonts directory apply only to those separately named typefaces.

The notes cursor uses `prototype/assets/handwriting-caret.svg`, extracted from the LCD font's slash and rotated upright. Rebuild it with `python scripts/build-handwriting-caret.py` after updating that font. The trimmed vector removes font sidebearing and baseline offsets while retaining the owner's original stroke shape. Cursor positioning also reverses ancestor display scaling before applying textarea scroll offsets.
