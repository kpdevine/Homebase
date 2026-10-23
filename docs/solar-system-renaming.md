# Solar System renaming and status typography — October 23

Owners can rename their selected Solar System in Friends → Manage Solar Systems. The form starts with its current name and accepts 3–40 characters after trimming and collapsing whitespace. Saving disables the form, reports success or an inline error, and retains unsuccessful drafts. Incoming score updates preserve text being edited. Other members do not see the rename form.

The client transaction changes only the canonical group name and directory name/search key. Firestore rules require the current owner, an active system, matching directory/group names, and bounded name length, while preserving ownership and other fields. Memberships, shared scores, reactions, and private records stay intact. Group listeners resolve old membership, request, and invitation labels through the canonical group document, so existing members and pending recipients receive new names without a membership migration or unbounded write batch. These listeners are cleaned up when references disappear or the session ends. Older app versions must refresh to use these live labels.

Shared Current vibes messages use the Kieran handwriting font at 18px; their editor uses the Kieran handwriting entry font at 19px. Interface controls retain the normal UI font.

Verification: 236 regular tests pass, with the emulator-only test skipped in that run. The security suite passes separately against the local Firestore emulator using the actual browser driver. Added coverage checks owner-only renames, invalid/oversized names, incomplete atomic updates, ownership tampering, search changes, live member/request/invitation labels, and deleted systems. Local phone browser QA verifies normalized names, success feedback, whitespace-only errors, and successful retry. Sample data only was used.

Publication approved by the owner with “push it” on October 23. Deliver source and documentation to GitHub and deploy the matching app and Firestore rules together. Existing unrelated reminder policy edits are outside this change.
