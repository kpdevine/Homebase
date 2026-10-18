# Gym daily scoring and flexible rest

This policy replaces cumulative weekly pacing. It uses dated workouts and weekly muscle goals; the seven current muscle choices and historical combined Legs entries remain intact.

```
daily set target = sum of weekly muscle goals / 5
useful sets = today's sets that fill a muscle's remaining weekly goal
extra sets = today's remaining sets, including muscles with no goal
weighted sets = useful sets + extra sets * 0.25
workout score = min(10, weighted sets / daily set target * 10)
```

The denominator is fixed throughout each Monday–Sunday week. A previous shortfall does not reduce another day's score. Weekly goal sets remain capped per muscle and tracked separately from actual total sets. Daily scores show tenths, held below ten until the target is actually met. Same-day entries retain their saved order; dates, rather than entry-creation order, determine which day's sets get useful credit first.

For a 50-set week, the daily target is 10:

| Useful | Extra | Daily score |
| --- | --- | --- |
| 10 | 0 | 10 |
| 8 | 0 | 8 |
| 5 | 10 | 7.5 |
| 0 | 10 | 2.5 |
| 0 | 20 | 5 |
| 10 | 10 | 10 |

Each week starts with two flexible rest credits. Choosing **No** to Did you lift today? records rest immediately; advance planning is unnecessary. In date order, each logged rest day earns ten and uses one credit while credits remain. Subsequent rest days earn zero. After all weekly muscle goals are met, rest earns ten without consuming a credit, even when both credits have already been used. Rest is included in the daily average. A workout made entirely of extra sets still receives quarter credit and consumes no rest credit.

Unanswered dates stay unlogged and do not consume credits; selecting Yes without entering sets is also unfinished. Removing a workout's last set entry turns it into rest, reallocates credits, and reopens its review. Changing that rest back to a workout releases its credit. With every target set to zero, answered gym days remain unscored rather than dividing by zero. Existing planned/unplanned/unclassified rest records all participate in flexible rest without deleting or changing their saved legacy labels.

Progress is replayed from Monday through the selected date. Future workouts cannot upgrade earlier days or make an earlier zero-credit rest perfect. Backdated edits/deletions, rest changes, and target edits recalculate useful/extra classifications, daily scores, and rest usage for affected dates. When another day's gym score changes, its gym review and final completion reopen; other section reviews are preserved. Monday resets volume and credits, while targets inherit the latest saved configuration until edited. An explicit target change applies to its whole week and following weeks until the next change.

The gym panel shows useful sets, extra sets, weighted sets, the fixed target, credits remaining through the selected date, and weekly goal/actual totals. Individual logs show their useful/extra split. Suggestions rank unfinished muscles by the lowest completed fraction of their target through the selected date. Calendar rings, overview, final review, and recaps share this calculation. The small **i** beside Settings explains the policy in the app.

Set totals, classifications, scores, and rest credits are derived from saved targets, dated entries, and day records; no duplicate score counters are persisted. Backup format remains version 2. Firebase sync carries backdated review invalidations as normal changed daily records. Source and browser/Firebase personal data remain separate.

Browser verification used an isolated empty workspace: 8 chest sets Monday followed by 6 Tuesday against a 10-set chest goal yielded 2 useful + 4 extra = 3 weighted, scoring 3/10. Removing Tuesday's entry marked rest, Wednesday used the second credit, and Thursday scored zero. Completing the remaining weekly goals Friday made Saturday's rest score ten without spending a credit. Existing user records were untouched. Automated cases cover every proposed example, rest reset/goal completion, legacy rest, zero targets, reverse entry order, backdated deletions, and review invalidation.

## Target circles

Edit weekly targets opens one draggable circle for each active muscle, plus a circle for an existing legacy Legs goal. Circles snap to whole numbers 0–20; arrows and plus/minus adjust by one, Home selects zero, End selects 20. Changes remain a draft until Save; Discard restores the saved values. Zero removes that muscle from goal credit and suggestions while preserving logged sets. If every target is zero, answered gym days are excluded from the daily average. Old backups with targets above 20 still load unchanged; the editor identifies those saved values and presents a capped draft for explicit saving.

Target circles all use one neutral ink color. Their arc length represents the selected number; color does not imply that a higher set goal is better.
