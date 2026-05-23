import json
from pathlib import Path

p = Path('heartland-schedule.json')
if not p.exists():
    print('heartland-schedule.json not found')
    raise SystemExit(1)

data = json.loads(p.read_text())
config = data['config']
people = data['people']
schedule = data['schedule']

# helper
def minutes(hhmm):
    h,m = map(int, hhmm.split(':'))
    return h*60 + m

def ranges_for(start, end):
    s = minutes(start); e = minutes(end)
    if e <= s:
        return [(s, 24*60), (0, e)]
    return [(s,e)]

def overlaps(a,b):
    if not a.get('start') or not a.get('end') or not b.get('start') or not b.get('end'):
        return False
    for ra in ranges_for(a['start'], a['end']):
        for rb in ranges_for(b['start'], b['end']):
            if ra[0] < rb[1] and rb[0] < ra[1]:
                return True
    return False

# Build mapping for convenience
people_ids = [p['id'] for p in people]
assignments_by_person = {pid: [] for pid in people_ids}
slot_config_map = {}
for day in config['days']:
    for slot in day['timeslots']:
        slot_config_map[(day['name'], slot['name'])] = slot

for slot in schedule:
    key = (slot['day'], slot['timeslot'])
    for a in slot['people']:
        assignments_by_person[a['id']].append({'day': slot['day'], 'timeslot': slot['timeslot'], 'locked': a.get('locked', False), 'config': slot_config_map.get(key)})

violations = []
# Check per-person rules
for pid, assigns in assignments_by_person.items():
    total = len(assigns)
    if total > 2:
        violations.append(f'Person {pid} has {total} total assignments (>2)')
    # per-day
    byday = {}
    for a in assigns:
        byday.setdefault(a['day'], 0)
        byday[a['day']] += 1
    for day, cnt in byday.items():
        if cnt > 2:
            violations.append(f'Person {pid} has {cnt} assignments on {day} (>2)')
    # overlaps on same day
    for i in range(len(assigns)):
        for j in range(i+1, len(assigns)):
            a = assigns[i]; b = assigns[j]
            if a['day'] != b['day']: continue
            if overlaps(a['config'], b['config']):
                violations.append(f'Person {pid} has overlapping assignments on {a["day"]}: {a["timeslot"]} & {b["timeslot"]}')

# Check slot capacities & collect open slots
open_slots = []
for slot in schedule:
    cfg = slot_config_map.get((slot['day'], slot['timeslot']))
    required = cfg['required'] if cfg else None
    assigned = len(slot['people'])
    if required is not None and assigned > required:
        violations.append(f'Slot {slot["day"]} {slot["timeslot"]} assigned {assigned} > required {required}')
    if required is not None and assigned < required:
        open_slots.append((slot['day'], slot['timeslot'], required-assigned))

# Summary
total_required = sum(s['required'] for d in config['days'] for s in d['timeslots'])
total_assigned = sum(len(s['people']) for s in schedule)

print('Total required positions:', total_required)
print('Total assigned positions:', total_assigned)
print('Open positions count:', total_required - total_assigned)
print('\nOpen slots:')
for s in open_slots:
    print(f' - {s[0]} {s[1]}: {s[2]} open')

print('\nViolations:')
if violations:
    for v in violations:
        print(' -', v)
else:
    print(' None')

# Print per-person assignment counts for inspection
print('\nPer-person assignment counts:')
for pid in people_ids:
    print(f' - {pid}: {len(assignments_by_person.get(pid, []))}')
