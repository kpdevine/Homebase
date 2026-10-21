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


iPhone follow-up: the owner confirmed Mars is selected and orange at pocketplanet.day, but the shade appears old after repeated refreshes. Do not infer that caching is the proven cause. The theme generator now publishes the balanced palette and early initialization script at SHA-256-derived file paths, and Settings → About this display exposes the palette revision. The same palette values are retained; a direct revision link forces a fresh document URL without clearing saved records. Actual iPhone visual confirmation remains with the owner. No test suite run for this delivery, as requested.


Owner's iPhone screenshot showed the Mars background remained visibly vivid after fresh loads. The previous saturation reduction was too subtle; caching was not established as the cause and must not be reported as a confirmed fix. The palette now uses 42–58% saturation instead of 64–80%, retaining the burnt hue and darkened luminance. This changes the actual mobile and desktop backgrounds, not only URLs. Runtime score colors, generated stylesheet, browser chrome and manifest use the same mapping. Content-addressed paths and the display revision remain for identification. No test suite run, as requested; actual iPhone appearance awaits owner review.


October 21 mobile hue follow-up: Mars shifts from 14° to 10° hue only in phone layouts (portrait and landscape). The 42–58% saturation mapping, luminance, opacity, desktop palette, and blue theme remain unchanged. Generated mobile CSS token overrides and runtime score/browser-chrome colors use the same phone media query and hue. Theme files retain content-addressed paths. Notification work was stopped at the owner's request after a successful Apple test push; this release changes only theme presentation and documentation. No test suite run for the hue-only change.

October 21 to-do heading fix (local, held): one renderer now owns the to-do card title, so partial day-review updates cannot swap it between competing labels. The active app day says TODAY; another selected date says TO-DO LIST. Its full date stays in the existing eyebrow above the title, including a prior-day review retained after 1 a.m. A date is never used as the title. Three focused render regressions and the nine app-day tests pass. No push or deployment was performed.

October 21 stronger Mars follow-up (local, held): at the owner's request, saturation increases by eight percentage points across the Mars mapping, from 42–58% to 50–66%, including intermediate colors. Desktop hue stays 14 degrees and phone hue stays 10 degrees; luminance, opacity, and all blue theme fallbacks stay unchanged. CSS tokens, runtime colors, browser chrome, and the Mars manifest use the same adjustment. Mobile screen gradient: #c4614e to #b24f3b to #9f4635; ink #361812, input surface #dc9d90, ice highlight #f5d4cd. Display revision edca68ef9d4d. Three focused existing theme checks pass. Logo demos are being matched separately; existing published icons remain unchanged. No commit, push, or deployment was performed.


October 21 release approved by the owner: the publication hold is lifted for the reviewed Blue V6/Mars V7 icons and all accumulated theme, app-day, and To-do heading changes. The approved icons replace all four standard sizes per theme, with versioned HTML, runtime, and manifest references. Existing records and notification infrastructure are unchanged. GitHub source/PRD and Firebase Hosting are published together.
