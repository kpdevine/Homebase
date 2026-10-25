# Approved orbital meter — October 25, 2026

The owner reviewed the isolated local study and requested publication throughout the app. All shared score rings now use a bright blue or warm Mars fill, a dark continuous edge, a contrasting rail, and a soft glow behind the edge. The same treatment covers Overview, Nutrition, Sentiments, final review, Sleep/Prayer, weekly target controls, Training, Calendar averages/days/weeks, recaps, weight-chart score cards and Solar System score displays.

Editable meters have a large planet handle. Four new faces at scores 0, 3, 5 and 7 mix with the existing Crying, Sad, Thinking, Happy, Strong, Party and Fire reactions. The newly generated eyes vary between X shapes, heavy bars, oval dots and square dots; the rejected glossy-eye artwork is never shipped. Each whole-number band selects its face; the ring fill remains continuous and exact. Weekly targets scale the same appearance over their existing 0–20 set range. Passive meters have no visible planet.

The full number, including its fractional part, is centered horizontally and vertically on the ring. Ten has tighter digit spacing. Per the owner's final refinement, visible “out of 10” captions are removed; accessible labels retain the scale. Target units remain visible.

Nutrition now accepts 0–10, matching the other score controls. Typed values still allow two decimal places, dragging/buttons/arrows use tenths, and Home/End select 0/10. A recorded zero remains distinct from an unentered value: it is a real score, can be reviewed, enters averages, and survives backup/cloud validation. Previous positive values and missing records retain their meaning. Scoring weights, tasks, Training rules, and existing personal records are unchanged.

Ring gestures unwrap angles across the bottom gap. Zero and ten are hard stops; the user reverses through the same pole to return to the scoring arc. Grabbing a planet away from its center preserves the score. Center gestures retain relative adjustment. Pointer release, cancellation, lost capture and window blur end the gesture and clear pointer focus; keyboard focus remains available. Macro Nutrition and other passive meters reject dragging. Ring fills, dark edges and glows animate together and honor reduced motion.

## Verification

- Regular suite: 254 tests, 253 passed, one emulator-only skip. No Firestore rule changes.
- Eleven score bands resolve to real shipped assets; four are new. Zero/empty/perfect rendering, both palettes, Nutrition zero validation/restore, full-arc movement, both gap directions and pointer cleanup are covered.
- Browser sample QA: Nutrition zero and compact ten, editable planet loading, both themes, and 42 Calendar/recap passive circles with exactly centered number containers and no planets. Normal and pole-crossing behavior use the shared tested gesture helper. Preview runs on port 4207 with separate sample storage and no Firebase initialization.
- Final visual screenshots are retained in `output/ui-review/`.

Artwork provenance and the built-in image generation prompts are in [orbital-meter-artwork.json](orbital-meter-artwork.json). Four compact lossless WebP sprites are shipped; generated originals and the isolated study remain local.

Delivery follows the existing GitHub and Firebase Hosting workflow for `homebase-d3c6c` / `https://pocketplanet.day/`. Preserve the unrelated `server/reminders/policy.mjs` edits.
