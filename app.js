// Core state and DOM element references
const DEFAULT_CONFIG_URL = 'config.json';
const DEFAULT_PEOPLE_URL = 'people.json';
const API_SCHEDULE_URL = '/api/schedule';

const elements = {
  scheduleGrid: null,
  summary: null,
  btnClearSchedule: null,
  btnAutoAllocate: null,
  btnPeopleView: null,
  btnScheduleView: null,
  btnCalendarView: null,
  programFilters: null,
  btnSaveSchedule: null,
  alert: null,
};

const state = {
  config: null,
  people: [],
  schedule: [],
  view: 'schedule',
  activeCategories: new Set(),
  programData: null,
};

const CAL_START_H = 9;
const CAL_START_MINS = CAL_START_H * 60;
const CAL_END_H = 29; // 05:00 next day
const PX_PER_MIN = 1.5;
const CAL_TOTAL_PX = (CAL_END_H - CAL_START_H) * 60 * PX_PER_MIN;

const SLOT_COLORS = {
  morning:   { bg: '#f9fafb', border: '#d1d5db', text: '#374151' },
  afternoon: { bg: '#f3f4f6', border: '#9ca3af', text: '#1f2937' },
  evening:   { bg: '#e5e7eb', border: '#6b7280', text: '#111827' },
  night:     { bg: '#d1d5db', border: '#4b5563', text: '#030712' },
};

const MUSIK_STAGE_COLORS = {
  Greenfield: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  Highland:   { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a8a' },
  Diorama:    { bg: '#bfdbfe', border: '#1d4ed8', text: '#1e3a8a' },
};

// Single source of truth: button color + event block styling per category
const CATEGORIES = {
  Musik:  { color: '#2563eb', bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' },
  Talks:  { color: '#d97706', bg: '#fef3c7', border: '#d97706', text: '#78350f' },
  Kunst:  { color: '#7c3aed', bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95' },
  Mad:    { color: '#dc2626', bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' },
  Events: { color: '#475569', bg: '#f1f5f9', border: '#475569', text: '#1e293b' },
};


// Initialize element references lazily
function initElements() {
  elements.scheduleGrid = document.getElementById('schedule-grid');
  elements.summary = document.getElementById('summary');
  elements.btnClearSchedule = document.getElementById('btn-clear-schedule');
  elements.btnAutoAllocate = document.getElementById('btn-auto-allocate');
  elements.btnPeopleView = document.getElementById('btn-people-view');
  elements.btnScheduleView = document.getElementById('btn-schedule-view');
  elements.btnCalendarView = document.getElementById('btn-tab-calendar');
  elements.programFilters = document.getElementById('program-filters');
  elements.btnSaveSchedule = document.getElementById('btn-save-schedule');
  elements.alert = document.getElementById('alert');
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function createEmptySchedule(config) {
  const schedule = [];
  for (const day of config.days) {
    for (const slot of day.timeslots) {
      schedule.push({ day: day.name, timeslot: slot.name, people: [] });
    }
  }
  return schedule;
}

function getSlot(dayName, slotName) {
  return state.schedule.find((s) => s.day === dayName && s.timeslot === slotName);
}

function getSlotConfig(dayName, slotName) {
  const day = state.config.days.find((d) => d.name === dayName);
  return day && day.timeslots.find((t) => t.name === slotName);
}

function saveScheduleToStorage() {
  try {
    localStorage.setItem('heartland-schedule', JSON.stringify(state.schedule));
  } catch (e) {
    // ignore storage errors
  }

  // Fire-and-forget remote save; do not block UI
  try {
    saveScheduleRemote(state.schedule).catch(() => {});
  } catch (e) {
    // ignore
  }
}


async function saveScheduleRemote(schedule) {
  try {
    await fetch(API_SCHEDULE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
    return true;
  } catch (e) {
    console.warn('Failed to save schedule remotely', e);
    return false;
  }
}

function loadScheduleFromStorage() {
  try {
    const raw = localStorage.getItem('heartland-schedule');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function loadScheduleRemote() {
  try {
    const res = await fetch(API_SCHEDULE_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  }
}

function isStoredScheduleCompatible(storedSchedule, config) {
  if (!Array.isArray(storedSchedule)) return false;
  const configSlots = new Set();
  for (const day of config.days) {
    if (!day || typeof day.name !== 'string' || !Array.isArray(day.timeslots)) return false;
    for (const slot of day.timeslots) {
      if (!slot || typeof slot.name !== 'string') return false;
      configSlots.add(`${day.name}||${slot.name}`);
    }
  }

  for (const slot of storedSchedule) {
    if (!slot || typeof slot.day !== 'string' || typeof slot.timeslot !== 'string' || !Array.isArray(slot.people)) return false;
    if (!configSlots.has(`${slot.day}||${slot.timeslot}`)) return false;
    for (const assignment of slot.people) {
      if (!assignment || typeof assignment.id !== 'string' || typeof assignment.locked !== 'boolean') return false;
    }
  }

  return storedSchedule.length === configSlots.size;
}

function setAlert(msg, isError = true) {
  initElements();
  if (!elements.alert) return;
  elements.alert.textContent = msg || '';
  elements.alert.style.display = msg ? 'block' : 'none';
  elements.alert.className = 'alert';
  if (msg) {
    if (isError) {
      elements.alert.classList.add('alert-error');
      elements.alert.style.color = '#991b1b';
    } else {
      elements.alert.classList.add('alert-success');
      elements.alert.style.color = '#166534';
    }
  } else {
    elements.alert.style.color = '';
  }
}

function shuffleArray(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function minutesFrom(hhmm) {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
}

function computeOverlaps(slotA, slotB) {
  if (!slotA || !slotB || !slotA.start || !slotA.end || !slotB.start || !slotB.end) return false;
  const aStart = minutesFrom(slotA.start);
  let aEnd = minutesFrom(slotA.end);
  const bStart = minutesFrom(slotB.start);
  let bEnd = minutesFrom(slotB.end);

  const rangesA = [];
  const rangesB = [];

  if (aEnd <= aStart) {
    rangesA.push([aStart, 24 * 60]);
    rangesA.push([0, aEnd]);
  } else {
    rangesA.push([aStart, aEnd]);
  }

  if (bEnd <= bStart) {
    rangesB.push([bStart, 24 * 60]);
    rangesB.push([0, bEnd]);
  } else {
    rangesB.push([bStart, bEnd]);
  }

  for (const [s1, e1] of rangesA) {
    for (const [s2, e2] of rangesB) {
      if (s1 < e2 && s2 < e1) return true;
    }
  }
  return false;
}

function canAssign(personId, dayName, slotName, schedule = state.schedule) {
  // enforce no duplicate in same slot
  const slot = schedule.find((s) => s.day === dayName && s.timeslot === slotName);
  if (!slot) return false;
  if (slot.people.some((p) => p.id === personId)) return false;

  // total assignments limit (2)
  const totalAssigned = schedule.reduce((s, sl) => s + (sl.people.some((p) => p.id === personId) ? 1 : 0), 0);
  if (totalAssigned >= 2) return false;

  // per-day assignments limit (1)
  const sameDayCount = schedule.reduce((s, sl) => s + ((sl.day === dayName && sl.people.some((p) => p.id === personId)) ? 1 : 0), 0);
  if (sameDayCount >= 1) return false;

  // overlapping times on same day
  const candidateConfig = getSlotConfig(dayName, slotName);
  for (const sl of schedule) {
    if (!sl.people.some((p) => p.id === personId)) continue;
    if (sl.day !== dayName) continue;
    const existingConfig = getSlotConfig(sl.day, sl.timeslot);
    if (computeOverlaps(existingConfig, candidateConfig)) return false;
  }

  return true;
}

function autoAllocate() {
  const attempts = 30;
  let bestSchedule = null;
  let bestOpen = Infinity;

  const lockedSlots = state.schedule.map((slot) => ({
    day: slot.day,
    timeslot: slot.timeslot,
    people: slot.people.filter((assignment) => assignment.locked).map((assignment) => ({ ...assignment })),
  }));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const workingSchedule = createEmptySchedule(state.config);
    for (const slot of lockedSlots) {
      const target = workingSchedule.find((s) => s.day === slot.day && s.timeslot === slot.timeslot);
      if (target) {
        target.people = slot.people.map((assignment) => ({ ...assignment }));
      }
    }

    const targets = shuffleArray(
      state.config.days.flatMap((day) =>
        day.timeslots.map((slot) => ({ day: day.name, timeslot: slot.name, required: slot.required }))
      )
    );

    for (const target of targets) {
      const scheduleSlot = workingSchedule.find((s) => s.day === target.day && s.timeslot === target.timeslot);
      const needed = target.required - scheduleSlot.people.length;
      if (needed <= 0) continue;

      const candidates = shuffleArray(state.people).filter((person) =>
        canAssign(person.id, target.day, target.timeslot, workingSchedule)
      );

      for (let i = 0; i < Math.min(needed, candidates.length); i += 1) {
        scheduleSlot.people.push({ id: candidates[i].id, locked: false });
      }
    }

    const open = workingSchedule.reduce((sum, slot) => {
      const cfg = getSlotConfig(slot.day, slot.timeslot);
      return sum + Math.max(0, cfg.required - slot.people.length);
    }, 0);

    if (open < bestOpen) {
      bestOpen = open;
      bestSchedule = workingSchedule;
      if (open === 0) break;
    }
  }

  if (bestSchedule) {
    state.schedule = bestSchedule;
  }
  saveScheduleToStorage();

  const remaining = [];
  for (const day of state.config.days) {
    for (const slot of day.timeslots) {
      const scheduleSlot = getSlot(day.name, slot.name);
      const missing = slot.required - scheduleSlot.people.length;
      if (missing > 0) remaining.push(`${day.name} ${slot.name}: ${missing} open`);
    }
  }

  if (remaining.length) {
    setAlert('Auto-allocation partial: ' + remaining.join('; '));
  } else {
    setAlert('Auto allocation completed.', false);
  }
  renderSchedule();
}

function buildSlotCard(day, slot) {
  const scheduleSlot = getSlot(day.name, slot.name);
  const slotCard = document.createElement('div');
  slotCard.className = 'slot-card';

  const meta = document.createElement('div');
  meta.className = 'slot-meta';
  const title = document.createElement('div');
  title.innerHTML = `<strong>${slot.name}</strong><div class="slot-time">${slot.start || ''}${slot.start && slot.end ? ' – ' + slot.end : ''}</div>`;
  const count = document.createElement('div');
  count.className = 'slot-required';
  count.textContent = `${scheduleSlot.people.length}/${slot.required}`;
  meta.appendChild(title);
  meta.appendChild(count);
  slotCard.appendChild(meta);

  const peopleList = document.createElement('div');
  peopleList.className = 'slot-people';
  if (scheduleSlot.people.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No people assigned yet.';
    peopleList.appendChild(empty);
  } else {
    for (const assignment of scheduleSlot.people) {
      const person = state.people.find((item) => item.id === assignment.id) || { name: 'Unknown' };
      const item = document.createElement('div');
      item.className = 'assignment';

      const name = document.createElement('span');
      name.textContent = person.name;
      item.appendChild(name);

      const actions = document.createElement('div');
      actions.className = 'assignment-actions';

      const lockButton = document.createElement('button');
      lockButton.type = 'button';
      lockButton.className = 'lock-toggle';
      lockButton.textContent = assignment.locked ? 'Unlock' : 'Lock';
      lockButton.addEventListener('click', () => toggleLock(day.name, slot.name, assignment.id));
      actions.appendChild(lockButton);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'remove';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => removePerson(day.name, slot.name, assignment.id));
      actions.appendChild(removeButton);

      item.appendChild(actions);
      peopleList.appendChild(item);
    }
  }
  slotCard.appendChild(peopleList);

  const select = document.createElement('select');
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Add person...';
  select.appendChild(emptyOption);
  for (const person of state.people) {
    const alreadyAssigned = scheduleSlot.people.some((assignment) => assignment.id === person.id);
    const option = document.createElement('option');
    option.value = person.id;
    option.textContent = person.name;
    if (alreadyAssigned || !canAssign(person.id, day.name, slot.name)) {
      option.disabled = true;
    }
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    if (!select.value) return;
    assignPerson(day.name, slot.name, select.value);
    select.value = '';
  });
  slotCard.appendChild(select);

  return slotCard;
}

function renderSchedule() {
  const days = state.config.days;
  const cols = `repeat(${days.length}, 1fr)`;
  const maxSlots = Math.max(...days.map(d => d.timeslots.length));

  const calendar = document.createElement('div');
  calendar.className = 'schedule-calendar';

  // Day header row
  const headerRow = document.createElement('div');
  headerRow.className = 'schedule-row';
  headerRow.style.gridTemplateColumns = cols;
  for (const day of days) {
    const dh = document.createElement('div');
    dh.className = 'day-header';
    dh.textContent = day.name;
    headerRow.appendChild(dh);
  }
  calendar.appendChild(headerRow);

  // One row per timeslot index so heights align across all days
  for (let i = 0; i < maxSlots; i++) {
    const slotRow = document.createElement('div');
    slotRow.className = 'schedule-row';
    slotRow.style.gridTemplateColumns = cols;
    for (const day of days) {
      const slot = day.timeslots[i];
      slotRow.appendChild(slot ? buildSlotCard(day, slot) : document.createElement('div'));
    }
    calendar.appendChild(slotRow);
  }

  elements.scheduleGrid.innerHTML = '';
  elements.scheduleGrid.appendChild(calendar);
  renderSummary();
}

function renderSummary() {
  const totalRequired = state.config.days.reduce((sum, day) => sum + day.timeslots.reduce((inner, slot) => inner + slot.required, 0), 0);
  const totalAssigned = state.schedule.reduce((sum, slot) => sum + slot.people.length, 0);
  const openSpots = state.schedule.reduce((sum, slot) => {
    const slotConfig = getSlotConfig(slot.day, slot.timeslot);
    return sum + Math.max(0, slotConfig.required - slot.people.length);
  }, 0);
  const assignedPeople = new Set(state.schedule.flatMap((slot) => slot.people.map((assignment) => assignment.id)));
  const unassignedCount = state.people.filter((person) => !assignedPeople.has(person.id)).length;

  // Check if there are enough people to fill all slots (max 2 total per person)
  const maxCapacity = state.people.length * 2;
  const capacityWarning = totalRequired > maxCapacity ? `<div class="summary-item" style="background: #fee2e2; border-color: #fca5a5;"><strong>⚠️ Not enough people</strong><br>Need ${totalRequired} positions, but max capacity is ${maxCapacity} (${state.people.length} people × 2 slots).</div>` : '';

  elements.summary.innerHTML = `
    ${capacityWarning}
    <div class="summary-item"><strong>Total required positions</strong><br>${totalRequired}</div>
    <div class="summary-item"><strong>Currently assigned</strong><br>${totalAssigned}</div>
    <div class="summary-item"><strong>Open spots</strong><br>${openSpots}</div>
    <div class="summary-item"><strong>Unassigned people</strong><br>${unassignedCount}</div>
  `;
}

function assignPerson(dayName, slotName, personId) {
  setAlert('');
  const scheduleSlot = getSlot(dayName, slotName);
  if (!scheduleSlot) return;
  const slotConfig = getSlotConfig(dayName, slotName);
  if (scheduleSlot.people.length >= slotConfig.required) {
    setAlert('This slot is already full.');
    return;
  }
  if (!canAssign(personId, dayName, slotName)) {
    setAlert('This assignment would create an overlapping timeslot conflict.');
    return;
  }
  if (scheduleSlot.people.some((assignment) => assignment.id === personId)) return;
  scheduleSlot.people.push({ id: personId, locked: false });
  saveScheduleToStorage();
  renderSchedule();
}

function removePerson(dayName, slotName, personId) {
  const scheduleSlot = getSlot(dayName, slotName);
  if (!scheduleSlot) return;
  scheduleSlot.people = scheduleSlot.people.filter((assignment) => assignment.id !== personId);
  saveScheduleToStorage();
  renderSchedule();
}

function toggleLock(dayName, slotName, personId) {
  const scheduleSlot = getSlot(dayName, slotName);
  if (!scheduleSlot) return;
  const assignment = scheduleSlot.people.find((item) => item.id === personId);
  if (!assignment) return;
  assignment.locked = !assignment.locked;
  saveScheduleToStorage();
  if (state.view === 'people') renderPeopleView();
  else if (state.view === 'calendar') renderCalendarView();
  else renderSchedule();
}

function clearSchedule() {
  for (const slot of state.schedule) {
    slot.people = slot.people.filter((assignment) => assignment.locked);
  }
  saveScheduleToStorage();
  setAlert('Unlocked assignments cleared. Locked assignments preserved.', false);
  renderSchedule();
}

function saveSchedule() {
  try {
    const exportObj = {
      exportedAt: new Date().toISOString(),
      config: state.config,
      people: state.people,
      schedule: state.schedule,
    };
    const data = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'heartland-schedule.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setAlert('Schedule exported as heartland-schedule.json.', false);
  } catch (e) {
    setAlert('Failed to export schedule: ' + (e && e.message ? e.message : String(e)));
  }
}

function validateConfig(config) {
  if (!config || !Array.isArray(config.days)) throw new Error('Config must be an object with a days array.');
  for (const day of config.days) {
    if (typeof day.name !== 'string') throw new Error('Each day needs a name.');
    if (!Array.isArray(day.timeslots)) throw new Error(`Day ${day.name} needs a timeslots array.`);
    for (const slot of day.timeslots) {
      if (typeof slot.name !== 'string') throw new Error(`Timeslot in ${day.name} needs a name.`);
      if (typeof slot.required !== 'number' || slot.required < 0) throw new Error(`Timeslot ${slot.name} in ${day.name} needs a numeric required count.`);
      if ((slot.start && !slot.end) || (!slot.start && slot.end)) {
        throw new Error(`Timeslot ${slot.name} must include both start and end or neither.`);
      }
    }
  }
}

async function loadDefaults() {
  const [config, people] = await Promise.all([
    fetchJson(DEFAULT_CONFIG_URL),
    fetchJson(DEFAULT_PEOPLE_URL),
  ]);
  state.config = config || getBundledConfig();
  if (!people || !Array.isArray(people) || people.length === 0) {
    setAlert('Unable to load people.json. Please ensure people.json exists and contains a valid array of people.');
    return;
  }
  state.people = people;
  
  // Try loading schedule from remote backend first, then fall back to localStorage
  const remote = await loadScheduleRemote();
  if (remote && isStoredScheduleCompatible(remote, state.config)) {
    state.schedule = remote;
  } else {
    const stored = loadScheduleFromStorage();
    if (stored && isStoredScheduleCompatible(stored, state.config)) {
      state.schedule = stored;
    } else {
      if (remote || stored) {
        setAlert('Saved schedule data did not match the current timeslot configuration and has been reset.', true);
      }
      state.schedule = createEmptySchedule(state.config);
    }
  }
  renderSchedule();
}

function getBundledConfig() {
  return {
    days: [
      {
        name: 'Thursday',
        timeslots: [
          { name: '08:00 – 12:00', required: 2, start: '08:00', end: '12:00' },
          { name: '12:00 – 16:00', required: 3, start: '12:00', end: '16:00' },
          { name: '16:00 – 20:00', required: 3, start: '16:00', end: '20:00' },
          { name: '20:00 – 24:00', required: 2, start: '20:00', end: '24:00' },
        ],
      },
      {
        name: 'Friday',
        timeslots: [
          { name: '08:00 – 12:00', required: 2, start: '08:00', end: '12:00' },
          { name: '12:00 – 16:00', required: 3, start: '12:00', end: '16:00' },
          { name: '16:00 – 20:00', required: 3, start: '16:00', end: '20:00' },
          { name: '20:00 – 24:00', required: 2, start: '20:00', end: '24:00' },
        ],
      },
      {
        name: 'Saturday',
        timeslots: [
          { name: '08:00 – 12:00', required: 2, start: '08:00', end: '12:00' },
          { name: '12:00 – 16:00', required: 3, start: '12:00', end: '16:00' },
          { name: '16:00 – 20:00', required: 3, start: '16:00', end: '20:00' },
          { name: '20:00 – 24:00', required: 2, start: '20:00', end: '24:00' },
        ],
      },
    ],
  };
}

function toAdjMins(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  let mins = h * 60 + m;
  if (mins < CAL_START_MINS) mins += 24 * 60;
  return mins;
}

function slotCategory(slotName, startTime) {
  const n = (slotName || '').toLowerCase();
  if (n.includes('formiddag')) return 'morning';
  if (n.includes('eftermiddag')) return 'afternoon';
  if (n.includes('aften')) return 'evening';
  if (n.includes('nat')) return 'night';
  if (startTime) {
    const h = parseInt(startTime.split(':')[0], 10);
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 22) return 'evening';
    return 'night';
  }
  return 'morning';
}

function formatPersonShort(person) {
  const parts = person.name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

function computeSlotLayout(slots) {
  const sorted = slots.slice().sort((a, b) => a.startMins - b.startMins);
  const colEnds = [];
  const result = [];
  for (const slot of sorted) {
    let col = -1;
    for (let i = 0; i < colEnds.length; i++) {
      if (slot.startMins >= colEnds[i]) { col = i; break; }
    }
    if (col === -1) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = slot.endMins;
    result.push({ ...slot, col });
  }
  return result.map(slot => {
    const concurrent = result.filter(o => o.startMins < slot.endMins && o.endMins > slot.startMins);
    const numCols = Math.max(...concurrent.map(s => s.col)) + 1;
    return { ...slot, numCols };
  });
}

async function updateProgramFilters() {
  if (!elements.programFilters) return;
  if (state.view !== 'calendar') {
    elements.programFilters.style.display = 'none';
    return;
  }
  if (!state.programData) {
    state.programData = await fetchJson('program.json');
  }
  elements.programFilters.style.display = 'flex';
  elements.programFilters.innerHTML = '';
  if (!state.programData) return;

  const label = document.createElement('span');
  label.className = 'filter-label';
  label.textContent = 'Program:';
  elements.programFilters.appendChild(label);

  const categories = [...new Set(state.programData.programme.map(a => a.category))];
  for (const cat of categories) {
    const color = (CATEGORIES[cat] || CATEGORIES.Events).color;
    const isActive = state.activeCategories.has(cat);
    const btn = document.createElement('button');
    btn.className = 'cat-filter-btn' + (isActive ? ' active' : '');
    btn.textContent = cat;
    if (isActive) btn.style.background = color;
    btn.addEventListener('click', () => {
      if (state.activeCategories.has(cat)) {
        state.activeCategories.delete(cat);
        btn.classList.remove('active');
        btn.style.background = '';
      } else {
        state.activeCategories.add(cat);
        btn.classList.add('active');
        btn.style.background = color;
      }
      renderCalendarView();
    });
    elements.programFilters.appendChild(btn);
  }
}

function renderCalendarView() {
  const DAY_KEY = { Torsdag: '18. juni', Fredag: '19. juni', Lørdag: '20. juni' };

  const container = document.createElement('div');
  container.className = 'cal-container';

  // Sticky header
  const headerRow = document.createElement('div');
  headerRow.className = 'cal-header-row';
  headerRow.appendChild(Object.assign(document.createElement('div'), { className: 'cal-gutter' }));
  for (const day of state.config.days) {
    const dh = document.createElement('div');
    dh.className = 'cal-day-header';
    dh.textContent = day.name;
    headerRow.appendChild(dh);
  }
  container.appendChild(headerRow);

  // Scrollable body
  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'cal-body-wrap';

  // Time gutter
  const gutter = document.createElement('div');
  gutter.className = 'cal-gutter cal-time-gutter';
  gutter.style.height = CAL_TOTAL_PX + 'px';
  for (let h = CAL_START_H; h <= CAL_END_H; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'cal-hour-label';
    lbl.style.top = ((h - CAL_START_H) * 60 * PX_PER_MIN) + 'px';
    lbl.textContent = String(h % 24).padStart(2, '0') + ':00';
    gutter.appendChild(lbl);
  }
  bodyWrap.appendChild(gutter);

  // Day columns
  for (const day of state.config.days) {
    const dayCol = document.createElement('div');
    dayCol.className = 'cal-day-col';
    dayCol.style.height = CAL_TOTAL_PX + 'px';

    for (let h = CAL_START_H; h <= CAL_END_H; h++) {
      const line = document.createElement('div');
      line.className = 'cal-hour-line';
      line.style.top = ((h - CAL_START_H) * 60 * PX_PER_MIN) + 'px';
      dayCol.appendChild(line);
    }

    const barSlotsData = day.timeslots
      .map(slot => ({
        name: slot.name,
        startMins: toAdjMins(slot.start),
        endMins: toAdjMins(slot.end),
        required: slot.required,
        schedSlot: getSlot(day.name, slot.name),
        category: slotCategory(slot.name, slot.start),
      }))
      .filter(s => s.startMins !== null && s.endMins !== null);

    const layoutSlots = computeSlotLayout(barSlotsData);
    const barPct = (state.activeCategories.size > 0 && state.programData) ? 52 : 100;

    for (const slot of layoutSlots) {
      const colors = SLOT_COLORS[slot.category];
      const y = (slot.startMins - CAL_START_MINS) * PX_PER_MIN;
      const slotH = (slot.endMins - slot.startMins) * PX_PER_MIN;
      const colW = barPct / slot.numCols;
      const colL = slot.col * colW;

      const block = document.createElement('div');
      block.className = 'cal-slot-block';
      block.style.cssText = `top:${y}px;height:${slotH}px;left:${colL}%;width:calc(${colW}% - 3px);background:${colors.bg};border-left:4px solid ${colors.border};color:${colors.text};`;

      const title = document.createElement('div');
      title.className = 'cal-slot-title';
      title.textContent = slot.name;
      block.appendChild(title);

      const peopleDiv = document.createElement('div');
      peopleDiv.className = 'cal-slot-people';
      if (slot.schedSlot && slot.schedSlot.people.length > 0) {
        for (const a of slot.schedSlot.people) {
          const person = state.people.find(p => p.id === a.id);
          if (!person) continue;
          const chip = document.createElement('span');
          chip.className = 'cal-person-chip' + (a.locked ? ' locked' : '');
          chip.textContent = formatPersonShort(person);
          peopleDiv.appendChild(chip);
        }
      } else {
        const empty = document.createElement('span');
        empty.className = 'cal-slot-empty';
        empty.textContent = `0 / ${slot.required}`;
        peopleDiv.appendChild(empty);
      }
      block.appendChild(peopleDiv);
      dayCol.appendChild(block);
    }

    // Program events (right section)
    if (state.activeCategories.size > 0 && state.programData) {
      const events = (state.programData.by_day[DAY_KEY[day.name]] || [])
        .filter(e => e.start && state.activeCategories.has(e.category));

      const progSection = document.createElement('div');
      progSection.className = 'cal-prog-section';
      progSection.style.left = barPct + '%';
      progSection.style.width = (100 - barPct) + '%';
      progSection.style.height = CAL_TOTAL_PX + 'px';

      const progSlots = events.map(e => ({
        ...e,
        startMins: toAdjMins(e.start),
        endMins: e.end ? toAdjMins(e.end) : toAdjMins(e.start) + 90,
      })).filter(e => e.startMins !== null);

      const progLayout = computeSlotLayout(progSlots);

      for (const ev of progLayout) {
        const y = (ev.startMins - CAL_START_MINS) * PX_PER_MIN;
        const evH = Math.max((ev.endMins - ev.startMins) * PX_PER_MIN, 22);
        const sc = ev.category === 'Musik'
          ? (MUSIK_STAGE_COLORS[ev.stage] || MUSIK_STAGE_COLORS.Diorama)
          : (CATEGORIES[ev.category] || CATEGORIES.Events);
        const colW = 100 / ev.numCols;
        const colL = ev.col * colW;

        const evBlock = document.createElement('div');
        evBlock.className = 'cal-prog-block';
        evBlock.style.cssText = `top:${y}px;height:${evH}px;left:${colL}%;width:calc(${colW}% - 2px);background:${sc.bg};border-left:3px solid ${sc.border};color:${sc.text};`;

        const evName = document.createElement('div');
        evName.className = 'cal-prog-name';
        evName.textContent = ev.name;
        evBlock.appendChild(evName);

        const evStage = document.createElement('div');
        evStage.className = 'cal-prog-stage';
        evStage.textContent = ev.stage;
        evBlock.appendChild(evStage);

        progSection.appendChild(evBlock);
      }
      dayCol.appendChild(progSection);
    }

    bodyWrap.appendChild(dayCol);
  }

  container.appendChild(bodyWrap);
  elements.scheduleGrid.innerHTML = '';
  elements.scheduleGrid.appendChild(container);
  elements.summary.innerHTML = '';
}

function toggleView(viewName) {
  state.view = viewName;

  const tabMap = [
    [elements.btnScheduleView, 'schedule'],
    [elements.btnPeopleView, 'people'],
    [elements.btnCalendarView, 'calendar'],
  ];
  for (const [btn, view] of tabMap) {
    if (btn) btn.classList.toggle('active', view === viewName);
  }

  updateProgramFilters();

  if (viewName === 'people') renderPeopleView();
  else if (viewName === 'calendar') renderCalendarView();
  else renderSchedule();
}

function renderPeopleView() {
  const container = document.createElement('div');
  container.className = 'people-list';

  for (const person of state.people) {
    const card = document.createElement('div');
    card.className = 'person-card';

    const title = document.createElement('div');
    title.className = 'person-name';
    title.textContent = person.name;
    card.appendChild(title);

    const assigned = state.schedule.flatMap((s) => s.people.filter((p) => p.id === person.id).map((p) => ({ day: s.day, timeslot: s.timeslot, locked: p.locked })));

    if (assigned.length === 0) {
      const none = document.createElement('div');
      none.className = 'person-none';
      none.textContent = 'No assignments';
      card.appendChild(none);
    } else {
      const list = document.createElement('ul');
      list.className = 'person-assignments';
      for (const a of assigned) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `${a.day} — ${a.timeslot}` + (a.locked ? ' (locked)' : '');
        li.appendChild(span);

        const btn = document.createElement('button');
        btn.className = 'lock-toggle';
        btn.style.marginLeft = '8px';
        btn.textContent = a.locked ? 'Unlock' : 'Lock';
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          toggleLock(a.day, a.timeslot, person.id);
        });
        li.appendChild(btn);

        list.appendChild(li);
      }
      card.appendChild(list);
    }

    container.appendChild(card);
  }

  elements.scheduleGrid.innerHTML = '';
  elements.scheduleGrid.appendChild(container);
  elements.summary.innerHTML = '';
}

function wireEvents() {
  initElements();
  elements.btnClearSchedule.addEventListener('click', clearSchedule);
  elements.btnAutoAllocate.addEventListener('click', autoAllocate);
  if (elements.btnScheduleView) elements.btnScheduleView.addEventListener('click', () => toggleView('schedule'));
  if (elements.btnPeopleView) elements.btnPeopleView.addEventListener('click', () => toggleView('people'));
  if (elements.btnCalendarView) elements.btnCalendarView.addEventListener('click', () => toggleView('calendar'));
  elements.btnSaveSchedule.addEventListener('click', saveSchedule);
}

window.addEventListener('DOMContentLoaded', async () => {
  wireEvents();
  await loadDefaults();
  toggleView(state.view);
});
