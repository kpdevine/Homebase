# October 24 — numeric training targets and enabled Calendar modules

Settings → Training now uses typed number fields for each muscle group's weekly set goal. Fields require whole numbers from 0–20 and request a numeric phone keyboard. Existing settings saving, custom-group IDs, scoring and historical target behavior stay intact. The circular goal controls and their drag/keyboard bindings are removed from this Settings form.

Calendar category tabs follow the user's currently enabled modules from Settings → Change my tabs. Overall is always available. Disabled modules are hidden even when viewing older dates; their saved records remain available in Overall history. Newly enabled modules appear on the next render. If the selected category is disabled, Calendar switches to Overall before rendering its scores, recap and weight-graph action.

Verification: 236 regular checks passed; the emulator-only security test was skipped, with no Firestore rules changes in this release. Local 390px phone QA verified that entering 21 blocks saving, entering 15 saves and persists after reopening, disabled Nutrition/Sentiments/Prayer tabs disappear, enabled Sleep appears, and disabling the selected Training category resets to Overall. QA used only the isolated sample workspace. Physical iPhone keyboard behavior was not directly verified.

The user explicitly requested “Make and push.” Release source and these requirements together to GitHub and deploy the matching Firebase Hosting app. Existing reminder policy changes and unrelated preview artifacts are excluded.
