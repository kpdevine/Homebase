# October 20 refinements checkpoint

All ten requested areas are implemented: Mars palette/icons; sign-in sync consent; edge-to-edge sticky tabs; pre-log task projection; disabled spellcheck; iPhone safe-area, text/keyboard and narrow-screen refinements; Nutrition guidance; creatine scoring; stable tab navigation; and name-save feedback.

The owner requested more saturation after the initial preview. The final palette uses a darker, more saturated burnt rust with warm highlights. The Nutrition copy was updated again at the owner's request to remove “feel fueled.”

## Scoring and data compatibility

Daily training = rounded(existing gym/rest score × 0.9 + creatine point), capped at 10. The existing attendance-plus-sets formula and chronological useful-set/rest-credit replay remain unchanged. Creatine adds 0 or 1 on every answered training day, including rest. It alone does not answer lifting/rest or satisfy logging. Missing a dose can be reviewed honestly. Zero set targets leave only the single creatine point available. Legacy records without the optional boolean retain their old score until lifting/rest, sets or creatine is explicitly edited. Backup validation and cloud serialization preserve the optional field and reject invalid values.

## Verification

- 189 app tests pass, including new creatine, projection, consent, theme and icon checks. The existing gym tests now also inspect the unchanged gym component independently of the combined training score.
- 2 reminder service tests pass. The logging definition is unchanged, so no Worker redeployment is required.
- Browser screenshots checked at iPhone-style sizes 375×667, 393×852, 430×932; landscape 852×393; desktop 1280×800. Found and fixed the narrow-screen two-row tab strip and the desktop Nutrition clipping caused by size containment.
- Verified a checkbox takes Training from 9 to 10, checked Saved name feedback, theme switching, full-width pinned tabs, and switching from a deeply scrolled Training page to Nutrition with content visible directly below the pinned strip.
- This Windows browser verification does not simulate an actual iOS keyboard or Home Screen icon caching. CSS safe-area/visualViewport handling is present; existing installed icons may require re-adding.
- Test-only sample data uses isolated preview storage. No private records were changed and no credentials are included in source.

## Theme maintenance

The app remains buildless. Existing blue CSS colors are fallback values in LCD custom properties. After adding/changing CSS colors, run `node scripts/build-theme.mjs` to refresh the Mars token palette. The generator is idempotent. `theme-init.js` maps runtime score/animation colors consistently and applies theme/icon preferences before rendering. Image files and both manifests are ordinary Hosting assets.


Final palette adjustment: after comparing previews, the owner requested slightly less saturation. Keep the burnt rust hue and darker LCD contrast, with moderate saturation between the first muted preview and the strongest orange preview. Browser theme color and Mars manifest background track the same palette mapping. The owner chose to keep the web app after discussing the native iOS limitation: browser/install icon metadata updates automatically, but an existing iPhone Home Screen icon cannot be forcibly switched through a web API. Do not promise or require automatic native icon replacement; no native iPhone conversion is in scope.

Phone cache follow-up: version all page stylesheet URLs and the early-theme/app entry scripts as 20261020-mars-balanced-2. This forces a new asset URL on the next document load, including the base CSS that consumes the Mars tokens. Existing open iPhone pages still require a refresh or a full close/reopen; user records and theme preference remain in the same origin's storage. No additional test suite run, per the owner's request.
