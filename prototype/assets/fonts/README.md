# Bundled typefaces

- **Kieran Handwriting Regular and Bold** — the owner's character sheet traced into TTF and WOFF2, with a linked Bold style. The dashboard uses Regular v1.5 for checklist item text and the add-item field; Inter and Space Grotesk remain the interface and display faces. See `docs/handwriting/README.md` for coverage, provenance, and rebuilding; open `/font-preview.html` in the local preview to try it.
- **Inter Variable** — interface text, controls, labels, and dates. Original file: https://github.com/rsms/inter/blob/master/docs/font-files/InterVariable.woff2
- **Space Grotesk Variable** — headings, score numbers, and training totals. Original file: https://github.com/floriankarsten/space-grotesk/blob/master/fonts/woff2/SpaceGrotesk%5Bwght%5D.woff2

Downloaded from the upstream repositories for this local prototype. Both files are unmodified and served from this directory; no third-party font service is contacted when the dashboard opens.

The upstream SIL Open Font License notices are included as `Inter-OFL.txt` and `SpaceGrotesk-OFL.txt`.

- **Radio Display Regular** — a locally generated stepped adaptation of the bundled Space Grotesk for LCD-style headings, clock, scores, tabs, and labels. Built by `scripts/build-radio-font.py` at a 48px raster grid, with renamed font metadata. Derived from Space Grotesk, copyright 2020 The Space Grotesk Project Authors, under the included `SpaceGrotesk-OFL.txt` (SIL OFL 1.1). Rebuild uses fonttools, brotli, and Pillow (optional `.font-build/deps`); those are build-time tools only. The font is served locally.


## Dashboard LCD derivatives (October 17)

`KieranHandwriting-LCD.woff2` is built from the original v1.5 regular face by `scripts/build-handwriting-lcd.py`. Its stepped outlines retain advances, kerning, and positioning; original font assets/specimens remain unchanged. The entry face applies tighter browser metrics, and notes use the handwritten slash rotated upright as a decorative cursor.

`RadioUI-Regular.woff2` is the stepped Inter companion for small UI labels, generated locally by `scripts/build-radio-ui-font.py`. It retains the Inter source license in `Inter-OFL.txt` and uses a distinct family name. Radio Display remains the Space Grotesk derivative described above. No external font service is used.

The bold dashboard face is `KieranHandwriting-LCD-Bold.woff2`, built with `python scripts/build-handwriting-lcd.py --bold`. The overview task heading uses it with cap-focused line metrics so it clears its border. Task labels use the regular entry metrics to align checkboxes with the letter bodies while allowing close descenders.

RadioDisplay-Bold.woff2 is built locally with python scripts/build-radio-font.py --bold. It supplies the bold time greeting while the name remains regular.
