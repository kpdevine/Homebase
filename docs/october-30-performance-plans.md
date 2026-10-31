# October 30: profile loading, planned tasks and scroll bounds

Profiles render existing Solar System member summaries immediately, or reuse a previously viewed profile, while refreshing the full profile in the background. Pending requests are deduplicated and caches clear on account reset. Friend and system name lookups run concurrently. No Firestore rule changes.

The iPhone startup minimum is 400ms with a 180ms fade and small upward movement. Ready apps do not wait for decorative images. Reduced motion skips the minimum and exit animation. A 1400ms fallback prevents a stalled cover.

The task editor now has one Plan to do by field. Unfinished one-time tasks appear every day from creation, sort by planned date with undated tasks last, and show Overdue after the planned day. Score eligibility remains unchanged: no penalty before the planned date. Existing future plans become visible from today without adding copies or changing earlier history. Early completion prevents later resurrection. Backup fields remain compatible.

Page overscroll is disabled in CSS, with an edge-only touch guard for Safari. Nested scrolling and pinch gestures remain available.

Validation: full Node suite and integrated browser checks of profile details, task labels and task editor. No physical iPhone testing was available.

## Follow-up: continuous task visibility

The only visible task date is now labeled Plan to do. All later-week preview lists include pending carryover tasks instead of filtering them to their planned day. The store also uses creation time when adding a one-time task through a future calendar day. Tasks with an explicitly blank plan remain visible but are excluded from task score totals. Regression coverage exercises the actual daily and later-week render paths, future-date creation, completion, cloud round trips and score eligibility before/on/after the plan.
