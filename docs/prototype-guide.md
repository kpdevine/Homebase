# Current local prototype guide

Run `npm.cmd run dev` and open `http://127.0.0.1:4173/`. The loopback server serves only `prototype/`; Ctrl+C stops it. Node is sufficient. Fonts are bundled locally.

Root starts empty. `?preview=1` uses synthetic history and separate storage. Both persist across refresh. Clock and greeting use the device's local time. Today changes at 1:00 a.m.; midnight through 12:59 a.m. still logs the preceding day. Calendar arithmetic uses explicit date keys and Monday–Sunday weeks. Open forms and menus keep their date while in use, and deliberately selected dates stay selected. Settings handles profile name, scoring information, and validated JSON entry backups. Export before clearing local data or changing devices.

## Interface and tasks

The darker blue LCD theme follows the owner's car radio. Radio Display and Radio UI supply stepped headings/numbers and supporting type. Kieran Handwriting LCD is a dashboard-only derivative of the owner's v1.5 font. Original fonts/specimens remain. There is no logo. Supporting fonts keep their SIL-OFL licenses.

Overview shows dense tasks, a centered score with small raised decimals, category breakdown, a large clock, and calendar access. Morning/afternoon/evening/night greeting follows actual time regardless of selected date. Missing-input warnings are larger in the breakdown. Each tab has one page title.

Shared LCD surfaces and inset controls keep all five sections consistent. Numbered tabs and a direct overview task-add button make navigation quicker. Tab/recap changes use a stepped fade with no panel movement; rings sweep on entry and task check-offs illuminate briefly. Typing and dragging remain immediate. Settings offers device motion, explicit On, and Reduced. On overrides the browser's reduced-motion preference within this app. Hover changes no button sizing or score position. Clicking the selected tab preserves its current scroll and editing state.

Add task opens an editor. Names and subtasks fit the font's measured ink height instead of a fixed tall box. Hanging letters lower only the underline into the existing gap; the writing baseline, adjacent remove button, and following controls stay in place. Wrapped names add real lines with consistent spacing. Sizing updates while typing, clearing, resizing, and loading fonts. Enter submits. Repeat choices are one time, every day, weekdays, weekly on the start weekday, or selected weekdays. Custom schedules require at least one selected day. Maximum name length is 100 characters and a parent supports up to 20 children. Tap a parent name or arrow to expand it. Children must all be done before the parent checks itself; parents do not add another scored action. Unfinished tasks can still be reviewed.

Recurring definitions start on the selected date. Occurrences are computed deterministically, including days never opened, with independent completion per date. Viewing a schedule does not create a saved record, checklist score, or logging streak. Adding/checking/removing a task or reviewing the checklist records checklist activity. Removing a recurring root skips only that date and supports Undo. The Recurring tasks panel can stop a schedule after actual today, preserving earlier history.

## Ratings, notes, and completion

Nutrition uses 0.1 dragging/button/arrow steps from 1 to 10. Direct input retains up to two decimals. Existing quarter ratings are preserved; adjustment snaps in the chosen direction to the next tenth. Home/End choose bounds and Clear means unentered.

Nutrition and training have optional notes, up to 5000 characters per day/section. Smaller handwritten text uses tighter spacing. A decorative cursor uses the owner's slash rotated upright. A clipped mirror positions it while the real textarea retains native input, selection, and scrolling. The decorative caret hides on selection/blur, falls back to native when measurement fails, and stops blinking for reduced motion. Notes do not affect score or block completion. Editing notes reopens only that section and the completed day.

Training uses direct radio buttons for Chest, Back, Triceps, Biceps, Shoulders, Quads, and Hamstrings, with an explicit Log [muscle] sets action. It accepts dated integer sets or explicit rest; remove sets before switching to rest. Targets/volume use Monday–Sunday weeks and retain actual over-target totals. Older combined Legs logs and targets remain unchanged; they are never split or relabeled. New muscles without a saved target still appear with their logged totals.

Start/Continue day review guides the missing/unreviewed tabs. Confirm nutrition/training/checklist review confirms that section only. Nutrition requires a rating; training requires sets/rest; checklist review permits unfinished or no tasks and does not check them off. Confirming the last section opens a full-day review card with score, category totals, tasks/subtasks, and training. Nutrition notes stay off that card. An optional handwritten Day comment saves separately, up to 5000 characters, without changing section reviews or scores. It also appears in the calendar recap. Only Complete entire day in the card finalizes the day. Keep editing and category shortcuts leave it open for corrections. Completed days have View day summary, with completion disabled and the day comment still editable. Pause review keeps entries saved. Section edits reopen the affected review.

## Daily and period scores

Daily score equally averages entered nutrition, checklist leaf completion, and training check-in (10 for sets/rest). A reviewed empty checklist counts as 10. Merely due recurring tasks remain unlogged until checklist activity. Missing categories are omitted and keep the score provisional. Daily/period averages round to one decimal; exact nutrition values remain visible.

Calendar rings show daily scores. Row-end averages use Monday–Friday, including outside-month dates in that week. Month averages use entered dates in the displayed month, including weekends. Blank days are omitted. Counts and partial state explain missing days or provisional inputs. The monthly average uses the same ring.

Ring color and glow increase continuously with a slight bias toward higher scores, so the brightest ice and glow take more effort to earn. The special white high-score treatment begins at 9.2; ten adds an outer halo. This changes only appearance: scores, ring fill, and averages stay exact. Provisional state stays visible; brightness does not mark a day complete. Logging streak counts consecutive days with all three categories logged. An unfinished today allows the run through yesterday; older gaps reset it.

Selecting a date opens a read-only daily recap: score and status, category totals, tasks with child dependencies, grouped training sets or rest, and full handwritten notes. Long lists/notes scroll within their section. Category buttons open that date's editor. Untouched schedules remain unlogged. Arrow keys move by day/week; Home/End choose Monday/Sunday, with focus preserved when crossing months.

## Implementation and verification

`app.mjs` connects controls; `model.mjs` owns records/reviews, `tasks.mjs` scheduling and leaf counts, `scoring.mjs` summaries/streak/greetings, `persistence.mjs` validated snapshots, and `handwriting-caret.mjs` the decorative notes caret. `radio.css` is the final theme after base/responsive styles. Font builders in `scripts/` derive local assets; original sources remain.

Snapshots are version 2 with recurring templates, child tasks, skipped occurrences, and checklist-activity state. The same localStorage key is retained so version-1 backups load with empty optional additions and unchanged history. Future production migrations remain a separate decision.

All 56 tests pass. Browser checks cover recurrence/custom-day validation, dependencies, skip/Undo/stop, dense rows and unclipped fields, actual tenth dragging and keyboard adjustments, notes persistence and caret scrolling/selection, averages, and guided completion. The polish pass also verifies quick-add, rich/empty daily recaps, 3632-character notes scrolling within their card, calendar keyboard navigation across months, and completion after editing an already completed day. Landscape overview fits 960×480, 1024×600, 1280×800, and 1920×1080. Eight complete task rows fit at 1280×800. All views fit the current browser override minimum of 480px without horizontal overflow; narrower sizes are clamped at the current desktop scale. Physical touch, screen readers, and the intended hardware remain untested.

Development remains local. Production technology, synchronization, score-policy versioning, and richer schedule editing remain open. See [current revision](radio-revamp.md).

## Sentiments

The Sentiments tab saves optional handwritten notes for each date. Its circular meter matches Nutrition, with a 0–10 scale, dragging, arrow keys, plus/minus, direct entry in tenths, Home (0), and End (10). It starts unrated. Remove rating excludes it again. Notes without a rating leave scoring unchanged. An entered rating, including zero, contributes a fourth equal component. Sentiments appear in the overview breakdown and day recaps, and flow into calendar averages. Three regular section reviews and logging streak requirements remain unchanged. Editing sentiments reopens final completion but preserves those reviews. Existing backups load with empty sentiments.

## Gym pace update

See [gym pace](gym-pace.md) for the current policy, which replaces the previous flat 10 for a training/rest check-in. Planned rest is now excluded from the average. Targets carry forward, and unplanned rest uses strict cumulative weekly pacing.
