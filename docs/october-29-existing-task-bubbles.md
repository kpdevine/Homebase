# Existing-task date bubbles

The owner reported missing bubbles in their app after the task release. The deployed HTML, app module and stylesheet matched the approved release and were served with `Cache-Control: no-cache`.

The renderer required explicit `displayDate`/`dueDate` fields. Tasks and routines created before the release did not have those fields, even though they already belonged to a scheduled calendar day. They therefore rendered without either bubble.

The renderer now uses the existing scheduled day as a Plan bubble when `displayDate` is absent. The actual occurrence date is passed separately from today's date for future planning cards. Explicit `displayDate: null` remains blank. Deadlines are shown only when saved, avoiding invented due dates. Recaps retain that distinction and do not add date bubbles to child actions. This is a presentation fix: snapshots, reviews, IDs, completion and recurring schedules are unchanged.

App and stylesheet entry URLs now use `20261029-task-bubbles` to request the current UI on reload. An already-open installed app still needs one reload/reopen to run the new code.

Verification: 301 tests, 300 passing and one emulator-only skip. New checks cover legacy dated tasks, recurring occurrences, tomorrow's occurrence date, explicit blank planning, recap fields and unchanged snapshots. An isolated browser preview with existing-format seeded tasks showed Plan bubbles in both Overview and the to-do list.
