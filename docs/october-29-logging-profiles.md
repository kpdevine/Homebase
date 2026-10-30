# October 29 social and logging release

The owner approved publication with “push all” on October 29, 2026. Release matching Firebase Hosting and Firestore rules; the reminder Worker is unchanged.

## Logging and tasks

Logging dialogs fit the viewport without horizontal scrolling. Sentiments puts the rating first, followed by a Training-style Yes/No choice for a personal memo explicitly marked private. The final review only reveals the memo editor when text already exists.

Solar System members write shared Current vibes on the final confirmation screen for each logged day. Confirmation waits for membership loading and a successful vibes save; blank input, save failure, account changes and duplicate clicks cannot complete the day incorrectly. Completed-day recaps do not ask for vibes again.

Tasks show Plan to do plus the date. Expiration is optional. Unfinished one-time tasks, including older tasks, remain visible from their planned day until completed and contribute an unfinished task score on every pending day. Earlier days receive no penalty. Expiration-only tasks are unpenalized before expiration. Penalties alone do not mark a check-in or earn a logging streak. IDs, dated completion history, editing, removal, Undo and backup/private-cloud round trips are preserved. Past unfinished planned-date bubbles glow red.

## Profiles and Solar Systems

The current user appears first with My profile; medals still reflect monthly rankings. Signed-in users can view profiles before becoming friends, from search, Solar System usernames and clickable friends lists. Profiles show the planet, shared vibes, current Solar System, current-month average, total logged days, current streak and a counted three-column friends grid. Names use Kieran handwriting. Current vibes and statistics use matching inset panels; month names appear above average rings and captions below. Larger stats, restrained count badges, golden streak celebrations, and cohesive member/management cards improve readability. Short Solar System usernames fit one line, with wrapping for longer names and very small containers. Motion respects reduced-motion settings.

Cancel request and Remove friend use identical 108 × 32px controls at the right edge of a full-width profile action row. Labels are bold with a quieter fill than Request friend. The Friends badge is dark with a subtle glow. Removing a friend first asks Are you sure? and provides Keep friend. Manage Friends omits the user's own handle. Both management sections share uppercase centered headings, matching chevrons and inset cards. Solar System name entry/search/renaming uses bold Kieran; Save name turns dark for one second only after success.

`profileSummaries/{uid}` exposes only validated shared summary/appearance fields to signed-in viewers. Signed-in reads of friendship and membership indexes support profile navigation. System names resolve from the current directory, avoiding stale renamed/deleted labels. Private daily records, incoming/outgoing requests and member-only scores/reactions retain their access protections. Existing users populate public summaries on opening the updated app. No private memo, food, task, workout or weight fields enter these summaries.

## Cloud sync

Settings displays the last successful server-confirmed sync time in the device's timezone, persisted per account. No-op timers, opening Settings and unconfirmed uploads do not advance it. Account switching does not expose another account's timestamp. The disconnected preview explicitly describes local-only storage.

## Validation and release

311 ordinary app checks pass; one database-only check is skipped there and passed separately in the expanded Firestore emulator suite. JavaScript syntax and Git whitespace checks pass. Security checks cover nonfriend profiles/membership, live system-name resolution, invalid/anonymous writes and private-log isolation. Sync tests cover confirmation timestamps, no-op timers, pending uploads and account isolation.

Isolated browser previews at 390px and 320px verify mobile profile layout, matching relationship-button sizing/placement, working request cancellation, nonfriend navigation, removal confirmation/Keep friend, and the three-column grid. Physical iPhone Safari and installed-app rendering were not available for testing. The demo runs with `node scripts/serve-social-preview.mjs`; its `/phone-preview?width=390` and `width=320` routes use fictional records and no Firebase connection.

Publish source to `codex/homebase-prototype` and deploy Hosting plus Firestore rules to `homebase-d3c6c`. Exclude the pre-existing reminder-policy edit, experiments and unrelated output files.
