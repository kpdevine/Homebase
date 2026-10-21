# Nightly logging reminders

Pocket Planet offers an opt-in reminder on each device in Settings → Logging reminder. On iPhone, first add the app to the Home Screen, open that installed app, sign in and enable cloud sync, then tap Enable notifications and allow the iOS prompt. Permission is requested only from that tap. A browser bookmark that opens a normal Safari tab is insufficient for iPhone Web Push.

The deployed reminder is eligible after **10:30 p.m. America/Chicago**, automatically following daylight saving. The server checks every five minutes. It sends at most once per device per calendar day, only while Nutrition, Daily training, or To-do list is unlogged. Completing the separate final day review is not required to suppress it; Sentiments remains optional. Midnight stops the previous day's reminder window. Delivery remains subject to the device's notification permissions, Focus settings, connectivity and Apple's push service.

October 21 local app change, held for review: the app itself now uses the device's timezone and keeps the preceding record date until 1:00 a.m. The reminder client does not submit a selected date or score; `/state` asks the server to read the owner's Firestore status, so viewing or editing a prior date does not accidentally change the server's target date. The paused reminder service still uses its existing Central-time evening window and midnight cutoff. Adapting its schedule/date selection for devices in other timezones and extending its window to the app's 1:00 a.m. boundary is a separate backend follow-up; this app change does not deploy or alter that service and sends no notifications.

## Services and privacy

Firebase remains on Spark. A free Cloudflare Worker (`pocket-planet-reminders`) and its D1 database handle the schedule. The app stays on Firebase Hosting at pocketplanet.day. No paid upgrade or billing changes were made.

The reminder API validates Firebase ID tokens for the existing project, including issuer, audience and signature. The server reads the authenticated owner's current Firestore day record using that short-lived token and the existing owner-only rules, then stores only a logged/not-logged status with its saved version. Notes, scores, body weight and other daily content are not retained in D1. ID tokens are never stored. A confirmed cloud-sync update on any signed-in device refreshes this status; a disconnected device's unsynced changes cannot suppress a server reminder until they reconnect.

D1 also stores per-device Web Push subscriptions, owner IDs, timezone, and delivery dates. Subscriptions are accepted only for known browser push-service hosts. A user can disable only their own subscription. Signing out also unsubscribes that browser; expired subscriptions are removed when delivery returns 404/410. Daily status cache older than three days is removed during the evening sweep. The scheduler atomically claims a device/day before sending, avoiding duplicate deliveries from overlapping scheduled runs. Uncertain sends are not retried automatically, to avoid duplicate notifications.

The VAPID private key is a Worker secret, with a local recovery copy under ignored `.local/`. It is never included in Git, frontend files, command arguments or logs. Cloudflare CLI credentials use Windows Credential Manager via the official CLI's keyring integration. No Firebase service-account key or administrator role is needed.

## Development and deployment

The main app remains buildless. Backend dependencies are isolated in `server/reminders` and pinned by its package lock. Use `npm.cmd ci --prefix server/reminders` after a fresh checkout, then `npm.cmd --prefix server/reminders test`. Main policy/achievement tests run with the existing `npm.cmd test` command.

Deploy the worker with the authorized Cloudflare CLI and `--config server/reminders/wrangler.jsonc`. Initialize a new reminder-only database using its `schema.sql`; never run that command against the app's Firestore records. Keep the deployed endpoint in `prototype/reminder-config.mjs` and both hosting/local CSP connect-src lists. The push-only service worker has no asset cache or fetch interception, preserving the normal release update behavior.

Physical iPhone notification delivery requires the owner's one-time permission and has not been simulated or claimed by desktop QA.
