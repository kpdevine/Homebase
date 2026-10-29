# Mogging Moon in Solar Systems

The approved silver crescent Moon is available in Solar Systems under the code ID `mogging` and accessible name Mogging. It joins the shared library for day-score and Current vibes reactions, received badges/details, and profile pictures. Pickers keep their visual-only presentation. The approved artwork has the left arm removed, a trimmed right cheek, and the right eye fully inside the head.

The original transparent PNG and content-hashed 160px icon/320px portrait WebPs are included. Existing artwork is unchanged. Firestore allows `mogging` for appearances and both reaction types; the notification service derives its name from the shared registry. No database migration is needed.

Validation: 300 app checks passed, with the emulator-only check skipped in the ordinary run and passed separately against Firestore. All 12 backend checks passed. Disconnected browser QA exercised sending the new day/vibes reactions and saving the portrait; the picker and loaded Moon artwork fit a narrow phone viewport. Physical iPhone rendering was not tested. Publish the matching Worker, Firestore rules, Hosting, and source; preserve unrelated working-tree files.

