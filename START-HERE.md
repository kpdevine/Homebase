# Homebase — resume here

Saved October 17, 2026 (America/Chicago).

## Run locally

Windows: the **Homebase** desktop shortcut starts the background server and opens the personal workspace at `http://127.0.0.1:4173/` in the default browser. See [desktop launcher](docs/desktop-launcher.md). Existing preview records at port 4174 remain separate. The shortcut opens a personal workspace; it does not migrate the preview. Sign in and enable Cloud sync in Settings to connect that workspace. See [Firebase sync](docs/firebase-sync.md).

```powershell
npm.cmd run dev
```

Open [Homebase](http://127.0.0.1:4173/). Keep the terminal running; Ctrl+C stops the server. No packages need installation. `npm.cmd test` runs 92 checks.

To continue: **Continue Homebase from START-HERE.md. Keep development local. Firebase is selected for authentication, sync, and hosting; the production framework and device platform remain open.**

## Current interface

The owner's car radio is the reference: a darker blue LCD, indigo ink, charcoal frame, fine scan texture, and slight pixelation. The final palette is darker and a little less saturated than the bright electric-blue iteration. Radio Display handles headings and numbers; Radio UI is a stepped Inter derivative for supporting text. Kieran Handwriting LCD keeps the owner's handwriting with subtle pixel edges. Original font files and specimens remain available. No logo is displayed.

Overview keeps tasks, a centered daily score, category breakdown, a large clock, and calendar access. The whole-number score is centered; its decimal is smaller and raised. The greeting always follows actual Chicago time, even while viewing another date: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59, night 21:00–04:59. Missing inputs keep larger warning icons in the side breakdown. Each tab has one page title.

The task heading uses bold Kieran handwriting with normalized cap metrics to clear the border. Checkboxes align to the body of the writing. The task panel is denser: eight complete rows fit the measured 1280×800 overview. Handwritten descenders sit close to the next row. The add button opens a task editor with an expanding text field, so g/y tails and long names remain visible. Repeat options are one time, daily, weekdays, weekly on the starting weekday, or selected weekdays. Optional subtasks make a parent complete only when all children are checked. Tap a parent name or its arrow to expand it. Leaf actions count toward the score; parents are not counted twice. Removing a recurring task skips that date with Undo. Recurring tasks can be stopped after today without removing earlier occurrences.

Nutrition dragging, arrows, and plus/minus use **0.1 steps**. Direct entry preserves two decimal places, including earlier quarter values. Optional dated nutrition and training notes use smaller handwriting with tighter spacing. Their visible cursor is the owner's slash rotated upright; editing, selection, wrapping, and scrolling remain native textareas. Notes do not affect scores, but edits reopen their section's review.

Calendar rows end in Monday–Friday average rings. The monthly average uses the same ring and includes weekends. Blanks are omitted and partial status is shown. A calendar logging streak counts consecutive days with all three categories logged; an unfinished today keeps yesterday's streak alive. Ring color and luminosity increase continuously with a slight bias toward higher scores. White accents start at 9.2; ten adds a second halo. Provisional status remains visible, so glow does not imply a completed day.

The app has consistent inset panels and controls, numbered tabs, stepped fades, score sweeps, and task check-off feedback. Settings offers device motion, On, and Reduced; On is enabled in the owner's preview. Hover no longer changes review-button sizing or moves the score. Task checkboxes check off actions; Confirm checklist/nutrition/training review confirms only that section; The last section confirmation opens a full-day review card; Complete entire day in that card is the separate final step. The card omits nutrition notes and has an optional handwritten Day comment, which also appears in calendar history. Completed days can reopen View day summary without completing twice. Review navigation never finalizes the day. Overview has a direct task-add button. Task/subtask underlines accommodate hanging letters without shifting the surrounding layout. Clicking a calendar day opens a read-only recap with score, review state, tasks/dependencies, training groups, and optional handwritten notes. Category shortcuts reopen that date; calendar arrows and Home/End work across months. See [app polish](docs/app-polish.md) for verification and interaction details.

Muscle logging uses seven direct choices: Chest, Back, Triceps, Biceps, Shoulders, Quads, and Hamstrings. Older Legs logs/targets are preserved. Task-frequency and motion menus now share LCD styling, as do expandable sections. A prominent Past/Future day notice names any non-today date and offers Return to today. BREAKDOWN and AM/PM are bold; the overview score heading, meter, and breakdown rings are larger. Only the five daily views are numbered at the top. Calendar uses the footer/date control, with no About the rings disclosure. See [day review and controls](docs/day-review-and-controls.md).

## Saving and checkpoints

Entries save in localStorage on this browser/origin/device, and personal workspaces can sync through Firebase after sign-in and explicit enablement. Settings downloads and restores validated JSON backups. Export before clearing browser data or changing devices. The root app starts empty; `?preview=1` uses separately saved synthetic history. Backups now use version 2 for schedules, child tasks, and checklist activity. Version-1 backups still load with their history preserved; migration is saved on the next change.

Current branch: `codex/homebase-prototype`. Current tag: `homebase-firebase-2026-10-17`. Previous tags, including `homebase-polished-2026-10-17`, remain available. Source ZIPs and screenshots are in this chat's local artifacts. Browser records are separate from Git and source ZIPs. An earlier code checkpoint may not understand newer backup formats.

Development remains local. Firebase Firestore, Google Authentication, and classic Hosting are now selected on the free Spark plan with no billing. Open **https://homebase-d3c6c.firebaseapp.com/** on each device, then Settings → Cloud sync → sign in with the same Google account → Enable sync. The production framework and device platform remain open. The GitHub backup repository is `kpdevine/Homebase`; the development branch is `codex/homebase-prototype`. Personal records are excluded from Git; enabled personal workspaces also save to their private Firebase collection.

GitHub backups currently use the authenticated connector because command-line Git has no saved login. The GitHub development branch contains a source snapshot based on the existing planning branch; earlier development history and checkpoint tags remain in this local checkout. On October 17, 2026, the owner gave standing authorization to upload project updates to `kpdevine/Homebase`, including the previously withheld `docs/handwriting/specimen.png` font specimen. The GitHub snapshot includes the application source, fonts, tests, planning files, and font specimens. Personal browser and Firebase records remain excluded from Git.

Settings now includes Reset all data with an explicit confirmation, Cancel, and backup option. It clears the current personal/preview space and preferences, preserves other spaces, and keeps reset previews empty after refresh. Existing browser records were preserved during implementation.

## Verification and next work

- All 92 tests pass, including 15 cloud sync checks for merging, competing changes, offline retry, batching, and upload acknowledgement races. The earlier 77 cover read-only recaps, recurrence frequencies, date isolation, dependencies, skip/Undo, stopping routines, v1 migration/v2 round-trips, streaks, four greetings, reward boundaries, tenth controls, notes, averages, and existing reviews/training/storage behavior.
- Browser checks cover task creation and custom-day validation, child completion, skipping/Undo, stopping schedules, real meter dragging to 6.4, tenth keyboard/button adjustment, both notes persisting on refresh, and review through day completion. The handwritten cursor was checked with multiline notes, long scrollable notes, selection, and both notes fields. Task/subtask fields show full descenders.
- Overview fits measured 960×480, 1024×600, 1280×800, and 1920×1080. All five tabs fit the browser's current 480px minimum override without horizontal overflow. Narrower overrides are clamped by current desktop scaling; no new 320/390px visual claim is made.
- Test entries were removed. Entries the owner created during testing were preserved. Original dated history and training entries remain. No application errors were reported.
- Physical touch, screen readers, and intended display hardware remain untested.

The production framework, final score formula, richer schedule editing, and physical landscape device delivery remain open. Firebase synchronization is implemented; see [Firebase sync](docs/firebase-sync.md) for schema, costs, deployment, and recovery behavior. The provisional daily score equally averages entered nutrition, checklist proportion, automatic weekly gym pace, and an optional Sentiments rating. Planned rest is excluded from the average. Monday–Sunday gym volume stays separate from Monday–Friday calendar averages.

See [prototype guide](docs/prototype-guide.md) and [radio revision](docs/radio-revamp.md).

The time-of-day greeting uses a real bold Radio Display face; the name stays regular. The previous homebase-routines-lcd-2026-10-17 checkpoint remains available.

Sentiments is the fifth daily view: dated handwritten notes and an optional 0–10 circular rating in 0.1 steps. Notes alone never change the score. An entered rating, including zero, adds an equal component; removing it excludes that component. It appears in the overview breakdown, day review, and calendar recap. Three required reviews and the logging streak remain unchanged. Sentiment edits reopen final completion while preserving section reviews. Older backups receive empty sentiments.

Gym now asks Did you lift today? Yes opens set logging; No asks Planned rest or Unplanned rest. Planned rest is excluded from the daily average but still counts for review and streaks. Unplanned rest is scored using strict weekly pace: credited sets through that date / (weekly goal × Monday-based day number / 7) × 10, capped at 10. Credit is capped separately per muscle; extra and untargeted sets remain in totals. 20/70 on Monday covers an unplanned Tuesday for a 10; 14/70 by Tuesday scores 7. Future logs cannot improve earlier scores. Targets repeat until edited, starting with visible default targets when none exist; edits apply from the selected Monday until the next saved change. Prior rest entries are preserved as planned rest. Backdated edits reopen later gym reviews when their score changes. A small i beside Settings explains the full policy. See [gym pace](docs/gym-pace.md).

Weekly muscle targets now use draggable LCD circles with whole 0–20 set values, arrow keys, plus/minus, Home 0, and End 20. Edits stay in a draft until Save; Discard restores saved values. Zero disables that muscle’s goal credit while retaining total sets. With all targets zero, gym is unscored but an answered day still counts as a check-in. Historical targets above 20 remain intact until explicitly replaced; the editor explains any clamped draft. Older combined Legs targets also get a circle when present.

Target circles deliberately use one uniform ink color at every value; set amounts are not rewarded by color. Score meters retain their existing score colors.

Firebase verification on October 17, 2026: Google sign-in and explicit sync enablement succeeded at the shared address. Two independently initialized browser clients delivered a disposable nutrition rating 8.4 from A to B and 9.1 from B to A using server-backed listeners. Owner reads/writes succeeded; unauthenticated reads, other-owner reads/writes, and an invalid owner write returned 403. The disposable 2099-12-30 record was removed. No preview records were uploaded. The temporary live test page was removed from the final deployment. Offline recovery, delayed acknowledgements, and account changes during uploads have automated coverage; physical phone/display checks remain outstanding.
