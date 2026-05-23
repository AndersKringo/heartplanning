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
This app is static and can be hosted from Dropbox or any static site host. Place the files in the same folder and open `index.html` from the host.

## Notes
- Use the config file to change timeslot names, required counts, and time ranges.
- Use the people file to supply the actual staff list.
- On browsers with native file system support, you can also import/export data directly.
