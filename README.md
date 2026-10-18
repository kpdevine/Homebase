# Homebase

A local dashboard for dated tasks, recurring routines, nutrition ratings, training, and history. The interface follows the owner's car radio: dark blue backlighting, indigo ink, a charcoal frame, slightly pixelated type, and a large clock. The owner's handwriting appears in tasks, notes, and the notes cursor.

**Resume:** [START-HERE.md](START-HERE.md).

```powershell
npm.cmd run dev
```

Open [Homebase](http://127.0.0.1:4173/). Node.js is the only runtime required; no packages need installation. Keep the terminal running; Ctrl+C stops it. `npm.cmd test` runs 97 tests.

The root app starts empty and saves on this browser/device. [The synthetic preview](http://127.0.0.1:4173/?preview=1) uses separate storage. Settings provides validated JSON backup/restore. Settings → Cloud sync connects personal records across devices through Google sign-in and Firebase. Open [shared Homebase](https://homebase-d3c6c.firebaseapp.com/) on your phone and display. See [Firebase setup and sync](docs/firebase-sync.md).

## Features

- Overview, Nutrition, Daily training, Checklists, and Calendar tabs, compact reviews, and a guided day-completion flow.
- Dated one-time or recurring tasks: daily, weekdays, weekly, or selected weekdays. Expandable parents depend on all subtasks. Individual occurrences support removal/Undo; schedules can stop after today.
- Nutrition dragging/buttons/arrows in 0.1 steps, direct entry to two decimal places, and optional handwritten notes. Training has dated set/rest logs, weekly targets, and the same notes treatment. Notes have a small cursor made from the owner's rotated slash.
- Consistent LCD panels, numbered navigation, inset inputs, brief stepped transitions, and reduced-motion support. Dense tasks, a direct overview add button, aligned checkboxes, bold handwritten task headings, and entry underlines that accommodate descenders without shifting the layout. A time-based Chicago greeting, centered score with raised decimals, and a large corner clock.
- Blue/indigo meters coded by amount, larger missing-input warnings, gradually brighter rings with a slight bias toward higher scores, white accents at 9.2+, and a second halo at 10. Calendar daily, Monday–Friday weekly, and monthly rings plus a logging streak. Blanks are omitted; provisional state is explicit.
- Read-only daily recaps with score/status, tasks and subtasks, dated training totals, and full handwritten notes. Category shortcuts and keyboard calendar navigation make earlier days easier to revisit.
- Local persistence, backup export/import, storage recovery, and conflicting-tab protection. Version-1 backups migrate to version 2 without losing history.

Daily score provisionally averages entered nutrition, checklist completion, automatic gym scoring, and an optional Sentiments rating. Gym uses weekly goals ÷ 5 as a fixed daily workout target, full credit for useful sets, quarter credit for extra sets, and two flexible rest credits. Subtasks count once; parents are not double-counted. Merely scheduled tasks do not create scores or streaks before a checklist check-in. A reviewed empty checklist counts as no tasks due. Settings explains the policy.

## Development boundary

Keep development local. Firebase provides Firestore, Google Authentication, and classic Hosting on Spark with no billing. This buildless HTML/CSS/JavaScript app leaves the production framework and screen platform open. Prioritize landscape displays.

Original planning files were uploaded to [kpdevine/Homebase](https://github.com/kpdevine/Homebase). The development branch is `codex/homebase-prototype`; source checkpoints are saved locally and uploaded to GitHub. Personal records and credentials stay out of Git.

See [prototype guide](docs/prototype-guide.md), [app polish](docs/app-polish.md), [radio revision](docs/radio-revamp.md), and [data design proposal](docs/data-design.md).
