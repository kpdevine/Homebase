# Solar System consecutive streak

Solar System cards show a gold-glowing “5 day consecutive streak!” line above the monthly logged-day block when the member's current logging streak is at least three. One or two days and missing/legacy streak fields show no line. The streak follows the existing fully-logged-day definition, crosses month boundaries, and can end yesterday while today's check-in is pending. A missed yesterday breaks it; future records are excluded. The label also hides stale shared streaks once their end date is older than yesterday.

Summary publication shares only consecutiveStreak and streakEndDate alongside the existing score totals. Firestore rules permit legacy summaries, bound the count by total logged days, and constrain a nonzero streak's end to the summary's today/yesterday. Members publish their updated count on their next app sync; no private logs are shared.

Validation: 268 regular tests, 267 passed and one emulator-only skip. Three new tests cover month boundaries, zero-score logged days, missing-day breaks, backdated edits, future dates, stale summaries, the three-day threshold, and read-only calculation. The Firestore emulator suite passed with valid and invalid streak publication cases. Deploy rules and Hosting together; preserve unrelated reminder policy edits.
