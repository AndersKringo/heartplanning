# Heartland Festival Bar Scheduler (Diorama Bar 2026)

A static single-page web app for scheduling bar volunteers into shifts across Thursday, Friday, and Saturday at the Heartland Festival. The tool is called "Diorama Bar Scheduler 2026" in the UI.

## Repository layout

```
├── index.html                        # SPA entry point
├── styles.css                        # Page styling
├── app.js                            # All scheduling logic, rendering, and export
├── config.json                       # Timeslot definitions and required headcounts
├── people.json                       # Full list of volunteers
├── heartland-schedule.json           # Example / saved full schedule (exported from the app)
├── heartland-schedule-one-per-day.json # Output from the one-per-day solver
└── tools/
    ├── solver_one_per_day.py         # Max-flow solver (Edmonds-Karp), one shift per person per day
    ├── check_schedule.py             # Validates heartland-schedule.json against all rules
    └── validate_one_per_day.py       # Validates heartland-schedule-one-per-day.json
```

## Data files

### `config.json`
Defines the days and timeslots. Each timeslot has a name, start/end time (HH:MM, 24 h), and `required` headcount.

```json
{
  "days": [
    {
      "name": "Torsdag",
      "timeslots": [
        { "name": "Torsdag Formiddag", "required": 3, "start": "10:00", "end": "16:00" },
        ...
      ]
    },
    ...
  ]
}
```

Current schedule: **Thursday, Friday, Saturday** — 4 slots each (Formiddag, Eftermiddag, Aften, Nat). Night slots cross midnight (end time < start time), which the overlap logic handles correctly.

If `config.json` cannot be fetched, the app falls back to a bundled English config (Thursday–Saturday, 4 × 2 h slots per day).

### `people.json`
Array of volunteer objects. Each person has a stable `id` (kebab-case slug) and a `name`.

```json
[
  { "id": "anders-kring", "name": "Anders Kring" },
  ...
]
```

Currently 27 people (including 2 TBD placeholders).

### Schedule JSON (exported / solver output)
The app exports, and the solvers produce, a schedule file with this shape:

```json
{
  "exportedAt": "<ISO timestamp or null>",
  "config": { ... },
  "people": [ ... ],
  "schedule": [
    {
      "day": "Torsdag",
      "timeslot": "Torsdag Formiddag",
      "people": [
        { "id": "anders-kring", "locked": false },
        ...
      ]
    },
    ...
  ]
}
```

`locked: true` means the assignment is pinned and will be preserved across auto-allocate and clear operations.

## Assignment rules (enforced by `app.js` and the validators)

| Rule | `app.js` | `check_schedule.py` | `validate_one_per_day.py` / solver |
|---|---|---|---|
| No duplicate in the same slot | yes | implied by capacity check | yes |
| Max **2 total** shifts per person across the whole festival | yes | yes | no (solver allows up to 1 per day × 3 days = 3) |
| Max **1 shift per person per day** | yes | checks >2 per day | yes (strictly 1) |
| No **overlapping timeslots** on the same day | yes | yes | yes |
| Slot must not exceed `required` headcount | yes | yes | yes |

> **Note:** `check_schedule.py` flags more than 2 assignments per day (not exactly 1), while the solver and `validate_one_per_day.py` enforce strictly 1 per day. The web app enforces max 1 per day and max 2 total.

## Web app features (`app.js`)

- **Schedule view** — columns per day, cards per slot showing assigned people, a dropdown to add anyone eligible, lock/remove buttons per assignment, and a live `assigned / required` counter.
- **People view** — one card per person showing their slots; lock/unlock from here too.
- **Auto-allocate** — runs 30 random-order attempts, each respecting locked assignments and all assignment rules, keeps the attempt with fewest unfilled spots.
- **Clear schedule** — removes all unlocked assignments, keeps locked ones.
- **Save schedule JSON** — downloads `heartland-schedule.json` containing config + people + schedule.
- **Persistence** — schedule is saved to `localStorage` on every change and restored on page load. If the stored schedule's slot structure does not match the current `config.json`, it is discarded and a warning is shown.
- **Summary panel** — shows total required positions, currently assigned, open spots, unassigned people, and a capacity warning if `people.length * 2 < total required`.

## Python tools (`tools/`)

All scripts must be run from the **repository root** (not from `tools/`), as they reference `config.json`, `people.json`, and schedule files by relative path.

### `tools/solver_one_per_day.py`
Uses Edmonds-Karp max-flow to find the maximum number of slots that can be filled under the constraint that each person works **at most one shift per day**. Writes `heartland-schedule-one-per-day.json`.

```bash
python tools/solver_one_per_day.py
```

### `tools/check_schedule.py`
Validates `heartland-schedule.json` (app export). Reports violations and open slots.

```bash
python tools/check_schedule.py
```

### `tools/validate_one_per_day.py`
Validates `heartland-schedule-one-per-day.json` (solver output) under the stricter one-per-day rule.

```bash
python tools/validate_one_per_day.py
```

## Hosting

Published on GitHub Pages — no build step required.

- Repository: `https://github.com/AndersKringo/heartplanning`
- Live site: `https://anderskringo.github.io/heartplanning/`

To run locally:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Troubleshooting

- **Schedule disappears on refresh** — ensure browser `localStorage` is enabled for the site.
- **Export does not start** — allow pop-ups for the site, or try a different browser.
- **Stored schedule discarded on load** — happens when `config.json` timeslot structure has changed since the schedule was saved. Clear local storage and start fresh.
- **Auto-allocate leaves open spots** — there may not be enough people to fill all slots given the constraints. Check the capacity warning in the summary panel (`people × 2` must be ≥ total required positions). Run `tools/solver_one_per_day.py` to see the theoretical maximum under one-per-day rules.
