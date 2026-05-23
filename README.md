# Heartland Festival Bar Scheduler

A static single-page app for assigning people to bar timeslots over Thursday, Friday, and Saturday.

## Files
- `index.html` — the SPA entry point
- `styles.css` — page styling
- `app.js` — scheduling logic, data loading, and export
- `config.json` — default days/timeslots and required counts
- `people.json` — default people list

## How it works
- The page loads default `config.json` and `people.json` automatically.
- You can import your own `config.json`, `people.json`, or a saved schedule file.
- The schedule starts empty and enforces overlapping-time rules.
- Save the current schedule as JSON using the export button.

## Hosting
This application is published on GitHub Pages and does not require a build step.

- Repository: `https://github.com/AndersKringo/heartplanning`
- Live site: `https://anderskringo.github.io/heartplanning/`

To host locally for testing:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

## Usage
- Use the schedule view to assign people to the bar slots for Thursday, Friday, and Saturday.
- Click `People view` to see each person and the slots they are assigned to.
- In People view, lock/unlock buttons let you preserve specific assignments before auto-allocating.
- Use `Auto-allocate` to fill remaining slots with random eligible people while keeping locked assignments.
- Use `Clear schedule` to remove all unlocked assignments but keep locked ones in place.

## Troubleshooting
- If the schedule does not appear after refreshing, make sure browser local storage is enabled for the site.
- If export does not start, check that pop-ups are allowed or use a different browser.
- To recover from a bad schedule, clear the page data or use a fresh browser tab and reload.

## Notes
- Use the config file to change timeslot names, required counts, and time ranges.
- Use the people file to supply the actual staff list.
- The schedule is saved locally in browser storage and can be exported as JSON.
