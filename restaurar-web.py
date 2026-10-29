"""
Restaura la web de Cronulla al estado de hoy 27/09 a las 12:35 (antes de que se ordenara la
pestaña REPAIR 1 de Glide sin la columna ID), con las medidas de antes del pegado de las 12:19.

Uso (en la Terminal):  python3 restaurar-web.py
Antes de cambiar nada guarda una copia del estado actual en respaldo-antes-de-restaurar.json.
"""
import datetime
import json
import os
import urllib.request

URL = 'https://jawmcsrcgqvndjhhvovl.supabase.co/rest/v1'
KEY = 'sb_publishable_C5fy8k5sNRW0F5ZBsJDEDw_k8DRptZJ'
SCRATCH = '/private/tmp/claude-501/-Users-cesarmeneses-Desktop-Proyectos-CRONULLA-Inspection/fb4e6275-9c21-4d31-9ad5-ba9825a11c70/scratchpad'
BACKUP_1235 = os.path.join(SCRATCH, 'backup', 'defects-before-measure-restore.json')
BATCH_1219 = os.path.join(SCRATCH, 'batch-0219.json')
HERE = os.path.dirname(os.path.abspath(__file__))
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}


def get(path):
    return json.load(urllib.request.urlopen(urllib.request.Request(URL + path, headers=H)))


def post(path, body, prefer):
    req = urllib.request.Request(
        URL + path, data=json.dumps(body).encode(), method='POST',
        headers=dict(H, **{'Content-Type': 'application/json', 'Prefer': prefer}),
    )
    return urllib.request.urlopen(req).status


def all_rows():
    rows = []
    for off in range(0, 5000, 1000):
        page = get('/defects?select=id,position,data&order=id&offset=%d&limit=1000' % off)
        rows += page
        if len(page) < 1000:
            break
    return rows


# 1. Copia del estado actual, por si acaso.
current = all_rows()
with open(os.path.join(HERE, 'respaldo-antes-de-restaurar.json'), 'w') as f:
    json.dump(current, f)
print('Copia del estado actual guardada:', len(current), 'filas')

# 2. Estado correcto: web a las 12:35 + medidas de antes de las 12:19.
truth = {i: dict(d) for i, d in json.load(open(BACKUP_1235)).items()}
for h in json.load(open(BATCH_1219)):
    k = h['details'].get('key')
    if k and h['defect_id'] in truth:
        truth[h['defect_id']][k] = h['details']['from']

# 3. Restaurar.
now = datetime.datetime.utcnow().isoformat() + 'Z'
items = list(truth.items())
for i in range(0, len(items), 200):
    post('/defects', [{'id': k, 'data': v, 'client_id': 'data-fix', 'updated_at': now} for k, v in items[i:i + 200]],
         'resolution=merge-duplicates,return=minimal')
post('/defect_history', [{
    'user_name': 'Restauración 12:35', 'action': 'bulk', 'defect_id': None, 'row_no': None,
    'details': {'label': 'Web restaurada al estado de las 12:35 con medidas de antes de las 12:19',
                'added': 0, 'removed': 0, 'changed': len(items)},
}], 'return=minimal')

# 4. Comprobar.
after = {r['id']: r['data'] for r in all_rows()}
same = sum(1 for i in truth if json.dumps(after.get(i), sort_keys=True) == json.dumps(truth[i], sort_keys=True))
print('Filas restauradas correctamente:', same, 'de', len(truth))
