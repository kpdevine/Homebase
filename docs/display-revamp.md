# Display-first Homebase revamp

Active brief: rebuild the working local app from the owner's October 16 sketch. Primary use is an Amazon Echo Show style landscape touch display; use a white background with restrained color. Keep the production stack open.

Owner clarification during implementation: the display will likely be jailbroken; prioritize a general landscape touch interface. Echo-specific delivery/APL work is outside this milestone.

## Acceptance criteria

- Overview follows the sketch: personalized greeting, today's interactive checklist on the left, central day-score ring, category breakdown on the right, visible clock, and calendar access.
- Central ring uses a smooth score-dependent color gradient, reaching green at 10/10. Missing and provisional scores are explained; numbers and ring lengths accompany color.
- Persistent independent tabs plus tappable breakdown items open Nutrition, Daily training, and Checklists. Calendar/history remains accessible. Keyboard navigation and touch-size controls work.
- Existing nutrition decimals/drag/keyboard, dated checklist edits, training/rest/set logging/removal, weekly targets, calendar navigation, explicit section review, and final day completion remain usable.
- Missing inputs show warnings and an overview action leads to the next section. Editing a completed day reopens affected review.
- Entries persist locally across refresh, with backup export/import and explicit storage-error handling. No cloud integration or deployment.
- A working provisional score updates from inputs. Calculation is documented in the UI; it is not a permanent product-policy choice.
- Verify landscape layouts at 960×480, 1024×600, 1280×800, and 1920×1080, plus phone widths. The primary overview fits those landscape screens; long task lists scroll within their panel. Other views may scroll.
- Test domain and persistence behavior; verify interactions and visual layout in the browser; save screenshots, resume notes, and a local source checkpoint.

## Design and device boundary

Warm white canvas, forest-green primary actions, soft mint/sand/lilac accents, generous touch controls, Inter interface text, Space Grotesk figures/headings, and the owner's current Kieran Handwriting on tasks. Avoid the previous app-sidebar layout on a wall display.

Amazon's APL viewport profiles distinguish small/medium/large landscape hubs and use device-independent dimensions. Test layout ranges rather than claiming one hard-coded resolution covers every Echo Show. The local browser app is not an APL skill and is not deployed to physical Echo Show hardware. Production delivery (browser/local service versus an Alexa/APL integration) remains an explicit later decision.

Official references:
- https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-alexa-viewport-profiles-package.html
- https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-viewport-property.html

## Provisional score

Equal shares for three sections: nutrition rating; completed checklist proportion; and training check-in (10 for dated set entries or an explicit rest day). An explicitly reviewed empty checklist counts as no tasks due (10). Unentered sections are omitted from the current average and labeled missing, so a partial score is provisional. Review/completion state is separate from performance; a day can be reviewed with unfinished tasks. Weekly set volume remains its own measure. The UI must explain these choices.

## Verification record

Completed October 16, 2026. The new overview maps each sketch element to a working control; all three existing categories have independent tabs as well as breakdown entry points. The clock and calendar remain visible on the overview. Compact review controls, nutrition decimals, and the current Kieran Handwriting v1.5 are retained. A following refinement removes the wordmark and home-plate favicon per the owner's feedback.

- 24 domain/persistence tests pass, including all original 13 checks. Application, model, scoring, and persistence syntax checks pass.
- 34 focused browser assertions passed: score calculations, perfect green, missing-input routing, decimals/keyboard/pointer dragging, independent navigation, guided review/completion, edit reopening, refresh persistence, sets/rest validation/removal, weekly targets, task undo, date isolation, calendar month navigation, name settings, and score explanation. Actual backup download and validated restore succeeded; invalid files were rejected before replacement.
- Overview fits 960×480, 1024×600, 1280×800, and 1920×1080 without page overflow. The two extreme sizes and 1024×600 were captured after final sizing adjustments. Long task lists scroll inside their panel. Details may scroll.
- Every tab was checked at 320px and 390px widths, with no horizontal overflow. Landscape overview and phone calendar screenshots, browser assertions, and viewport measurements are saved with the chat artifacts.
- No application warnings or errors were reported. Physical touch, screen-reader use, and the actual landscape hardware have not been tested.

Source checkpoint: branch `codex/homebase-prototype`, tag `homebase-landscape-2026-10-16`. The previous checkpoint is retained. Development remains local; no deployment or production technology choice was made.

## Visual refinement after phone review

The owner requested a larger corner clock, smaller task words with the task box kept at its current size, more color throughout, and removal of the logo everywhere. The logo markup, its JavaScript listener, styling, and home-plate favicon are removed. The clock now uses 44/52/64/88px type across the four landscape profiles (previously 25/29/33/48px). Task handwriting uses 18/18/21/24px (previously 22/22/27/31px). Header spacing compensates for the enlarged footer so the landscape task panel retains its footprint. Peach, lavender, mint, sky-blue, and rose carry into tabs, editors, calendar, and controls while the canvas remains primarily white.

Browser verification found no page overflow at 960×480, 1024×600, 1280×800, and 1920×1080; all five tabs have no horizontal overflow at 320px and 390px. No logo elements or application warnings/errors remain. Local checkpoint: `homebase-color-refinement-2026-10-16`.

## Larger clock and vivid color revision

Following further owner feedback, the clock now uses 90/104/128/180px figures at 960×480, 1024×600, 1280×800, and 1920×1080. The footer reserves room for it; compact overview details adapt to keep controls usable. TODAY'S TASKS uses Kieran Handwriting v1.5 in uppercase, with smaller task words preserved. Brighter gold, orange, violet, green, blue, and rose replace the muted palette across the overview, tabs, and editors. The canvas remains primarily white and the logo remains removed.

Browser checks verified all four landscape profiles without page overflow, all five tabs at 320px and 390px without horizontal overflow, the exact heading text and handwriting family, and no application warnings/errors. Current source checkpoint: `homebase-vivid-clock-2026-10-16`. Screenshots and layout evidence accompany the local artifacts.
