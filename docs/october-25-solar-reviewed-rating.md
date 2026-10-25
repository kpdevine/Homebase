# Solar Systems: Today after review, otherwise Yesterday

The main rating on each member card shows today's recorded score only after that member completes the full review for the displayed calendar day. Until then it shows yesterday's shared score. A visible Today/Yesterday label, accessible name, reaction badges and day-detail link all use the same selected date. If yesterday has no shared score, Yesterday shows a dash. A completed zero score is valid. Reopening today's review immediately returns the member to Yesterday once the new state syncs; the owner's own card uses local review state immediately.

The viewing device's calendar date and midnight refresh remain the Solar System date boundary. Personal logging and Tonight's check-in keep their existing 1 a.m. app-day boundary. Monthly averages, rankings and logged-day counts retain their current calculation. Only recorded shared scores are used; optimistic task projections are never published.

Shared day documents add the optional boolean `reviewComplete`. Existing documents without the flag are treated as incomplete. Day publication compares both score and completion, so completing/reopening without a numerical score change is still synchronized. The existing member-only read/owner-only write rules now permit this boolean and reject other types or private fields. No private-record schema or access permission changes are introduced.

The selected Solar System watches both today's and yesterday's shared days and reactions. Switching systems, signing out or crossing midnight stops the old listeners; callbacks from stopped windows are ignored. Reaction badges and the opened reaction thread follow the displayed date. Existing clients remain compatible but need a refresh to publish the new completion flag.

Verification: 258 regular tests (257 passed, one emulator-only skip), plus the passing Firestore emulator security test. Coverage includes missing/false/true completion, zero scores, stale dates and month/year boundaries, reopen without score changes, listener cleanup, real driver publication, legacy documents, field validation, member isolation and private-note rejection. A browser fixture uses synthetic members and the actual UI to verify Today/Yesterday switching, the matching score, and both reaction threads. No personal data or production reactions were used for QA.

Delivery uses the existing GitHub and Firebase workflow and includes Hosting plus Firestore rules. The unrelated reminder-policy edits remain outside this release.
