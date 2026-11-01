# November 1: reliable daily vibes and dates

Day completion now waits for authentication resolution, the signed-in account's social initialization, a confirmed membership result, and appearance readiness when a member. Empty membership snapshots from Firestore cache are not proof of no membership; metadata-change events refresh the gate when the server confirms. Missing usernames also require a confirmed empty membership before exemption. Final-review controls refresh when cloud status changes, and submission rechecks readiness after saving vibes.

Each day submission saves its selected calendar day as vibesDate. Reusing the same text on another day starts a new reaction version. Manual text changes use the current local calendar date; planet-only edits preserve the original day. Solar System and public profile vibes show the recorded date, with Date not recorded for legacy entries. No date is inferred from sync timestamps.

The optional vibesDate field is validated in the appearance, shared score and profile-summary schemas. Existing ownership checks and reader scopes are unchanged; private logs remain inaccessible to other users.

Validation: full Node regression suite, demo-project Firestore emulator tests, and the integrated browser's sample Solar System. No physical iPhone verification available.
