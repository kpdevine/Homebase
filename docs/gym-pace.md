# Gym scoring and rest

The owner chose **strict 10/day pacing for a 70-set week** on October 17, 2026. Gym asks “Did you lift today?” with Yes/No. No requires Planned rest or Unplanned rest before review. Yes requires a dated set entry. Existing rest entries remain planned rest.

For the selected date, Monday is day 1 and Sunday day 7:

```
credited sets = sum over muscles of min(sets through selected date, muscle target)
pace target = sum of muscle targets × day number / 7
gym score = min(10, credited sets / pace target × 10)
```

Scores display one decimal. Values below the pace target are held below 10 even when rounding would reach 10. Actual set totals include every logged set, including extra and untargeted sets. Goal credit does not include those extras. Monday begins a new set total; targets carry forward.

| Example for a 70-set goal | Gym score |
| --- | --- |
| 10 credited sets by Monday | 10 |
| 20 by Monday, unplanned rest Tuesday | 10 on Tuesday |
| 14 by Tuesday, unplanned rest Tuesday | 7 on Tuesday |
| 10 by Tuesday, plus 15 extra sets on an already completed muscle | 5 on Tuesday |
| Planned rest | Excluded from daily average |
| Unplanned rest with no weekly credit | 0 |
| No answer / unclassified rest / Yes without sets | Unlogged |

Planned rest counts as a required check-in and can be reviewed/completed without adding a scored component. The remaining entered categories are averaged equally. Sentiments remains optional and joins that average only with a rating.

Scores use entries dated Monday through the selected date. Later workouts cannot rewrite earlier scores. Backdated additions/removals can change later scores in that week, reopening their gym review and final completion when the score changes. Target edits likewise reopen affected gym reviews when scores change. Other section reviews stay confirmed.

Saved muscle targets repeat until edited. Editing applies from the selected Monday until the next explicit saved target change; earlier weeks are preserved. Weeks with no saved target history use the visible defaults. Legacy combined Legs goals and logs remain supported; untargeted new groups remain logged without credit until their targets are set. JSON backup version 2 preserves rest choices and dated target changes; older checkpoints may not understand new rest states.

The suggestion box ranks unfinished muscles by the lowest completed fraction of their target through the selected date, breaking ties by remaining sets. Completed muscles disappear from suggestions. The weekly panel shows the whole week's volume; the day score and suggestions show progress only through the selected date.

The small **i** beside Settings opens the full scoring explanation. Calendar daily/weekly/monthly rings, overview, final review, and recaps share the same calculation. Browser records stay local and out of Git.

The weekly panel has separate Goal sets (credited / target) and Total sets (all actual sets) counters. The selected day also shows both totals through that date. Extra sets increase only Total sets after that muscle target is met.

## Target circles

Edit weekly targets opens one draggable circle for each active muscle, plus a circle for an existing legacy Legs goal. Circles snap to whole numbers 0–20; arrows and plus/minus adjust by one, Home selects zero, End selects 20. Changes remain a draft until Save; Discard restores the saved values. Zero removes that muscle from goal credit and suggestions while preserving logged sets. If every target is zero, answered gym days are excluded from the daily average. Old backups with targets above 20 still load unchanged; the editor identifies those saved values and presents a capped draft for explicit saving.

Target circles all use one neutral ink color. Their arc length represents the selected number; color does not imply that a higher set goal is better.
