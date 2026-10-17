# Radio display and task revision — October 17, 2026

The owner's car-radio photo remains the reference. The final palette is a darker blue LCD with slightly reduced saturation after the bright electric-blue iteration, indigo ink, a charcoal bezel, more visible fine horizontal scan lines, and restrained glow.

Implemented:

- Stepped type throughout: Radio Display for headings/numbers, a locally built Radio UI derivative of Inter for supporting text, and Kieran Handwriting LCD for tasks/notes. The original fonts remain available. Font builders and original SIL-OFL notices accompany the assets.
- Centered whole score with smaller raised decimals. Larger side warnings for unlogged categories; no central warning/info icon. One page title per tab. Time greeting always follows Chicago's current hour, including Good Night, independent of selected date.
- Amount-coded blue/indigo meters. Ring color/glow progress continuously with a slight bias toward the top end, making bright ice and glow a little harder to earn. The high-score treatment begins at 9.2; ten adds a second halo. Calendar cells and averages use the same treatment. Logged scores, ring fill, averages, and provisional/completion states keep their existing meaning.
- Monthly ring, Monday–Friday weekly rings, and a calendar logging streak. Month averages include weekends; blanks are omitted. The streak requires all three categories logged and preserves yesterday's run while today is unfinished.
- Tenth-step nutrition dragging/buttons/arrows, with exact older two-decimal ratings retained. Optional dated nutrition/training notes use smaller handwriting and a caret made from the owner's rotated slash. Textareas retain native editing/selection/scrolling.
- Dense task layout, close descenders, and expanding task/subtask fields that show the full writing. Eight complete rows fit the measured 1280×800 overview.
- Recurring tasks (daily, weekdays, weekly, selected days) and expandable dependent subtasks. Parents complete from all children, with leaf-only scoring. Per-day skip/Undo and stopping after today preserve earlier occurrences. Merely scheduled tasks do not fabricate scores or streaks.
- Version-2 snapshots with validated v1 migration, nested tasks and recurring definitions. Backups remain local.

Verification: all 42 tests pass. Browser checks cover real dragging to 6.4, tenth adjustments, note persistence and the handwritten caret through multiline scrolling/selection, routine/custom-day creation, dependencies, skip/Undo/stop, and guided completion. The four landscape overview sizes (960×480 through 1920×1080) fit. All tabs fit the current 480px minimum override; narrower requested overrides are clamped by desktop scaling. No new 320/390px visual claim is made. Physical touch, screen readers, and display hardware remain untested.

Agent-created test entries were removed. Entries the owner created during testing were preserved along with existing history and training logs. Backups and screenshots are saved in local chat artifacts. White padding from desktop screenshot capture was removed without changing page pixels.

Checkpoint: `homebase-greeting-bold-2026-10-17` on `codex/homebase-prototype`. The earlier `homebase-radio-2026-10-17` tag remains available; its quarter-step controls are superseded by this revision. No push or deployment occurred. Production framework, database, hosting, synchronization, and screen-platform choices remain open.

The time-of-day greeting uses a real bold Radio Display face; the name stays regular. The previous homebase-routines-lcd-2026-10-17 checkpoint remains available.

The later [app polish](app-polish.md) adds shared surfaces, brief stepped motion, quick-add, and daily recaps. Its current checkpoint is listed in [START-HERE.md](../START-HERE.md).
