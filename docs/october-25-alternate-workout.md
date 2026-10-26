# Alternate workouts — October 25

After choosing **No** for lifting in Training, **Log an alternate workout** opens a description field. Save a nonblank description of up to 1,000 characters to replace that date's rest classification with an alternate workout. The score is exactly **5 + the tracked creatine point** (5 without a taken dose, 6 with it). Turning creatine tracking off leaves 5 points. Zero weekly set targets do not exclude the alternate score.

Alternate workouts use no flex rest credit and contribute no lifting sets or minutes toward weekly goals. Switching a rest day to an alternate workout replays that week, returns its flex credit, and reopens later reviews whose scores change. Description edits reopen the date's Training review. **Use a flex day instead** restores ordinary rest behavior; **Yes** restores paused lifting entries with their original IDs. The previous alternate description is retained for reuse but appears in recaps only while the alternate classification is active.

The description is part of the existing private day record, backup validation, and cloud round trip. General and Training-filtered recaps display escaped text. Solar Systems continue to receive only their existing shared score/review fields. No Firestore rule changes are required.

Validation: 262 regular tests, 261 passed and one emulator-only skip. Four new tests cover exact scoring with/without creatine and goals, weekly credit replay, review invalidation, recap data, backup/cloud restoration, paused set identity, malformed descriptions, and archived-day protection. Browser checks used separate local sample records: 5/6 point toggle, returned rest credit, blank-description error, reload persistence, Training review confirmation, rest fallback, and a 390px phone layout without horizontal overflow.

Publish matching source to `codex/homebase-prototype` and Firebase Hosting project `homebase-d3c6c`.
