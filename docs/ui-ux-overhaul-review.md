## Publication approval — October 22

The owner approved this complete draft with “Push all.” The earlier hold and unpublished labels below describe the review phase and are superseded by this approval. Release source, PRD, reaction artwork and matching Firestore rules together.

# Pocket Planet UI/UX overhaul — local review

Status: local draft ready for owner review, October 22, 2026. **No commit, push, or deployment is authorized for this pass.** The published app remains at its earlier checkpoint.

## Changes for review

- A shared mobile-first design system now owns layout, spacing, surfaces, controls, focus states, and responsive behavior. Existing feature-specific meter, font, caret, and animation styles remain in a compatibility layer.
- The phone header is shorter, removes the duplicated date/status line, and keeps six consistent utility targets together. The five numbered daily sections stay visible in a sticky strip. Saving status is a compact accessible indicator in the header.
- Overview puts the score first on phones, followed by the task list and category breakdown. Desktop retains a three-column overview and a large clock. The main score's projection/review copy is shorter.
- Nutrition uses a focused rating layout, or a ring beside protein/calorie fields in amount mode. Notes have a dedicated full-width writing area. Desktop uses additional columns rather than zooming the entire app.
- Training puts attendance and optional creatine in consistent Yes/No controls. Weekly progress/targets are a disclosure on phone, initially open on wider screens. Body weight, set logging, the frozen ideal workout, notes, custom groups, and Other training remain available.
- To-do lists use denser handwritten rows and first-line checkbox alignment. The task editor uses Today/Tomorrow/Later choices, optional exact dates, a Repeat checkbox followed by schedule choices, and fixed writing frames for titles/subtasks. Removal is reached through the editor; recurring occurrence removal still requires confirmation and preserves Undo.
- Sentiments, guided section review, and the final day summary share the same writing/rating controls. Final sentiments edits save directly. The existing day-complete/achievement sequence remains.
- Calendar, category filters, monthly/weekly scores, weight graph, read-only older history, and logged-day markers use full available phone width. The weight graph detail card is compact, includes signed previous-day change, and keeps both score rings inside the card.
- Achievements use compact responsive cards, visible selected filters, contrasting streak summaries, and document scrolling rather than a small nested scroll area.
- Friends puts the leaderboard first on phone. Its column says **User**, and User/usernames use Kieran handwriting. Score circles and yesterday glow remain. Friend removal now has an explicit confirmation dialog; asynchronous actions show a working state.
- Settings are grouped into Logging settings, Appearance, Account & cloud sync, Notifications, and Backups & data. Existing users can save changes directly from any logging section. First-time setup retains its four-step flow. Validation ignores inactive mode fields and brings an invalid section into view.
- The scoring guide groups each topic together and offers topic buttons. Welcome/setup copy is functional and shorter. Shared dialogs fit their content, retain scrolling for long forms, and provide consistent titles/actions.
- Both LCD themes use the generated alternate palette. Buttons use color/border feedback without moving surrounding content. Existing reduced-motion preferences, the approved mascot opening, score sweeps, and completion animations remain.

## Verification

### Responsive audit

Local browser checks used sample records and an isolated fake account/cloud transport. Production records, live friendships, notification subscriptions, and published resources were not changed.

| Screen | Phone 320/390/430 | Landscape 844×390 | Tablet 820×1080 | Desktop 1280/1440 |
| --- | --- | --- | --- | --- |
| Overview | Checked | Checked | Checked | Checked |
| Nutrition | Checked | Checked | Checked | Checked |
| Daily training | Checked | Checked | Checked | Checked |
| To-do list | Checked | Checked | Checked | Checked |
| Sentiments | Checked | Checked | Checked | Checked |
| Calendar | Checked | Checked | Checked | Checked |
| Achievements | Checked | Checked | Checked | Checked |
| Friends/leaderboard | Checked | Checked | Checked | Checked |

The initial 54 view/size combinations reported no horizontal element overflow. Another 32 view/size checks after the final control fixes also reported no horizontal overflow. Follow-up checks addressed conditional controls and graph/dialog states. The phone layout was also checked in Mars, including empty/unlogged score states and destructive confirmation presentation.

### Interaction checks

- Edited Nutrition settings and saved directly without traversing all settings sections; reopened settings showed the saved mode.
- First Google username setup handed off to the setup wizard; all four Next/Finish steps completed. Guest name entry and optional setup dismissal remained available.
- Added a recurring task for tomorrow with a subtask, verified it in Tomorrow, reopened its editor, and reached/cancelled the occurrence-only removal confirmation.
- Logged four gym sets, observed updated scoring/save feedback, changed a neutral target by keyboard, and saved targets. The target editor closed.
- Selected Other training and entered 30 of 40 minutes; score updated to 7.5. Disabled creatine tracking stayed hidden.
- Continued guided review, confirmed remaining sections, adjusted final Sentiments with its circle, and completed a sample day. Overview/calendar showed completion and the saved score.
- Selected Calendar → Training, verified a training-only recap and weight graph, and opened a point card showing −0.6 lb plus the previous day's Nutrition/Training circles.
- Verified first-time username and friend-removal dialogs have accessible titles; cancelled removal. Search/claim/action feedback uses disabled busy states.
- Inspected Appearance, motion, backup/reset entry, and the reset confirmation; no hard reset was performed. Notification controls and cloud transports retain existing behavior.
- Click-and-dragged the Nutrition ring from 7.2 to 4.9 and observed matching dial/input values. Endpoint labels remained below the arc.
- Removed old presentation overrides that forced oversized achievement padding and inconsistent empty-list layout.
- Confirmed the User heading and names resolve to `Kieran Handwriting LCD` in the phone leaderboard.

Automated verification: `node --test tests/*.test.mjs server/reminders/test/*.test.mjs` — 223 tests, 222 passed, one emulator-only test skipped, zero failures. Changed JavaScript modules pass `node --check`. Git whitespace checks pass. No scoring, data model, Firebase rules, or reminder-worker source was changed in this pass.

## Review limits

These are local browser viewport checks, not physical iPhone/Safari certification. Real Google sign-in, cloud writes, reminder delivery, irreversible reset, and deployment were deliberately not exercised against production. Existing automated tests cover the unchanged persistence/scoring/sync rules. The compatibility CSS remains intentionally available; this pass centralizes layout without removing mature feature behavior.

## Main files

- `prototype/app-design.css`: shared layout/components and responsive styles.
- `prototype/legacy-ui.css`: compatibility imports in one CSS layer.
- `prototype/ui-shell.mjs`: one-time DOM composition and UI grouping; existing handlers are preserved.
- `prototype/app.mjs`: score copy, accessible save state, bounded phone tab scroll reservation, shared task removal entry.
- `prototype/customization-ui.mjs`: direct settings save, wizard validation, accessible title.
- `prototype/social-ui.mjs`: concise username copy, working feedback, friend-removal confirmation.
- `prototype/customization.css`: removed presentation overrides that defeated hidden controls or consistent icon sizes.
- `prototype/themes.css`, generated palette, and `prototype/index.html`: theme coverage and stylesheet entry.

The next action is the owner's visual/interaction review and feedback. Publication remains on hold.

Follow-up: centered the width-limited “out of 10” / unrated labels within all shared score meters using automatic inline margins. The label remains centered in the smaller final-review meter too. Local only.

## October 22 feature draft — still unpublished

This extends the earlier visual overhaul with model and social changes. It remains local and uncommitted under the publication hold.

- Notes retain autosave and gain an explicit Save / Saved action. Protein/calorie and other-training minute entries also have save feedback. Saving does not submit or confirm a review, and errors never show a false success.
- Friends now centers on a selected **Solar System**. Create/search/request to join, owner approvals, invitations to accepted friends, member removal and leaving are implemented. Users may belong to several systems and choose a primary one.
- Status messages were cancelled at the owner's request. Members instead react to another member's shared day with eleven custom planet emojis. One reaction per person per day can be changed or removed. The picker includes the green Martian, red Love, stronger flame halo and corrected Strong/Blastoff arms.
- Yesterday and monthly average remain circle scores, with month and all-time logged-day counts. Day reactions can browse the latest 35 days of shared score summaries. Joining a system never grants access to private records, notes, tasks, meals, workout details or weight.
- Opening the app prompts for tab choices until a choice is saved. Existing users get this prompt once. Overview is mandatory and unnumbered; enabled logging tabs start at 1. New workspaces start with To-do enabled and other trackers off. All six logging tabs can be toggled in Settings.
- Sleep and Prayer accept hours/minutes and have configurable time goals. Scores are proportional to the goal, rounded to tenths and capped at 10; recorded zero scores zero, blank time remains unlogged. Enabled sections feed review, calendar filters, overall scores, logging streaks and leaderboard qualification. Required sentiment ratings also keep an otherwise logged day provisional.
- Disabling trackers preserves saved content. Earlier dates retain their configuration, score and review requirements. Saving unchanged choices does not reopen a completed day.
- Training replaces Daily training. Weight entry remains in Training, while recorded weight appears in Calendar → Training only, not the final/general recap. Individual protein/calorie goals appear below their fields. White and warm yellow accents extend the LCD palette.

Automated verification: 233 tests, 232 passed and one emulator-only test skipped in the normal run; the separate Firestore emulator test also passes. It exercises the actual social driver, approvals/invite consent, membership revocation, real-time listeners, all eleven reactions, invalid/outsider writes, and private-record isolation. No production records or reminder deliveries were used for QA. Physical iPhone behavior remains for owner review.

Before any approved publication, deploy the new Firestore rules with the matching app. The new group paths are intentionally unavailable on production until then. See `docs/pending-oct22-features.md` and `prototype/assets/reactions/README.md` for the feature and artwork checklists.

Local visual checks for this feature draft: 390px phone Sleep entry/save (6h30m → 8.1/10 for an 8-hour goal), opening chooser and persisted choices, guided four-section final review with no weight row, Solar System creation/primary selection/owner approval, Martian reaction send/remove, and nutrition goals at 1280px desktop and 320px phone. The checked nutrition layouts have no horizontal overflow; desktop nutrition fits its viewport. Proofs are in `output/ui-review/note-save-feedback.png` and `output/ui-review/nutrition-goals-desktop.png`.


## Standing iPhone requirement — October 23

The owner explicitly requires iPhone Safari and the installed iPhone Home Screen app to be considered separately from the desktop phone-size harness. Check WebKit form-control appearance, dynamic text sizing, safe-area insets, viewport/keyboard behavior, portrait box geometry, touch focus/highlights, and thumbnail loading/caching. A desktop portrait screenshot is layout evidence, not physical iPhone certification. Preserve keyboard focus visibility on controls while preventing page-size focus outlines. Record actual device verification separately when available.
