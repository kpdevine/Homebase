# Google account onboarding

First opening presents **Continue with Google**. Returning authenticated users
automatically load their workspace. The local-only option remains available.

Google sign-in enables private Firebase sync automatically. A fresh device's
empty defaults yield to existing cloud records before setup can open. An empty
cloud account starts with the fresh module defaults, then prompts for modules,
order, goals, and logging settings. Those settings already use the private
account settings record.

Name, theme, and motion now live in the same private settings record under
`settings.accountPreferences`. A saved name wins; accounts without one start
with the first word of Google's display name. Preference changes do not complete
setup, rewrite daily configurations, or invalidate reviews.

Offline workspaces, device preferences, and record edit timestamps are cached
separately per project and UID. Switching accounts saves the previous workspace
and restores only the selected account. Signing out restores the independent
device workspace. Existing installs with a saved per-account sync baseline or
enabled flag migrate their current local workspace once, preserving offline
edits. First cloud restoration remains pending across reloads until completed.

No Firebase permissions or rules were expanded. Account settings stay in the
existing owner-only `/users/{uid}/records/settings` document.

Validation: automated tests cover new-device cloud precedence, new-account
settings uploads, setup flags, preference round-trips, account separation,
legacy migration, interrupted restoration, and failed cache writes. The isolated
browser harness in `.local/serve-account-preview.mjs` simulates Google and cloud
transport without contacting Firebase; it is ignored and is not deployed.
