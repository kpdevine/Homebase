# November 2: immediate membership and 246-character vibes

Social startup runs when authentication identifies the account, instead of waiting for private records to synchronize. Membership and appearance watchers start before the public profile lookup and remain active when that lookup finishes. Opening or saving the day uses the loaded state.

Known positive memberships and appearance are cached per account on this device. Cached empty snapshots cannot overwrite a known membership before server confirmation. Confirmed membership changes replace the cache; a cached absence never exempts someone from required vibes. Cache storage failures fall back to the normal live listeners. Disconnected social previews do not read or write this cache.

Both vibes editors, shared client validation, and Firestore schema validation accept at most 246 characters. Boundary tests cover acceptance of 246 and rejection of 247 characters.
