# Homebase — resume here

Saved October 18, 2026 (America/Chicago).

## Run locally

Windows: the **Homebase** desktop shortcut starts the background server and opens the personal workspace at `http://127.0.0.1:4173/` in the default browser. See [desktop launcher](docs/desktop-launcher.md). Existing preview records at port 4174 remain separate. The shortcut opens a personal workspace; it does not migrate the preview. Sign in and enable Cloud sync in Settings to connect that workspace. See [Firebase sync](docs/firebase-sync.md).

```powershell
npm.cmd run dev
```

Open [Homebase](http://127.0.0.1:4173/). Keep the terminal running; Ctrl+C stops the server. No packages need installation. `npm.cmd test` runs the model, persistence, sync, and UI-policy checks.

To continue: **Continue Homebase from START-HERE.md. Keep development local. Firebase is selected for authentication, sync, and hosting; the production framework and device platform remain open.**

Whenever uploading source changes to GitHub, deploy the same working version to Firebase Hosting and verify deployment. The user has authorized both as the normal delivery workflow.

## October 18 update

Latest requirements are consolidated in [the app PRD](docs/product-requirements.md). Achievements opens from the trophy beside Settings and has 55 compact badges with individual icons, category/unlocked filters, repeat counts, and current/best streaks. Score awards use finalized recorded scores; gym awards require lifting sets. Streak blocks and milestones derive from synced history without extra cloud writes. Award notifications follow both the day-complete animation and its save notice. History edits and resets recalculate badges.

The achievement catalog scrolls in the full main area instead of a shallow nested window, with sticky category controls. Selected filters are pale with dark text; inactive filters are dark with pale text. Wide desktop has four compact card columns. Unrated labels fit inside compact meters.

Calendar is in the footer only on desktop Overview; other desktop views put it immediately left of the trophy and remove the footer. Phones always use the header control. Desktop now uses 80% visual density at normal browser zoom. Phone styles explicitly remove the inherited desktop html/body scrolling lock in portrait and landscape. Model and achievement checks total 123 passing tests; browser checks cover scrolling and the new catalog. These latest layout rules supersede older footer/scrolling notes below.

Meters now share a 330-degree arc, filling clockwise from 6:30 to 5:30, with endpoint numbers in reserved space below the ring. Tabs use fixed columns for their number, name, and check/warning. Cloud-save status lives beside Settings. Phones have separate portrait and short landscape layouts, normal vertical page scrolling, all section tabs visible without sideways scrolling, and no clock/footer bar; Calendar is available in the header and changes to Overview when viewing the calendar. Landscape phones use a compact header and a horizontal score card above the tasks and breakdown, so the score remains visible.

To-do list replaces the task/checklist labels. One-time tasks appear before recurring tasks. The task editor offers Today, Tomorrow, and an explicit date. Plan tomorrow opens that editor with tomorrow selected; a tomorrow panel shows scheduled tasks without leaving the current day. Creating, removing, or scheduling a task alone does not log the list. Checking an action or explicitly confirming the to-do review does. While today is open and its list is logged, the main score assumes remaining tasks get done, with an “as low as” value for leaving them unchecked. Final review, history, and averages retain recorded scores.

Today and the previous seven calendar dates remain editable. Earlier dates are summary only, enforced in both navigation and store mutations. Optional daily body weight (lb/kg, 0.1 steps) persists in the day document and does not affect gym scoring. The calendar filters Overall, Nutrition, Training, To-do list, and Sentiments, including filtered weekly/monthly averages. Training also displays recorded body weights. The ideal workout suggestion distributes whole useful sets among the muscles most behind, toward the remaining daily target, never exceeding unmet weekly goals. It updates as sets are logged.

All editable circles support ring clicking/dragging with mouse or touch, plus relative up/down or sideways drags starting over the central number. Pointer capture and window release/cancel handling keep drags reliable outside the circle.

Handwritten task entry uses fixed descender allowance instead of changing height for each letter; wrapping adds lines, with tighter line spacing in task rows and notes. The new body-weight field is optional in older backups and cloud records.

Desktop tabs use the available main-panel height. Overview scales its ring and number together so its heading and controls stay inside the score card. Nutrition and Sentiments fit their controls and notes beside each other; To-do list and Tomorrow sit side by side. Training puts set entry before optional body weight and notes. Longer training panels, task lists, and calendar recaps scroll inside their cards while the page navigation stays in place. Calendar rows compress to keep the month visible.

## Current interface

The owner's car radio is the reference: a darker blue LCD, indigo ink, charcoal frame, fine scan texture, and slight pixelation. The final palette is darker and a little less saturated than the bright electric-blue iteration. Radio Display handles headings and numbers; Radio UI is a stepped Inter derivative for supporting text. Kieran Handwriting LCD keeps the owner's handwriting with subtle pixel edges. Original font files and specimens remain available. No logo is displayed.

Overview keeps tasks, a centered daily score, category breakdown, a large clock, and calendar access. The whole-number score is centered; its decimal is smaller and raised. The greeting always follows actual Chicago time, even while viewing another date: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59, night 21:00–04:59. Missing inputs keep larger warning icons in the side breakdown. Each tab has one page title.

The task heading uses bold Kieran handwriting with normalized cap metrics to clear the border. Checkboxes align to the body of the writing. The task panel is denser: eight complete rows fit the measured 1280×800 overview. Handwritten descenders sit close to the next row. The add button opens a task editor with an expanding text field, so g/y tails and long names remain visible. Repeat options are one time, daily, weekdays, weekly on the starting weekday, or selected weekdays. Optional subtasks make a parent complete only when all children are checked. Tap a parent name or its arrow to expand it. Leaf actions count toward the score; parents are not counted twice. Removing a recurring task skips that date with Undo. Recurring tasks can be stopped after today without removing earlier occurrences.

Nutrition dragging, arrows, and plus/minus use **0.1 steps**. Direct entry preserves two decimal places, including earlier quarter values. Optional dated nutrition and training notes use smaller handwriting with tighter spacing. Their visible cursor is the owner's slash rotated upright; editing, selection, wrapping, and scrolling remain native textareas. Notes do not affect scores, but edits reopen their section's review.

Calendar rows end in Monday–Sunday average rings. The monthly average uses the same ring and includes weekends. Blanks are omitted and partial status is shown. A calendar logging streak counts consecutive days with all three categories logged; an unfinished today keeps yesterday's streak alive. Ring color and luminosity increase continuously with a slight bias toward higher scores. White accents start at 9.2; ten adds a second halo. Provisional status remains visible, so glow does not imply a completed day.

The app has consistent inset panels and controls, numbered tabs, stepped fades, score sweeps, and task check-off feedback. Settings offers device motion, On, and Reduced; On is enabled in the owner's preview. Hover no longer changes review-button sizing or moves the score. Task checkboxes check off actions; Confirm checklist/nutrition/training review confirms only that section; The last section confirmation opens a full-day review card; Complete entire day in that card is the separate final step. The card omits nutrition notes and has an optional handwritten Day comment, which also appears in calendar history. Completed days can reopen View day summary without completing twice. Review navigation never finalizes the day. Overview has a direct task-add button. Task/subtask underlines accommodate hanging letters without shifting the surrounding layout. Clicking a calendar day opens a read-only recap with score, review state, tasks/dependencies, training groups, and optional handwritten notes. Category shortcuts reopen that date; calendar arrows and Home/End work across months. See [app polish](docs/app-polish.md) for verification and interaction details.

Muscle logging uses eight direct choices: Chest, Back, Triceps, Biceps, Shoulders, Quads, Hamstrings, and Core. Core starts at zero. Legs is retired from active goals/editor/weekly muscle panel; older Legs entries remain in dated logs and total sets, and old target records remain intact until explicitly replaced. Task-frequency and motion menus now share LCD styling, as do expandable sections. A prominent Past/Future day notice names any non-today date and offers Return to today. BREAKDOWN and AM/PM are bold; the overview score heading, meter, and breakdown rings are larger. Only the five daily views are numbered at the top. Calendar uses the footer/date control, with no About the rings disclosure. See [day review and controls](docs/day-review-and-controls.md).

## Saving and checkpoints

Entries save in localStorage on this browser/origin/device, and personal workspaces can sync through Firebase after sign-in and explicit enablement. Settings downloads and restores validated JSON backups. Export before clearing browser data or changing devices. The root app starts empty; `?preview=1` uses separately saved synthetic history. Backups now use version 2 for schedules, child tasks, and checklist activity. Version-1 backups still load with their history preserved; migration is saved on the next change.

Current branch: `codex/homebase-prototype`. Current tag: `homebase-attendance-2026-10-17`. Previous tags, including `homebase-polished-2026-10-17`, remain available. Source ZIPs and screenshots are in this chat's local artifacts. Browser records are separate from Git and source ZIPs. An earlier code checkpoint may not understand newer backup formats.

Development remains local. Firebase Firestore, Google Authentication, and classic Hosting are now selected on the free Spark plan with no billing. Open **https://homebase-d3c6c.firebaseapp.com/** on each device, then Settings → Cloud sync → sign in with the same Google account → Enable sync. The production framework and device platform remain open. The GitHub backup repository is `kpdevine/Homebase`; the development branch is `codex/homebase-prototype`. Personal records are excluded from Git; enabled personal workspaces also save to their private Firebase collection.

GitHub backups currently use the authenticated connector because command-line Git has no saved login. The GitHub development branch contains a source snapshot based on the existing planning branch; earlier development history and checkpoint tags remain in this local checkout. On October 17, 2026, the owner gave standing authorization to upload project updates to `kpdevine/Homebase`, including the previously withheld `docs/handwriting/specimen.png` font specimen. The GitHub snapshot includes the application source, fonts, tests, planning files, and font specimens. Personal browser and Firebase records remain excluded from Git.

Settings now includes Reset all data with an explicit confirmation, Cancel, and backup option. It clears the current personal/preview space and preferences, preserves other spaces, and keeps reset previews empty after refresh. Existing browser records were preserved during implementation.

## Verification and next work

- All 99 tests pass, including 15 cloud sync checks for merging, competing changes, offline retry, batching, and upload acknowledgement races. The earlier 77 cover read-only recaps, recurrence frequencies, date isolation, dependencies, skip/Undo, stopping routines, v1 migration/v2 round-trips, streaks, four greetings, reward boundaries, tenth controls, notes, averages, and existing reviews/training/storage behavior.
- Browser checks cover task creation and custom-day validation, child completion, skipping/Undo, stopping schedules, real meter dragging to 6.4, tenth keyboard/button adjustment, both notes persisting on refresh, and review through day completion. The handwritten cursor was checked with multiline notes, long scrollable notes, selection, and both notes fields. Task/subtask fields show full descenders.
- Overview fits measured 960×480, 1024×600, 1280×800, and 1920×1080. All five tabs fit the browser's current 480px minimum override without horizontal overflow. Narrower overrides are clamped by current desktop scaling; no new 320/390px visual claim is made.
- Test entries were removed. Entries the owner created during testing were preserved. Original dated history and training entries remain. No application errors were reported.
- Physical touch, screen readers, and intended display hardware remain untested.

The production framework, final score formula, richer schedule editing, and physical landscape device delivery remain open. Firebase synchronization is implemented; see [Firebase sync](docs/firebase-sync.md) for schema, costs, deployment, and recovery behavior. The provisional daily score equally averages entered nutrition, checklist proportion, automatic daily gym scoring, and an optional Sentiments rating. Logged rest is scored using flexible rest credits and included in the average. Monday–Sunday gym volume stays separate from Monday–Sunday calendar averages.

See [prototype guide](docs/prototype-guide.md) and [radio revision](docs/radio-revamp.md).

The time-of-day greeting uses a real bold Radio Display face; the name stays regular. The previous homebase-routines-lcd-2026-10-17 checkpoint remains available.

Sentiments is the fifth daily view: dated handwritten notes and an optional 0–10 circular rating in 0.1 steps. Notes alone never change the score. An entered rating, including zero, adds an equal component; removing it excludes that component. It appears in the overview breakdown, day review, and calendar recap. Three required reviews and the logging streak remain unchanged. Sentiment edits reopen final completion while preserving section reviews. Older backups receive empty sentiments.

Gym asks Did you lift today? Yes records gym attendance; No directly records flexible rest. The fixed daily target is the weekly goal total divided by five. Sets filling an unmet muscle goal earn full daily credit; extra and untargeted sets earn 25%. Workout score = 4 attendance points + weighted sets / daily target × 6, capped at ten. Two rest credits per Monday–Sunday week award ten each; later rest scores zero until all weekly muscle goals have been completed, after which rest scores ten without using a credit. Rest is included in the daily score. Unanswered dates remain unlogged. All-zero targets keep gym unscored. Chronological replay recalculates classifications and credits after backdated edits or deletions; changed gym scores reopen affected reviews. Removing a workout's last entry records rest. Targets still inherit until edited, and total sets remain separate from capped goal sets. The small i beside Settings explains the full policy. See [gym scoring](docs/gym-pace.md).

Weekly muscle targets now use draggable LCD circles with whole 0–20 set values, arrow keys, plus/minus, Home 0, and End 20. Edits stay in a draft until Save; Discard restores saved values. Zero disables that muscle’s goal credit while retaining total sets. With all targets zero, gym is unscored but an answered day still counts as a check-in. Historical targets above 20 remain intact until explicitly replaced; the editor explains any clamped draft. Legs is retired from active targets; dated Legs logs remain available.

Target circles deliberately use one uniform ink color at every value; set amounts are not rewarded by color. Score meters retain their existing score colors.

Firebase verification on October 17, 2026: Google sign-in and explicit sync enablement succeeded at the shared address. Two independently initialized browser clients delivered a disposable nutrition rating 8.4 from A to B and 9.1 from B to A using server-backed listeners. Owner reads/writes succeeded; unauthenticated reads, other-owner reads/writes, and an invalid owner write returned 403. The disposable 2099-12-30 record was removed. No preview records were uploaded. The temporary live test page was removed from the final deployment. Offline recovery, delayed acknowledgements, and account changes during uploads have automated coverage; physical phone/display checks remain outstanding.

October 17 gym revision: all 99 tests pass, including the proposed daily scoring examples and chronological rest-credit replay. Browser verification used a fresh isolated port; existing preview and personal records were untouched. No storage schema migration is needed; older rest labels are treated as flexible rest. The updated rule applies when existing history is viewed, as with the earlier provisional scoring policy.

Saving weekly targets closes the editor after a successful save. Core is available for new logs and target editing, initially zero. Retired Legs goals are omitted from active scoring goals and weekly panels without deleting dated entries or rewriting older saved target snapshots on read. All 99 tests pass.

Gym display now shows goal sets and non-goal sets, with no weighted-set total or duplicate rest-score wording. A prominent Weekly rest credits panel shows the remaining allowance through the selected day. All weekly calculations, including calendar averages, span Monday–Sunday. Weekday-only task recurrence is still a Monday–Friday schedule, not a different definition of a week. Browser checks confirmed saving Core targets closes the editor and Core logging splits goal/non-goal sets correctly.

Shared controls now stay anchored across tabs: the viewport shell keeps header, tab bar, clock, save status, and calendar fixed while only main content scrolls. The past-day notice is inside main content, titles reserve a stable line, tab buttons have stable slots and checkmark space, and scrolling a long tab cannot introduce a body scrollbar or shift navigation. Browser geometry checks across all five tabs confirmed identical menu and footer positions; the gym content remained independently scrollable.

Gym attendance baseline: selecting Yes records attendance and earns four points, even without sets. Up to six additional points come from the existing goal/non-goal calculation, reaching ten at the daily target. Rest scores are unchanged. Attendance-only reviews round-trip through backup validation. All 99 tests pass.

The clock and its date display only on Overview. Other tabs remove the clock and use a compact 76px footer, reclaiming content space. Save and calendar controls are pinned 14px from the bottom so their positions remain stable across tabs. Overview retains the large clock.

Shared meter contrast: the ring gradient is fully opaque and has a dark LCD keyline, with a stronger track. Normal score digits use dark ink; pale high-score digits retain their reward color with a dark outline. The same contrast treatment covers nutrition, sentiments, breakdown, gym, calendar, monthly/weekly averages, and recap score circles. Target-setting circles retain their uniform neutral color. Reward thresholds and score calculations are unchanged.

Sentiments with both a note and rating now joins the daily review as an optional fourth section. Confirm Sentiments to reach the full-day review; changing either input reopens it. Days with only one input keep the three required reviews. Older completed records with both inputs preserve their completed state. Top tab checks are larger, and after 9 p.m. unlogged required sections show a warning; Sentiments never does. The review form no longer repeats “Next” hints. All 101 tests pass.

The active section's Confirm button lives in the day-review strip and confirmation advances to the next unfinished section. Final review has editable Sentiments notes and a 0–10 rating in place of Day comment. Older day comments remain in backups but no longer appear in the interface. Completing a day plays a short LCD-blue score celebration when motion is enabled. All 101 tests pass.

Final-review Sentiments rating uses the same draggable 0–10 circle and 0.1 increments as the Sentiments tab, with arrow keys and Home/End for accessibility. Notes and rating edits in the final review save immediately and mark the Sentiments section reviewed without an extra confirmation button; Complete entire day remains the last action.

The final-review rating circle is compact and has no on-screen drag instructions; its accessible slider label and keyboard controls remain.
