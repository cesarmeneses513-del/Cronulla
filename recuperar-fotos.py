"""
Recupera las 35 fotos que se subieron y se perdieron por el error de sincronización
(listadas en fotos-perdidas.json). Cada una vuelve a su defecto con su fase; no cambia nada más.
Antes guarda una copia de esos defectos en respaldo-antes-de-recuperar-fotos.json.

Uso (en la Terminal, dentro de la carpeta del proyecto):  python3 recuperar-fotos.py
"""
import collections
import datetime
import json
import os
import urllib.parse
import urllib.request

URL = 'https://jawmcsrcgqvndjhhvovl.supabase.co/rest/v1'
KEY = 'sb_publishable_C5fy8k5sNRW0F5ZBsJDEDw_k8DRptZJ'
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}
HERE = os.path.dirname(os.path.abspath(__file__))
RANK = {'BEFORE': 0, 'IN PROGRESS': 1, 'COMPLETED': 2}


def req(method, path, body=None, prefer=None):
    headers = dict(H)
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if prefer:
        headers['Prefer'] = prefer
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.urlopen(urllib.request.Request(URL + path, data=data, method=method, headers=headers))
    text = r.read()
    return json.loads(text) if text else None


def row(defect_id):
    return req('GET', '/defects?select=id,data&id=eq.' + urllib.parse.quote(defect_id))[0]['data']


lost = json.load(open(os.path.join(HERE, 'fotos-perdidas.json')))
by_defect = collections.defaultdict(list)
for photo in lost:
    by_defect[photo['defect_id']].append(photo)

# 1. Copia de los defectos afectados, por si acaso.
backup = {defect_id: row(defect_id) for defect_id in by_defect}
with open(os.path.join(HERE, 'respaldo-antes-de-recuperar-fotos.json'), 'w') as f:
    json.dump(backup, f)
print('Copia guardada de', len(backup), 'defectos')

# 2. Devolver cada foto a su defecto (las que ya estén no se repiten), en orden Before → During → After.
now = datetime.datetime.utcnow().isoformat() + 'Z'
history = []
added = 0
for defect_id, photos_lost in by_defect.items():
    data = json.loads(json.dumps(backup[defect_id]))
    photos = [p if isinstance(p, dict) else {'url': p, 'phase': 'BEFORE'} for p in data['photos']]
    have = {p['url'] for p in photos}
    for p in sorted(photos_lost, key=lambda p: p['at']):
        if p['url'] in have:
            continue
        photos.append({'url': p['url'], 'phase': p['phase'], 'slot': len(photos) + 1})
        have.add(p['url'])
        added += 1
        history.append({
            'user_name': 'Recuperación fotos', 'action': 'photo_add', 'defect_id': defect_id,
            'row_no': data.get('rowNo'),
            'details': {'phase': p['phase'], 'url': p['url'],
                        'note': 'foto subida por %s y perdida por el error de sincronización' % p['user']},
        })
    data['photos'] = [p for _, p in sorted(enumerate(photos), key=lambda x: (RANK.get(x[1]['phase'], 0), x[0]))]
    req('PATCH', '/defects?id=eq.' + urllib.parse.quote(defect_id),
        {'data': data, 'client_id': 'data-fix', 'updated_at': now}, 'return=minimal')
if history:
    req('POST', '/defect_history', history, 'return=minimal')

# 3. Comprobar.
ok = 0
for defect_id, photos_lost in by_defect.items():
    urls = {p['url'] if isinstance(p, dict) else p for p in row(defect_id)['photos']}
    ok += sum(1 for p in photos_lost if p['url'] in urls)
print('Fotos agregadas:', added, '| presentes ahora en su defecto:', ok, 'de', len(lost))
