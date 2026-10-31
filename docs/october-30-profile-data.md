# Profile data correction

Profiles previously depended on the new `profileSummaries` copy, so older accounts could appear empty or disagree with their Solar System card. Profiles now reconcile existing score summaries and authorized shared group records by their saved update time, retain the current username, and use the owner's canonical appearance record for planet and Current vibes. Legacy shared days can supply missing streak metadata. Unavailable values display as unknown instead of inventing zeroes or a happy planet.

The owner explicitly approved allowing signed-in profile viewers to pull the existing validated `socialScores` and `socialPreferences` records and deploying the correction to pocketplanet.day / homebase-d3c6c. These records contain aggregate scores/counts/streaks, planet, shared vibes, selected system and update metadata. Writes remain owner-only and schema-validated. Private `/users/.../records`, personal memos, friend requests and member-only group data retain their existing protections.

Six profile reconciliation tests pass. The demo Firestore suite passes for legacy profiles, fresher group records, nonfriend access, anonymous-read rejection, invalid appearance writes and private-log isolation.
