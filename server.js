const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname);
const CONFIG_PATH = path.join(__dirname, 'config.json');
const SCHEDULE_PATH = path.join(__dirname, 'schedule.json');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function createEmptyScheduleFromConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);
    const schedule = [];
    for (const day of cfg.days) {
      for (const slot of day.timeslots) {
        schedule.push({ day: day.name, timeslot: slot.name, people: [] });
      }
    }
    return schedule;
  } catch (e) {
    return null;
  }
}

app.get('/api/schedule', (req, res) => {
  if (fs.existsSync(SCHEDULE_PATH)) {
    try {
      const raw = fs.readFileSync(SCHEDULE_PATH, 'utf8');
      return res.json(JSON.parse(raw));
    } catch (e) {
      return res.status(500).json({ error: 'Failed to read schedule' });
    }
  }

  const empty = createEmptyScheduleFromConfig();
  if (empty) return res.json(empty);
  return res.status(404).json({ error: 'No schedule found' });
});

app.post('/api/schedule', (req, res) => {
  const payload = req.body;
  try {
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to save schedule' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
