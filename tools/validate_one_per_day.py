import json
from pathlib import Path

p = Path('heartland-schedule-one-per-day.json')
if not p.exists():
    print('Missing file:', p)
    raise SystemExit(1)

data = json.loads(p.read_text())
config = data['config']
people = [p['id'] for p in data['people']]
schedule = data['schedule']

def minutes(hhmm):
    h, m = map(int, hhmm.split(':'))
    return h*60 + m

def ranges_for(start, end):
    s = minutes(start); e = minutes(end)
    if e <= s:
        return [(s, 24*60), (0, e)]
    return [(s, e)]

def overlaps(a,b):
    if not a or not b or not a.get('start') or not a.get('end') or not b.get('start') or not b.get('end'):
        return False
    for ra in ranges_for(a['start'], a['end']):
        for rb in ranges_for(b['start'], b['end']):
            if ra[0] < rb[1] and rb[0] < ra[1]:
                return True
    return False

# map slot config
slot_map = {}
for day in config['days']:
    for s in day['timeslots']:
        slot_map[(day['name'], s['name'])] = s

assigns_by_person = {pid: [] for pid in people}
for s in schedule:
    cfg = slot_map.get((s['day'], s['timeslot']))
    for a in s['people']:
        assigns_by_person[a['id']].append({'day': s['day'], 'timeslot': s['timeslot'], 'config': cfg})

violations = []
for pid, assigns in assigns_by_person.items():
    # per-day <= 1
    byday = {}
    for a in assigns:
        byday[a['day']] = byday.get(a['day'], 0) + 1
    for day, cnt in byday.items():
        if cnt > 1:
            violations.append(f'Person {pid} has {cnt} assignments on {day} (>1)')
    # overlaps on same day
    for i in range(len(assigns)):
        for j in range(i+1, len(assigns)):
            a = assigns[i]; b = assigns[j]
            if a['day'] != b['day']: continue
            if overlaps(a['config'], b['config']):
                violations.append(f'Person {pid} has overlapping assignments on {a["day"]}: {a["timeslot"]} & {b["timeslot"]}')

# slot capacities
open_slots = []
for s in schedule:
    cfg = slot_map.get((s['day'], s['timeslot']))
    required = cfg['required'] if cfg else None
    assigned = len(s['people'])
    if required is not None and assigned > required:
        violations.append(f'Slot {s["day"]} {s["timeslot"]} assigned {assigned} > required {required}')
    if required is not None and assigned < required:
        open_slots.append((s['day'], s['timeslot'], required-assigned))

print('Total required:', sum(s['required'] for d in config['days'] for s in d['timeslots']))
print('Total assigned:', sum(len(s['people']) for s in schedule))
print('Open positions:', sum(s[2] for s in open_slots))
print('\nOpen slots:')
for s in open_slots:
    print(' -', s)

print('\nViolations:')
if violations:
    for v in violations:
        print(' -', v)
else:
    print(' None')

print('\nPer-person counts:')
for pid in people:
    print(f' - {pid}: {len(assigns_by_person.get(pid, []))}')
