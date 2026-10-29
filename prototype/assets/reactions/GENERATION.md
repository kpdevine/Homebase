# Pocket Planet reaction expansion — October 23, 2026

The original eleven PNGs are preserved. Eleven additional raster planets were generated with the built-in imagegen tool, with transparent backgrounds, using `happy.png` and `wow.png` as style references. No CLI/API fallback was used. All 22 can be selected as reactions and profile pictures.

Final sources: `distorted.png`, `laughing.png`, `crying.png`, `angry.png`, `thinking.png`, `wink.png`, `salute.png`, `grateful.png`, `melting.png`, `nerd.png`, `kiss.png` in this directory. `optimized/` contains content-addressed 160px icons and 320px portraits built by `scripts/optimize-reactions.py`; the app imports `reaction-assets.mjs`.

## Shared prompt

Use case: stylized-concept. Asset type: one transparent app reaction icon for Pocket Planet. Match the supplied pixel-art Jupiter planet exactly as a family: crisp stepped pixel silhouette, thick deep navy outlines, flat colorful swirling cloud bands, bold legible expression, chunky connected ring-arms and hands. Square composition with full character centered, comfortable transparent margin on all sides, no crop. One character only, no text, no label, no background, no checkerboard, no gradients or painterly blur. Rings must be the character's actual attached arms, no detached ring floating independently. Keep features expressive and readable at 40px.

The first four assets were initially prompted with blue/periwinkle cloud bands; Angry specified terracotta/peach. Following the owner's request to mix colors, later prompts explicitly override the blue reference palette.

## Individual prompts

- **distorted**: Distorted shock: enormous bulging white eyes, tiny navy pupils, comically flattened/stretched face, pinched trembling mouth, hands at temples.
- **laughing**: LAUGHING reaction: eyes squeezed into joyful inverted V shapes, big open laughing mouth, one ring-arm hand over lower belly and other hand wiping a tiny tear of laughter. Periwinkle blue Jupiter bands.
- **crying**: CRYING reaction: two broad pixel streams of icy blue tears down cheeks, sad curved eyebrows, small trembling downturned mouth, one ring-arm hand holding a tiny ice-blue tissue at cheek, other hand resting on belly. Lavender/periwinkle Jupiter bands. Tender, not scary.
- **angry**: FRUSTRATED / ANGRY reaction: terracotta red and peach Jupiter cloud bands, navy sharply lowered eyebrows and tight gritted little mouth, ring-arms with clenched fists at hips, two tiny steam puffs above head. Comical frustration, friendly overall.
- **thinking**: THINKING reaction: blue-gray/periwinkle Jupiter bands, one raised eyebrow, eyes glancing upward, small crooked pondering mouth; one attached ring-arm curves up to place hand under chin, other crosses body supporting elbow. Palette override: Use seafoam, mint, teal and cream instead of blue.
- **wink**: WINK reaction: one expressive star-like dot eye open and the other closed in a deliberate wink, broad cheeky curved smile, one attached ring-arm giving a small thumbs-up and other curved around lower body. Periwinkle blue striped Jupiter. Palette override: Use violet, lilac and pale pink instead of blue.
- **salute**: SALUTE reaction: friendly determined blue Jupiter planet, small confident smile and bright focused dot eyes, one connected ring-arm bends so its hand salutes at forehead, other hand resting on hip. No hats or flags. Palette override: Use golden ochre, warm amber and cream instead of blue.
- **grateful**: GRATEFUL / THANK YOU reaction: pale blue and lilac Jupiter bands, eyes softly closed and warm content smile, both attached ring-arms curve forward with palms pressed together in a thank-you pose, small warm golden sparkle near head. Hands visibly connected to arms. Palette override: Use turquoise and soft mint instead of blue.
- **melting**: MELTING / OVERWHELMED reaction: warm peach and lavender Jupiter planet, top remains a round striped planet while lower edge comically droops into a small soft pixel puddle, exhausted uneven eyes and slanted resigned smile, attached ring-arms droop loosely to sides. Cute readable pixel icon, no realistic fluids. Palette override: Use warm peach, coral and buttery yellow instead of blue.
- **nerd**: NERD / SMART reaction: blue Jupiter planet with oversized dark navy square spectacles, bright dot eyes visible in clear lenses, small proud smile with one little white tooth; one attached ring-arm raises an index finger as if sharing an idea, other curves around waist. Tiny gold idea sparkle. Palette override: Use deep violet, purple and pale lavender instead of blue.
- **kiss**: BLOWING A KISS reaction: rosy lavender-blue Jupiter planet, one closed wink eye and one dot eye, small pursed kiss mouth, one attached ring-arm hand lifted to mouth blowing a tiny red heart beside face, other arm curves around body. Distinct from heart-eyes Love planet; no heart-shaped eyes. Palette override: Use raspberry pink, rose red and blush instead of blue.

## Purple thumbs-up correction

The owner requested keeping the thumbs-up and correcting its connected arm. Final `wink.png` uses this targeted edit:

Use case: precise-object-edit. Edit this purple winking pixel Jupiter planet. Keep the thumbs-up, face, purple/pink bands, pixel style and transparent background unchanged. Correct ONLY the anatomy of the ring-arms: there must be exactly two connected arms each starting at a shoulder on a side of the planet and each ending in its own hand. The raised thumbs-up on viewer RIGHT must be attached to a complete arm that curves outward directly from the RIGHT side of the body to an elbow and then rises to the thumb hand. It must NOT continue down across the front of the body into the OTHER hand as a continuous strip: the lower-front hand belongs to the other arm wrapping from viewer LEFT and stops as a hand over the belly. Remove the false diagonal connector between the lower-front hand and raised thumbs-up arm. Make the two limb paths visually unambiguous. No extra detached planetary rings. Thick deep navy pixel outline. Preserve every other detail. Real alpha transparency.

## Mogging Moon — October 29

Approved source: `mogging.png`, copied from the final Moon draft v4. Built-in imagegen used existing wink/strong/thinking emojis as references; no CLI fallback. Silver cratered Moon, enlarged smug face, chiseled jaw, one jaw-pointing hand, no left arm, slightly crescent right contour, and right eye/brow contained inside the head. Code ID and accessible name: `mogging` / Mogging. This adds the 23rd reaction and portrait.

Final edit prompt:

Generation mode: built-in image_gen tool.
Status: review draft only; not added to the app.

Use case: precise-object-edit
Asset type: Pocket Planet Moon mogging reaction emoji, draft v4.
Input image: moon-mogging-v3.png is the EDIT TARGET.
Primary request: fix ONLY the viewer-right eye and its eyebrow so the entire eye is fully inside the Moon's head, with a visible band of pale ivory Moon surface separating the eye and eyebrow from the exterior navy silhouette.
In the current source, the viewer-right eye extends past the crescent contour into transparent space. Shift that complete smaller right eye and eyebrow inward (toward the viewer-left, the center of the face) enough to leave at least two chunky pixel-block widths of continuous light ivory Moon surface between all parts of that eye/brow and the outer head outline. If needed, slightly narrow that right eye to fit. Keep the same narrowed, smug mogging eye expression and original pixel design. Restore the original crescent outer contour where the eye formerly protruded: clean thick deep-navy stair-step outline without bulges, with transparent space outside. There must be no eyeball, pupil, eyelid or eyebrow outside or merged into the head's exterior outline.
Preserve EVERYTHING ELSE: large left eye, facial proportions, chiseled jaw, puckered smug mouth, crater shapes and positions, two sparkles, cool ivory/silver/periwinkle palette, original slight crescent silhouette with its inward right cheek notch, no viewer-left arm, and the remaining lower-right hand pointing to the jaw. Do not restore the removed right-side crater lobes. Keep the chunky clean pixel-art rendering and thick navy stepped outlines. This is a local correction, not a redesign.
Full single character on genuine alpha transparency; no text, no background, no frame, no watermark.
