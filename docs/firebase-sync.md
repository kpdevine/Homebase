# Firebase sync

Homebase uses the owner's Firebase project `homebase-d3c6c`, on the **Spark plan with no billing account**. Firestore Standard is in `us-central1` (Iowa). Google Authentication and classic Firebase Hosting are enabled. Analytics, Gemini, paid backups, Functions, Storage buckets, and App Hosting are not enabled.

## Connect a device

Open **https://homebase-d3c6c.firebaseapp.com/** on each device. This address uses same-tab Google sign-in so it works without a popup. In Settings → Cloud sync, sign in with the same Google account and choose **Enable sync for this workspace**. Wait for **Saved · cloud synced** before switching devices. The `.web.app` hosting alias also serves the app, but uses popup sign-in, as does localhost.

The local desktop shortcut remains available at `http://127.0.0.1:4173/`. Its browser profile, the hosted site, and the preview at port 4174 have separate local storage. Enabling sync connects the personal workspace currently open; it does not upload `?preview=1` data. To retain records currently stored in a preview, download a JSON backup there, then restore it in the personal workspace deliberately. Restore and hard reset propagate to other devices when cloud sync is enabled; both flows explain their scope. Export before replacing records.

Google sign-in alone reads the private cloud collection but uploads nothing until sync is enabled. Each device retains its own name and motion preferences. Signing out disconnects sync and leaves the local workspace available on that browser. Use a trusted browser/profile; signing out does not erase cached personal records.

## Records and live delivery

Records live under `users/{Firebase Auth UID}/records/{record ID}`. Security rules allow reads and writes only when the signed-in UID matches the path. Every write has an allowed record ID, format marker, bounded JSON payload, and server timestamp. Public Firebase web configuration identifies the project; it is not an admin credential. No account email, OAuth refresh token, service-account key, or personal browser record belongs in Git.

- One `day_YYYY-MM-DD` document contains that day's tasks, ratings, notes, review/completion state, and set entries.
- One `routine_<ID>` document contains a recurring task definition.
- One `targets_YYYY-MM-DD` document contains a target change, inherited by subsequent weeks.
- `settings` is a format marker, not a copy of the full history.

Payloads are canonical JSON strings inside Firestore documents, allowing the existing validated backup format to round-trip without changing its nested-array structure. Payload indexes are disabled. Session-scoped IDs prevent newly created records on different devices from sharing the old sequential counter.

A server-backed Firestore listener loads the full record collection at connection and receives changes thereafter; there is no polling. A nutrition edit normally changes one day document. While typing notes, local writes wait for 2.5 seconds of inactivity (with a 10-second safety save); leaving the field or page saves immediately. Other edits save after a short delay. Cloud uploads then debounce for 900 ms and use compare-and-set transactions. At most 100 changed documents and approximately 4 MiB of before/after payloads are handled per batch. Routine creation precedes dependent days; routine deletion follows them.

Initial connection costs a read per stored document (an empty query also has a minimum charge). A changed document is delivered as a read to each connected listener; the transaction also reads the touched document before writing. Debouncing reduces repeated writes during dragging/typing. Reconnection and rule evaluation can add reads. This is not one free read for a whole device sync, nor a read per field inside a daily record. See the official [Firestore pricing rules](https://firebase.google.com/docs/firestore/pricing).

## Offline and competing edits

The app saves its validated snapshot locally before queuing cloud changes. Each account/project has a local sync baseline. A loaded app can continue editing without the network and retries on reconnection, the next edit, or **Sync now**. The app waits while you type, drag a meter, or hold unsaved target edits before applying remote changes. This version has no service worker, so loading the website from a completely cold browser while offline is not guaranteed.

Edits to different records merge. If both devices change the same daily record, routine, or target record since their shared baseline, sync pauses and Settings lists the competing records. Download a local backup, then choose which version of those records to keep. Unrelated records still merge. A simultaneous nutrition edit and training edit on the same day therefore needs a choice; automatic field-level reconciliation is not implemented. In-flight acknowledgements preserve newer unsent local edits.

Local storage errors, malformed cloud records, oversized payloads, and another local tab's conflicting save stop application of cloud changes. Local data is retained for recovery. Keep periodic JSON backups: synchronization is not a historical backup service.

## Deploy from the local checkout

```powershell
npx.cmd --yes firebase-tools@15.34.0 deploy --only firestore,hosting --project homebase-d3c6c
```

The official Firebase CLI stores the owner's approved OAuth login outside this repository. Development stays local. `firebase.json` deploys only the static `prototype/` directory, owner-only rules, and index exclusions. `.firebase/`, logs, local records, and credentials are ignored. The app loads the official Firebase 13.0.0 browser modules only for personal workspaces; preview does not initialize Firebase.

The free plan currently includes 50,000 Firestore document reads, 20,000 writes, and 20,000 deletes daily, plus 1 GiB of stored data. Hosting has its own limits. With no billing account the project cannot silently incur pay-as-you-go charges; exceeding a free quota can interrupt service. Google can change quotas or terms. Check the [Spark plan documentation](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) before future feature additions.

## Verification

Automated tests cover document round-trips, one-document nutrition edits, record merging/deletion conflicts, unique concurrent IDs, payload bounds, bulk batching, explicit enablement, edit deferral, own-write acknowledgements, offline retry, conflict resolution, delayed server acknowledgements, and sign-out during an upload. Live browser checks and their results are recorded in START-HERE.md. Physical phone/display and long offline soak tests remain to do.
