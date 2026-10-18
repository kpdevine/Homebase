# Homebase product requirements

Updated October 18, 2026. This is the current application specification; older design documents retain the planning history.

## Purpose and delivery

Homebase is a personal daily dashboard for computer, phone, and a landscape display. Development stays local. Firebase Authentication, Firestore, and classic Hosting provide optional private sync and the shared app on the free Spark plan, with no billing, Analytics, or Gemini. The production framework, display hardware, and future Spotify integration remain open.

Every source upload to `kpdevine/Homebase`, branch `codex/homebase-prototype`, must be accompanied by a deployment of the same version to `https://homebase-d3c6c.firebaseapp.com/`. Personal records, credentials, and local test artifacts stay out of Git and Hosting.

## Interface and navigation

- Match the owner's car radio: dark blue LCD, indigo ink, charcoal frame, visible scan lines, subtly pixelated type, and progressive ice-white score rewards. Keep all numbers legible over their rings. No Homebase logo or slogan.
- Use the owner's Kieran handwriting for task text, notes, and the bold to-do heading. Fixed input metrics accommodate descenders without shifting surrounding controls; wrapping can add lines.
- Five numbered daily views: Overview, Nutrition, Daily training, To-do list, and Sentiments. Stable slots align tab numbers, labels, and prominent review checks. Missing required inputs show tab warnings after 9 p.m.; Sentiments is exempt.
- Overview has a time-based Chicago greeting, large clock, tasks, daily score, and category breakdown. The clock appears only here.
- Home, Calendar, Achievements, and Settings are adjacent icon-only buttons in the header on desktop and both phone orientations. All four have matching 40px touch targets and 21px icons with 6px gaps. Home always returns to Overview; Calendar always opens Calendar and never changes into Home. For an archived selected date, Home returns to today's editable Overview. Desktop Overview also retains its bottom clock/calendar bar; other views have no bottom bar. Trophy opens Achievements.
- Each header menu button indicates its active menu with pale ink, a dark filled button, and an inset indicator. Expose the state through `aria-pressed`. Settings and scoring-info indicate their open dialogs; closing a dialog, including Escape, restores the underlying view's indicator.
- Desktop uses the owner's preferred 80% visual density at normal browser zoom. Fill the available viewport; long records scroll within their panels. Achievements instead uses the full main scrolling area, with category controls remaining visible as its cards scroll.
- Phones have distinct portrait and landscape layouts, visible daily tabs, no clock/footer bar, and normal document scrolling. Remove desktop document scroll locks in both phone orientations. Landscape keeps the daily score visible.
- Every score meter fills clockwise from about 6:30 to 5:30. Endpoint numbers occupy reserved space below the ring. Editable ratings support mouse/touch dragging, arrow keys, Home/End, and tenth increments. Whole-number 10 has no decimal. Unrated labels stay inside small circles without touching the ring.

## Daily records and scoring

- Nutrition: optional notes and a 0–10 rating. Dragging/buttons use 0.1 increments; direct entry preserves two decimal places.
- To-do list: dated one-time tasks, daily/weekday/weekly/custom recurrence, and expandable parents dependent on their subtasks. Count leaf actions once. One-time tasks precede recurring ones. Creating or scheduling tasks does not log the list; checking an action or confirming its review does. A reviewed empty list is complete.
- Task creation offers Today, Tomorrow, and an explicit date. Plan tomorrow exposes tomorrow's scheduled work without leaving the current day. Removing an occurrence supports Undo; stopping a schedule preserves history.
- To-do planning has three cards: Today's To-Do, Tomorrow, and Later This Week, all with bold Kieran handwriting headers. At desktop width they sit side by side; phones stack and scroll normally. Later This Week groups tasks by date from two through seven days ahead, with direct day navigation and edit controls. Task creation offers a Later this week shortcut plus six date choices. New one-time tasks and routine start dates, and moving one-time tasks, are bounded to the next seven days; existing recurring schedules continue beyond that window. This is a rolling planning horizon; scoring weeks remain Monday–Sunday.
- Existing tasks and subtasks have pencil edit controls on Overview and To-do list. Edit names, add/remove subtasks, and move one-time tasks between editable dates. Keep retained action IDs and completion, recompute parents, reopen the affected checklist review, and never turn editing alone into logging. Saving an unchanged task leaves its review intact.
- Recurring editing defaults to Only this day. This day & future can change names, child dependencies, and repeat frequency from that date onward. Version the schedule so earlier saved and virtual history stays unchanged; preserve future skipped occurrences and matching completion checks. Cancel discards the draft; validation failures are atomic. Archived dates remain protected in both editor and store.
- Sentiments: optional dated handwritten notes and optional 0–10 circular rating. Notes alone are unscored. A rating, including zero, adds an equal daily-score component only when entered. Notes and rating together add an optional review section.
- Average logged Nutrition, Gym, To-do, and any entered Sentiments rating. Never penalize an unlogged checklist as zero. Today's logged task component projects completion of remaining actions, with a smaller “as low as” recorded-outcome indicator. Final review, history, achievements, and averages use recorded scores.
- Today and the previous seven calendar dates are editable. Older days allow summaries only; enforce this in store mutations as well as navigation.

## Gym

- Ask “Did you lift today?” Yes records attendance; No records flexible rest. Muscles: Chest, Back, Triceps, Biceps, Shoulders, Quads, Hamstrings, Core. Retain older Legs entries in history but exclude Legs from active goals.
- Weekly muscle goals inherit until edited. Target circles use whole 0–20 sets with uniform color; Save closes the target editor. Weeks always run Monday–Sunday.
- Fixed daily target = sum of active weekly goals / 5. Useful sets fill unmet muscle goals; excess sets receive 25% daily credit. Workout score = min(10, 4 + useful-and-quarter-extra sets / daily target × 6). All-zero targets leave gym unscored.
- Two flexible rest credits per week earn ten each. Further rest earns zero until every nonzero muscle goal has been met; subsequent rest earns ten without using credits. Unanswered dates consume nothing. A workout with only excess sets remains a workout.
- Classify logs chronologically. Historical edits/deletions replay classifications, daily scores, and rest credits, reopening affected reviews. Later workouts do not improve earlier scores.
- Display goal sets and total sets separately, non-goal sets where relevant, and a prominent remaining rest allowance. Do not display a weighted-set total or redundant scoring descriptions.
- Suggest the ideal workout from remaining muscle deficits and the remaining daily target, without recommending completed or disabled goals. Optional daily body weight (lb/kg) is stored and visible in Training-filtered calendar history; it never changes scores.
- Make saved body weight prominent near the top of Daily training. A Weight graph button opens a themed line chart with 30-day, 90-day, and all-time ranges, lb/kg conversion, latest weight and change, and an accessible values table. Use actual calendar spacing, exclude future/missing readings, and handle empty/single-point/constant series without inventing data. Derive the graph from existing day records; no extra cloud writes or schema migration.

## Review and history

- Confirm each applicable section in the shared review strip, advancing to the next unfinished section. Keep confirmation inside that strip.
- Once sections are confirmed, open a full-day summary before the separate Complete entire day action. Edit Sentiments notes and its compact circular rating directly here, with no extra confirmation; put the rating to the right of the extended notes field and Remove rating below its circle. No separate day-comment input.
- Finish with a substantial, brief, theme-matching day-complete animation; honor reduced motion. Achievement notifications follow this animation and the save notification, never overlapping them.
- Calendar filters Overall, Nutrition, Training, To-do list, and Sentiments. Daily, Monday–Sunday weekly, and monthly averages share the score rings. Exclude missing values and label provisional scores. Show the full-logging streak and read-only daily summaries.
- Filtered calendar recaps show only the selected category and its relevant notes/details; Training includes gym sets and body weight, with no nutrition, tasks, or sentiments. Their Open control navigates directly to that category.
- Make all-three-required-categories-logged days rewarding regardless of score: bright frame, lower-edge accent, and dot marker. Completed reviews get an additional bright frame and high-contrast check badge. Preserve selected-date visibility, score-ring rewards, and accessible status labels across calendar category filters.
- The handwritten notes cursor follows selection coordinates at normal and scaled desktop density, wraps and scrolls with native text, and falls back to the native cursor for selections or unavailable measurements. Its shape comes from the owner's rotated slash, trimmed to visible ink so font line metrics cannot shift it. Phone muscle labels stay inside full-width two-column controls.

## Achievements

- Dedicated trophy page with 55 compact cards, each with a distinct decorative LCD line icon, requirement, progress, times earned, and latest earned date. Show unique badges unlocked, total times earned, and completed days.
- Overall day milestones: 1, 3, 7, 14, 30, 60, 100, 180, 365 completed reviews. Overall, Nutrition, and Gym score thresholds: 8, 9, 9.5, 10. Gym score badges require lifting with sets logged; rest and attendance alone cannot award them.
- Useful goal-set milestones: 50, 100, 250, 500, 1,000, 2,500. Task-action milestones: 10, 50, 100, 500, 1,000; also a repeatable completed nonempty list. Parent tasks add no duplicate credit.
- Sentiments: repeatable written-day badge; writing milestones at 3, 10, 30, 100 completed days; repeatable rating 9+ badge. Writing requires no rating.
- Review streak blocks: 3, 7, 14, 30, 60, 100 days. Full-logging streak blocks: 3, 7, 14, 30, 60. Overall 9+ streak blocks: 3, 7, 14. Include weekends. Show current and best streaks, keeping yesterday's active run alive while today is unfinished. Each full nonoverlapping block earns once.
- Weekly badges: all nonzero muscle goals met using finalized-day sets, and at least five finalized day reviews. Award once per Monday–Sunday week. Disabled goals alone cannot award a weekly gym badge.
- Score badges count finalized, non-provisional recorded days. Derive achievements from existing synced history without a second stored unlock ledger or extra database writes. Edits, imports, sync, and resets recalculate progress. Reopening the page never adds duplicate awards.
- Category filters: All, Overall, Nutrition, Gym, To-do list, Sentiments, Streaks; plus Unlocked only. Use dark high-contrast inactive controls and a clearly pale selected control, with visible keyboard focus. Use four card columns on wide desktop, fewer on smaller screens.
- After a day completes, show all badges newly earned from it in a dismissible themed notification, with unique icons and a link to the unlocked catalog. Existing historical badges appear in the catalog without replaying notifications on every load.

## Persistence and quality

Local saving remains available without sign-in. Google sign-in alone uploads nothing; explicit sync enablement connects private owner records across devices. Batch typing saves, support offline retry, and surface competing changes without silent overwrite. Preview data is separate from personal data and never uploads.

Settings provides validated backup/restore and Reset all data with an explicit confirmation. Preserve old backups and historical records through compatible migrations. Test model, scoring, chronology, persistence, cloud merging, and achievements; inspect desktop and both phone orientations before delivery. Physical device behavior remains a separate hardware check.
