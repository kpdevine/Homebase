# October 23 — phone controls and Solar System management

The owner requested this batch after the 22-planet release.

- Routine task checkoffs no longer open a toast or flash a full-width row bar. The checkbox keeps its completion feedback. Remaining toasts use the corrected fixed positioning.
- Center creatine Yes/No text independently of the old flex rule. Normalize the body-weight field to the other number controls and center Log/Edit weight with a separately positioned disclosure indicator, including WebKit appearance resets.
- Note/amount Save controls are hidden initially, appear on input, and disappear after a successful local flush. Autosaving and cloud behavior are unchanged. A failed save keeps the retry action available.
- Center the unnumbered Overview label in its own grid cell. To-do list is always the first numbered enabled tab, after Overview.
- Reopening To-do resets expanded task rows; collapsed remains the default. The explicit expanded-subtask preference remains available for users who choose it.
- Existing accounts can use Settings → Change my tabs; changes apply to current/future dates and preserve historical settings and records. The scoring-help icon and settings entry are removed from the visible interface.
- Solar System pending check-ins have a high-contrast dark/gold badge. The current user has the same card/portrait borders as others and a small You flag at the top left of their planet. Manage Friends centers the username underneath its heading.
- System search is unavailable while already in a system, including a client API guard. Invitations/primary selection retain their existing behavior.
- Owners can delete their Solar System through a confirmation dialog. This atomically marks the group deleted, removes its directory/ownership entries and owner membership index, and closes all admissions. It then cleans every final member index and outstanding request in bounded batches. Shared scores/day/reaction access is revoked; private logs and friendships stay intact. The owner can create a replacement. Archived membership metadata is readable only by its owner for cleanup, not by former members.

Verification: 236 normal checks passed; the emulator-only check was skipped in that run and passed separately against the actual driver. Security coverage includes non-owner rejection, incomplete deletion rejection, former-member access revocation, private-record preservation, and replacement creation. Local 390px phone QA exercised task toggles, notes input/save visibility, tab changes on an established workspace, creatine, weight controls, and fake-system deletion. Desktop preview does not certify physical iPhone Safari rendering.

Reminder work was explicitly set aside by the owner. No reminder service or delivery changes are included in this release.
