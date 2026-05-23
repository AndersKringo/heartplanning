import json
from pathlib import Path
from collections import deque

# Simple Edmonds-Karp max flow
class MaxFlow:
    def __init__(self):
        self.adj = {}
        self.cap = {}

    def add_edge(self,u,v,c):
        if u not in self.adj: self.adj[u]=[]
        if v not in self.adj: self.adj[v]=[]
        self.adj[u].append(v)
        self.adj[v].append(u)
        self.cap[(u,v)] = self.cap.get((u,v),0)+c
        self.cap.setdefault((v,u),0)

    def bfs(self,s,t,parent):
        for node in self.adj: parent[node] = None
        q = deque([s]); parent[s] = s
        while q:
            u = q.popleft()
            for v in self.adj.get(u,[]):
                if parent.get(v) is None and self.cap.get((u,v),0) > 0:
                    parent[v] = u
                    if v == t: return True
                    q.append(v)
        return False

    def maxflow(self,s,t):
        flow = 0
        parent = {}
        while self.bfs(s,t,parent):
            # find bottleneck
            v = t
            bottleneck = float('inf')
            while v != s:
                u = parent[v]
                bottleneck = min(bottleneck, self.cap.get((u,v),0))
                v = u
            # apply
            v = t
            while v != s:
                u = parent[v]
                self.cap[(u,v)] -= bottleneck
                self.cap[(v,u)] = self.cap.get((v,u),0) + bottleneck
                v = u
            flow += bottleneck
        return flow

# Load inputs
p_config = Path('config.json')
p_people = Path('people.json')
if not p_config.exists() or not p_people.exists():
    print('config.json or people.json missing')
    raise SystemExit(1)

config = json.loads(p_config.read_text())
people = json.loads(p_people.read_text())

# build slot list
slots = []
slot_idx = {}
for day in config['days']:
    for slot in day['timeslots']:
        key = (day['name'], slot['name'])
        idx = len(slots)
        slots.append({'day': day['name'], 'name': slot['name'], 'required': slot['required'], 'start': slot.get('start'), 'end': slot.get('end')})
        slot_idx[key] = idx

# person-day nodes
person_day_nodes = []
pd_index = {}
for p in people:
    for day in [d['name'] for d in config['days']]:
        node = f'pd:{p["id"]}:{day}'
        pd_index[(p['id'], day)] = node
        person_day_nodes.append(node)

# build flow network
mf = MaxFlow()
S = 'S'
T = 'T'
# edges S -> person-day (cap 1)
for node in person_day_nodes:
    mf.add_edge(S, node, 1)
# edges slot -> T (cap required)
for i,slot in enumerate(slots):
    snode = f'slot:{i}'
    mf.add_edge(snode, T, slot['required'])
# edges person-day -> slot for same day
for p in people:
    pid = p['id']
    for i,slot in enumerate(slots):
        if slot['day'] == pd_index.get((pid, slot['day']), '').split(':')[-1]:
            # allow assignment
            pf = pd_index[(pid, slot['day'])]
            sf = f'slot:{i}'
            mf.add_edge(pf, sf, 1)

# compute max flow
flow = mf.maxflow(S, T)
print('flow:', flow, 'of', sum(s['required'] for s in slots))

# extract assignments from residual graph (edges from pd -> slot where cap decreased)
assignments = { (s['day'], s['name']): [] for s in slots }
for (u,v), cap in mf.cap.items():
    if u.startswith('pd:') and v.startswith('slot:'):
        # original cap was 1; if cap==0 then used
        if cap == 0:
            # u = 'pd:pid:day'
            parts = u.split(':')
            pid = parts[1]
            slot_i = int(v.split(':')[1])
            slot = slots[slot_i]
            assignments[(slot['day'], slot['name'])].append(pid)

# build schedule structure
schedule = []
for s in slots:
    key = (s['day'], s['name'])
    schedule.append({'day': s['day'], 'timeslot': s['name'], 'people': [{'id': pid, 'locked': False} for pid in assignments[key]]})

out = {
    'exportedAt': None,
    'config': config,
    'people': people,
    'schedule': schedule
}
Path('heartland-schedule-one-per-day.json').write_text(json.dumps(out, indent=2))
print('wrote heartland-schedule-one-per-day.json')
