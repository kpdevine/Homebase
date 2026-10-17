# App polish — October 17, 2026

This revision turns the radio outline into a consistent daily app while keeping the owner's LCD palette, stepped type, handwriting, dense checklist, large clock, score policy, and local storage.

## Display and interaction

The screen has a restrained blue backlight, charcoal bezel, visible scan lines, and consistent inset surfaces. Numbered tabs, grouped date controls, clearer primary actions, matching inputs, and quieter supporting labels establish a shared hierarchy across all five sections. The overview preserves eight full task rows at 1280×800 and adds a direct task composer shortcut. The checklist heading uses bold Kieran handwriting with border clearance. Descenders lower the field underline without shifting text, adjacent buttons, or following controls.

Tab and recap changes use a 300 ms stepped fade without moving the panel. Entry rings sweep for 780 ms; actual score changes settle over 420 ms. Checking off a task briefly illuminates its row and marker. Typing and dragging remain immediate. Settings offers Follow device setting, On, and Reduced. Explicit On enables app motion even when the browser requests reduced motion; this is enabled in the owner's preview. No new looping effects were added. Selecting the current tab preserves its scroll and editing state.

Review hover changes appearance only. Removing hover from the primary button's sizing rule prevents the score column from recentering. Actual pointer-hover checks at 1280×800 and 960×480 show zero changes to the score and button geometry.

Task checkboxes check off individual actions. Section buttons say Confirm nutrition/training/checklist review, with a distinct reviewed state. Start/Continue day review guides the unreviewed sections. Confirming a checklist leaves unfinished tasks unchecked. Only Complete entire day on Overview finalizes the day; section-header review links only navigate, including when all three reviews are already confirmed. Pause review keeps entries saved.

## Daily recap

Selecting a calendar date displays its score ring, logged/reviewed/completed state, nutrition rating, training sets or rest, and checklist totals. Expandable tasks preserve child dependencies and completion marks. Training entries are grouped by muscle for that date. Optional notes retain their full handwritten text; long notes and lists scroll within their section. All user text is escaped before rendering.

The recap is read-only. Opening an untouched recurring day does not create a check-in or a score. Empty, partly logged, all-logged, and completed days remain distinct. Category buttons open that date's editor. Calendar arrows move by day/week, with Home/End for Monday/Sunday and focus preserved across month boundaries. Existing monthly and Monday–Friday average rings, logging streak, and the tougher 9.2+ white reward treatment remain.

## Evidence

- `npm.cmd test`: 47 passing tests. Five recap tests cover untouched recurring dates, date-specific training aggregation, rest/empty checklist/completed states, literal multiline notes, detached data, and leaf-only task totals. Existing scoring, schedules, migration, storage, notes, review, averages, and reward tests still pass.
- Browser checks cover overview quick-add, one-time tasks, a daily parent with two children, check-off feedback, nutrition tenths, notes, multiple training entries, review through completion, and persistence after reload. Interaction fixtures use a separate local origin on port 4174; the user's port-4173 records are preserved.
- The updated completion flow was checked with seven unfinished tasks: checklist confirmation preserved the 3/10 task count and left the day in progress. Returning from a section after all reviews were confirmed also left the day in progress. Only Complete entire day finalized it, and that state persisted after reload. No browser errors were reported.
- Every tab has no horizontal overflow at actual 960×480, 1024×600, 1280×800, 1920×1080, and 480×840 viewports. The overview fits vertically at all four landscape sizes. Detail screens scroll as their content requires. Desktop scaling clamps narrower requested sizes; no 320/390px claim is made.
- Calendar keyboard navigation crosses October/November with focus intact. Scheduled but unlogged dates show no score. Recap shortcuts open the selected date. Handwritten task/subtask descenders produce zero movement in following controls at narrow width.
- Screenshots and `homebase-polish-layout-checks.json` are in this chat's local artifact folder. The overview, nutrition, training, recap, and composer were inspected visually. Only blank screenshot padding is removed; no UI pixels are retouched.

Development remains local. No framework, database, hosting, account, synchronization service, or screen platform has been chosen. Physical touch and the target display hardware remain untested.
