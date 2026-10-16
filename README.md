# Homebase

A personal performance dashboard for daily tasks, nutrition self-ratings, weekly gym progress, and historical review.

## Current decisions

- GitHub repository: https://github.com/kpdevine/Homebase
- Develop and preview locally. No deployment or cloud resources yet.
- Use sample information for the first interactive prototype.
- Explore a soft dark appearance, with legibility and interactions taking priority over visual refinement.
- Laptop and phone come first. Echo Show compatibility will be investigated later.

The repository URL above records the intended destination. It does not mean this local folder has been connected or pushed.

## Decisions still open

- Prototype implementation tools: plain HTML/CSS/JavaScript was discussed; confirm before application implementation.
- Database engine, cloud provider, data region, authentication, and synchronization.
- Scoring formula, category weights, week boundaries, and missing-score behavior.

## First milestone

1. Build and test the reusable circular score meter: scores 1–10, mouse and touch dragging, integer snapping, immediate feedback, accessible alternatives, and a matching read-only state.
2. Assemble a landscape dashboard and responsive phone layout with sample checklist items, nutrition scoring, a labeled sample overall score, muscle-group set progress, and calendar/history navigation.
3. Report tested behavior and limitations, then gather feedback before expanding scope.

No calories, food logs, device integrations, or real synchronization belong to this milestone.

## Data planning

See [the proposed data model](docs/data-design.md). This is a reviewable design proposal, not an implemented database or an approved technology choice.

Version control should hold application source, documentation, synthetic sample data, and eventual schema migrations. Personal records, database files, exports, and credentials should stay outside version control.

## Status

Planning only. No runnable application or automated tests have been created yet.
