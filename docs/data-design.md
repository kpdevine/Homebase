# Data design proposal

Status: proposed for discussion. No database, provider, or region is selected or provisioned.

## Separate the three storage decisions

1. GitHub stores source code and the instructions that describe the database structure.
2. The prototype uses synthetic sample information locally. Persistence can be decided when it becomes useful.
3. A future database stores actual personal records and supports access from multiple devices. Its host can be chosen independently of where the interface is hosted.

## Proposed records

These are logical records; they do not require a particular database engine.

| Record | Main information | History rule |
| --- | --- | --- |
| Task definition | Stable ID, name, active/archived state | Archiving a task preserves recorded daily instances |
| Task schedule version | Task ID, recurrence rule, effective date interval | A new schedule version changes future occurrences |
| Daily task instance | Task ID, local date, task name snapshot, completion state and timestamp, source schedule version if recurring | A unique instance records what was due and what happened on that date; one-time tasks need no recurring schedule |
| Daily rating | Category ID, local date, integer score 1–10, created/updated timestamps | One score per category and date; missing remains absent rather than becoming 1 |
| Muscle group | Stable ID, name, active/archived state | Retiring a group preserves earlier training records |
| Weekly target | Muscle group ID, week start date, target set count, name snapshot | Each recorded week retains its own target; changing defaults affects future weeks |
| Gym entry | Stable ID, activity date, muscle group ID, set count, timestamps | Weekly totals are calculated from dated entries rather than stored as the only evidence |
| Scoring policy version | Stable ID, effective dates, category weights, rules, rounding and missing-input policy | Earlier days keep their original scoring policy |
| Daily summary | Local date, policy version, input snapshot, calculated overall score, calculation timestamp | A summary can be reproduced and is refreshed deliberately when that day's inputs are edited |

The daily summary and scoring policy are later implementation work. The prototype can show a clearly labeled sample overall score.

## Protect history without preventing corrections

- Example: changing a recurring reading task from every day to weekdays takes effect from a chosen date. Previously recorded weekend instances remain available.
- Example: changing a chest goal from 12 sets to 16 next week leaves this week's target at 12.
- Example: editing yesterday's nutrition score updates yesterday's record. Its overall score is recalculated using yesterday's policy, with the updated inputs saved alongside the result.
- Default goal and formula changes do not recalculate earlier days silently.
- A past day's checklist comes from its recorded daily instances, not from today's task list.
- Recurring tasks must also be expanded for days the app was not opened, using the schedule effective on each day. Merely generating tasks when a screen opens would leave gaps in history.
- Weeks with targets but no gym entries still exist and can show zero completed sets.

## Dates, boundaries, and scores

- Store the intended calendar date explicitly, for example `2026-10-15`. A daily record must not move dates because a UTC timestamp crosses midnight.
- Store event timestamps separately in UTC, with the relevant named timezone where needed. America/Chicago is the initial planning context; travel behavior remains a product decision.
- Agree on the week start before implementing gym aggregation. Save the week start with each target so a later preference change cannot silently regroup old targets.
- Subjective ratings are integers from 1 through 10. Set counts and targets retain their actual units.
- An unentered score is missing, never an automatic 1 or 0. Treatment in the overall score is still undecided.
- Weekly gym completion, elapsed time in a week, and rest days need an explicit policy before gym contributes to a daily score.

## Keep the interface independent of storage

The interface should ask a small data-access layer to load a day, update a rating, toggle a task, or load a week. Initially that layer can read and update sample records in memory. A later implementation can use local or hosted storage without putting database queries inside meter interactions.

Keep scoring functions separate from both the meter and storage layer. Shared record shapes reduce migration work; they do not make a future migration or synchronization automatic.

Do not build sync machinery now. When it is added, define duplicate prevention and simultaneous-edit behavior, including an explicit way to resolve competing changes to the same daily score.

## Storage options to evaluate

| Option | Where data lives | Why consider it | Main tradeoff |
| --- | --- | --- | --- |
| Local sample records | Prototype session on the current device | Enough to test the interface with no database setup | No durable shared personal history |
| SQLite | A file on the machine running the database code | Useful for a later local persistence milestone | Multi-device access needs an application service or a separate sync solution |
| PostgreSQL through a managed provider, for example Supabase | A managed database in a selected region | Relational records and historical queries fit the proposed model | Adds cloud setup, access control, backup policy, and migration work |
| Cloud Firestore through Firebase | Documents and collections in Google Cloud | Alternative worth comparing for client applications | Requires a different query and reporting design from relational SQL |

Working recommendation for discussion: evaluate a relational model first because dates, recurring definitions, target history, and reporting have clear relationships. Keep the prototype database-free. Supabase/PostgreSQL is a candidate, not a selection.

## Where the future cloud data would be stored

The database provider and geographic region are separate choices. Supabase projects have a primary region and offer specific US regions including Ohio and North Virginia. Firestore offers regional and multi-region locations. The final location should reflect the user's preference and the location of any future application service.

Region selection deserves a decision before provisioning: Supabase region changes require migration to another project; Firestore instance location cannot be changed after provisioning. Application hosting and database hosting do not need to be the same service, but access latency and operations should be considered together.

Before choosing a provider, compare current pricing, export/restore support, backup coverage, idle-project behavior, ownership controls, and region options. These have not been fully evaluated yet.

## Repository boundary

Commit synthetic samples and eventual schema migrations. Exclude credentials, personal exports, and live database files. Repository access and database access will be separate permissions. No cloud resources are needed to review this proposal.

## Official references

- SQLite local and client/server usage: https://www.sqlite.org/whentouse.html
- Supabase PostgreSQL database: https://supabase.com/docs/guides/database/overview
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Supabase region migration: https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z
- Firestore data model: https://firebase.google.com/docs/firestore/data-model
- Firestore locations: https://firebase.google.com/docs/firestore/locations
