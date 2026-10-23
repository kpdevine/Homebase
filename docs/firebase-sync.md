# Firebase sync

Pocket Planet uses the owner's Firebase project `homebase-d3c6c`, on the **Spark plan with no billing account**. Firestore Standard is in `us-central1` (Iowa). Google Authentication and classic Firebase Hosting are enabled. Analytics, Gemini, paid backups, Functions, Storage buckets, and App Hosting are not enabled.

## Connect a device

Open **https://pocketplanet.day/** on each device. This address uses same-origin, same-tab Google sign-in so it works on browsers that restrict third-party storage and popups. In Settings → Cloud sync, sign in with the same Google account and choose **Enable sync for this workspace**. Wait for **Saved · cloud synced** before switching devices. The original **https://homebase-d3c6c.firebaseapp.com/** remains available with its existing redirect sign-in. The `.web.app` hosting alias also serves the app, but uses popup sign-in, as does localhost.

The custom domain serves the same Firebase project, Auth users, and Firestore records. Browser-local storage is per origin: the new address starts a separate local workspace. Connect the same Google account and enable sync to receive existing cloud records. Names, motion preferences, and any local-only records do not transfer merely because the domain changed. The original site is retained, with no forced redirect that could strand its local data.

## Custom domain configuration

`pocketplanet.day` is registered with Cloudflare and attached to the `homebase-d3c6c` Firebase Hosting site. DNS has an apex A record to `199.36.158.100` (DNS only), an apex TXT `hosting-site=homebase-d3c6c`, and Firebase's requested `_acme-challenge` TXT for certificate validation. Firebase manages HTTPS issuance/renewal. Keep the certificate verification record until Firebase no longer requests it.

Firebase Authentication's authorized domain list includes `pocketplanet.day`. The existing Google web OAuth client retains its old entries and adds JavaScript origin `https://pocketplanet.day` and redirect URI `https://pocketplanet.day/__/auth/handler`. `authDomainFor()` chooses the custom auth domain only on that exact hostname; existing Firebase aliases and local previews retain their prior auth configuration. CSP permits the custom-domain auth frame. No new Firebase project, database, billing account, or data migration is required.

The local desktop shortcut remains available at `http://127.0.0.1:4173/`. Its browser profile, the hosted site, and the preview at port 4174 have separate local storage. Enabling sync connects the personal workspace currently open; it does not upload `?preview=1` data. To retain records currently stored in a preview, download a JSON backup there, then restore it in the personal workspace deliberately. Restore and hard reset propagate to other devices when cloud sync is enabled; both flows explain their scope. Export before replacing records.

Google sign-in alone reads the private cloud collection but uploads nothing until sync is enabled. Each device retains its own name and motion preferences. Signing out disconnects sync and leaves the local workspace available on that browser. Use a trusted browser/profile; signing out does not erase cached personal records.

## Records and live delivery

Records live under `users/{Firebase Auth UID}/records/{record ID}`. Security rules allow reads and writes only when the signed-in UID matches the path. Every write has an allowed record ID, format marker, bounded JSON payload, and server timestamp. Public Firebase web configuration identifies the project; it is not an admin credential. No account email, OAuth refresh token, service-account key, or personal browser record belongs in Git.

- One `day_YYYY-MM-DD` document contains that day's tasks, ratings, notes, review/completion state, and set entries.
- One `routine_<ID>` document contains a recurring task definition.
- One `targets_YYYY-MM-DD` document contains a target change, inherited by subsequent weeks.
- `settings` is a format marker, not a copy of the full history.

Payloads are canonical JSON strings inside Firestore documents, allowing the existing validated backup format to round-trip without changing its nested-array structure. Payload indexes are disabled. Session-scoped IDs prevent newly created records on different devices from sharing the old sequential counter.

New saves can include an `_editedAt` timestamp inside the existing JSON payload. It describes the saved edit, not the later upload time. The transport separates this metadata from validated app records. A compact local ledger ties each edit time to its saved payload and survives reloads/offline use. This uses existing document writes, with no additional Firestore documents, changed owner rules, or automatic upload on sign-in. Legacy records without edit times remain readable.

A server-backed Firestore listener loads the full record collection at connection and receives changes thereafter; there is no polling. A nutrition edit normally changes one day document. While typing notes, local writes wait for 2.5 seconds of inactivity (with a 10-second safety save); leaving the field or page saves immediately. Other edits save after a short delay. Cloud uploads then debounce for 900 ms and use compare-and-set transactions. At most 100 changed documents and approximately 4 MiB of before/after payloads are handled per batch. Routine creation precedes dependent days; routine deletion follows them.

Initial connection costs a read per stored document (an empty query also has a minimum charge). A changed document is delivered as a read to each connected listener; the transaction also reads the touched document before writing. Debouncing reduces repeated writes during dragging/typing. Reconnection and rule evaluation can add reads. This is not one free read for a whole device sync, nor a read per field inside a daily record. See the official [Firestore pricing rules](https://firebase.google.com/docs/firestore/pricing).

## Offline and competing edits

The app saves its validated snapshot locally before queuing cloud changes. Each account/project has a local sync baseline. A loaded app can continue editing without the network and retries on reconnection, the next edit, or **Sync now**. The app waits while you type, drag a meter, or hold unsaved target edits before applying remote changes. This version has no service worker, so loading the website from a completely cold browser while offline is not guaranteed.

Edits to different records merge. If both devices change the same daily record, routine, or target since their shared baseline, the version with the later known saved edit time wins automatically. A newer local version uploads over the older cloud copy; a newer cloud version is adopted locally. This resolves whole records: simultaneous edits to Nutrition and Training on the same date are not merged field by field. Receiving cloud records keeps their original edit time. Explicitly choosing a local version in a remaining conflict counts as a fresh saved decision.

Equal or missing edit times, times more than a minute into the device's future, and deletion-versus-edit conflicts still pause for a choice in Settings. Old records are not stamped as newly edited merely because the page opened. Download a local backup before resolving uncertain versions. Transactions compare both the expected payload and its edit time so an intervening save cannot be overwritten blindly. In-flight acknowledgements preserve newer unsent local edits. Refresh other open devices after this release so they use the new timestamp-aware client; older clients may save records without edit metadata.

Local storage errors, malformed cloud records, oversized payloads, and another local tab's conflicting save stop application of cloud changes. Local data is retained for recovery. Keep periodic JSON backups: synchronization is not a historical backup service.

## Deploy from the local checkout

```powershell
npx.cmd --yes firebase-tools@15.34.0 deploy --only firestore,hosting --project homebase-d3c6c
```

The official Firebase CLI stores the owner's approved OAuth login outside this repository. Development stays local. `firebase.json` deploys only the static `prototype/` directory, owner-only rules, and index exclusions. `.firebase/`, logs, local records, and credentials are ignored. The app loads the official Firebase 13.0.0 browser modules only for personal workspaces; preview does not initialize Firebase.

The free plan currently includes 50,000 Firestore document reads, 20,000 writes, and 20,000 deletes daily, plus 1 GiB of stored data. Hosting has its own limits. With no billing account the project cannot silently incur pay-as-you-go charges; exceeding a free quota can interrupt service. Google can change quotas or terms. Check the [Spark plan documentation](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) before future feature additions.

## Verification

Incoming changes also wait while a dialog, visible expanded panel, focused control, unsaved editor, drag, or guided day review is active. This includes reading and preparing to type; there is no idle timeout. Closing a menu, leaving its visible section, finishing/pausing review, or finishing an editor resumes queued updates when drafts permit. The newest queued cloud snapshot replaces older queued snapshots. A cloud refresh does not close the final review or cancel the guided review. Local saving continues normally during the wait.

Automated tests cover document round-trips, one-document nutrition edits, record merging/deletion conflicts, unique concurrent IDs, payload bounds, bulk batching, explicit enablement, edit deferral, own-write acknowledgements, offline retry, conflict resolution, delayed server acknowledgements, and sign-out during an upload. Live browser checks and their results are recorded in START-HERE.md. Physical phone/display and long offline soak tests remain to do.


## Customization and social records

The private `settings` record now carries logging configuration and a catalog of historical training-group names. Daily records optionally contain their configuration snapshot, protein/calorie amounts, and training minutes. Existing v2 and older imports remain valid. Do not remove unknown retired groups from the historical catalog.

Separate social collections contain only usernames (`handles`, `publicProfiles`), friend requests, reciprocal friendships, and aggregate `socialScores`. Only the owner writes their summary; only accepted friends or that owner can read it. A summary contains yesterday's score, monthly average, monthly/all-time logged counts, date keys, and updated timestamp. No private-record permission is widened. Rankings are client-derived personal-tracking scores rather than a tamper-proof competition service.

Install developer dependencies with `npm.cmd ci`. With Java 21+ available, run `npm.cmd run test:rules`: it uses an isolated `demo-pocket-planet` emulator and never production records. Ordinary tests run with `npm.cmd test`; the emulator-only test is skipped outside that command. The access test verifies unique usernames, prefix queries, private log isolation, pending/accepted friend access, reciprocal acceptance, score shape/ranges, live listeners, and removal revocation.


## Solar Systems and optional trackers — October 22

Private settings also contain the selected logging tabs, `tabsChosen`, and Sleep/Prayer time goals. Their daily minutes and review flags remain inside the existing owner-only daily record. Earlier dates retain their own configuration. No private-record permissions are widened.

Solar Systems use `friendGroups`, `groupDirectory`, `groupMemberships`, `groupRequests`, and owner-only `socialPreferences`. Admission requires an owner-approved join request or an invitation accepted by its recipient. Member documents and their private membership indexes are created and removed atomically. Owners remain members. Directory entries contain only system names and owner usernames.

Group-local `scores` and `days` contain validated score summaries only; group members can read these and the group's reactions. Up to 35 recent logged day scores are shared. One reaction per member/target/date can be changed or removed. Private notes, tasks, food, workout details and weight never enter these collections. Leaving/removal revokes reads and writes for that group. All eleven reaction kinds, listener queries, consent checks, invalid writes and outsider access were verified against the local Firestore emulator.

Deploy the matching rules with Hosting; no new composite indexes or paid services are required for this release.


October 22 member-card follow-up: `socialPreferences/{uid}` also stores owner-only `planet` and `vibes` (160 characters maximum); changes to primary membership merge these fields rather than replacing them. Only group score documents may include this appearance data. Ordinary friend aggregates remain score/count only. Group members can listen to shared day documents filtered by date for after-9-p.m. logging status, and see reaction senders. Security tests cover profile creation before group creation, preference preservation, outsider rejection, and invalid/oversized profile data.
