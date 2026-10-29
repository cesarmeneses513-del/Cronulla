"""
Devuelve la web de Cronulla al estado de la planilla de hoy 14/10 a las 8:36 (antes de que un
dispositivo sobrescribiera casi toda la base con una copia vieja a las 10:58).

El plan (restauracion-14-10-plan.json) sale de comparar esa copia de la planilla con la base:
qué defectos se corrigen, cuáles vuelven y cuáles se quitan otra vez.

Uso (en la Terminal, dentro de la carpeta Inspection):
    python3 restaurar-14-10.py             solo muestra lo que haría, no cambia nada
    python3 restaurar-14-10.py --aplicar   lo hace

Pide la clave secreta de Supabase (la misma guardada en los scripts de la planilla); no se guarda.
Antes de cambiar nada deja una copia del estado actual en respaldo-antes-de-restaurar-14-10.json.
No toca los defectos que cambiaron después de calcular el plan (hoy 11:50), ni los creados después.
"""
import datetime
import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

URL = 'https://jawmcsrcgqvndjhhvovl.supabase.co/rest/v1'
HERE = os.path.dirname(os.path.abspath(__file__))
APPLY = '--aplicar' in sys.argv

KEY = os.environ.get('SUPABASE_SECRET_KEY') or getpass.getpass('Clave secreta de Supabase: ').strip()
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}


def call(method, path, body=None, prefer=None):
    headers = dict(H)
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if prefer:
        headers['Prefer'] = prefer
    req = urllib.request.Request(URL + path, data=None if body is None else json.dumps(body).encode(), method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as res:
            text = res.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        sys.exit('Supabase respondió %d: %s' % (e.code, e.read().decode()[:400]))


def all_rows():
    rows = []
    for off in range(0, 10000, 1000):
        page = call('GET', '/defects?select=id,position,data,client_id,updated_at,modified_at,modified_by&order=id&offset=%d&limit=1000' % off)
        rows += page
        if len(page) < 1000:
            break
    return rows


plan = json.load(open(os.path.join(HERE, 'restauracion-14-10-plan.json')))
current = {r['id']: r for r in all_rows()}
same_instant = lambda a, b: a == b
untouched = lambda i: i in current and i in plan['snapshot'] and same_instant(current[i]['updated_at'], plan['snapshot'][i])
label = lambda i: '#%s' % current[i]['data'].get('rowNo', '?') if i in current else i

# Lo que cambió después de calcular el plan se deja como está.
updates = [i for i in plan['updates'] if untouched(i)]
skipped = [i for i in plan['updates'] if not untouched(i)]
deletes = [i for i in plan['deletes'] if untouched(i)]
skipped += [i for i in plan['deletes'] if i in current and not untouched(i)]
inserts = [r for r in plan['inserts'] if r['id'] not in current]
new_since = [i for i in current if i not in plan['snapshot']]

print('Defectos en la base ahora:', len(current))
print('  se corrigen:           ', len(updates))
print('  vuelven (se insertan): ', len(inserts))
print('  se quitan otra vez:    ', len(deletes))
print('  creados después del plan (no se tocan):', len(new_since), ' '.join(label(i) for i in new_since[:30]))
print('  cambiados después del plan (no se tocan):', len(skipped), ' '.join(label(i) for i in skipped[:30]))

if not APPLY:
    sys.exit('\nNo se cambió nada. Para aplicarlo: python3 restaurar-14-10.py --aplicar')

# 1. Copia del estado actual, por si acaso.
with open(os.path.join(HERE, 'respaldo-antes-de-restaurar-14-10.json'), 'w') as f:
    json.dump(list(current.values()), f)
print('\nCopia del estado actual guardada:', len(current), 'filas')

# 2. Corregir e insertar.
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
max_pos = max(r['position'] for r in current.values())
rows = [{'id': i, 'position': current[i]['position'], 'data': plan['updates'][i], 'client_id': 'data-fix', 'updated_at': now} for i in updates]
rows += [{'id': r['id'], 'position': max_pos + 1 + k, 'data': r['data'], 'client_id': 'data-fix', 'updated_at': now} for k, r in enumerate(inserts)]
for i in range(0, len(rows), 100):
    call('POST', '/defects', rows[i:i + 100], 'resolution=merge-duplicates,return=minimal')
    print('  escritos', min(i + 100, len(rows)), 'de', len(rows))

# 3. Quitar los que habían sido borrados y volvieron con la copia vieja.
for i in range(0, len(deletes), 50):
    ids = ','.join('"%s"' % x for x in deletes[i:i + 50])
    call('DELETE', '/defects?id=in.(%s)' % urllib.parse.quote(ids), prefer='return=minimal')

call('POST', '/defect_history', [{
    'user_name': 'Restauración 14/10', 'action': 'bulk', 'defect_id': None, 'row_no': None,
    'details': {'label': 'Web restaurada al estado de la planilla del 14/10 a las 8:36',
                'added': len(inserts), 'removed': len(deletes), 'changed': len(updates)},
}], 'return=minimal')

# 4. Comprobar.
after = {r['id']: r['data'] for r in all_rows()}
wrong = [i for i in updates if after.get(i) != plan['updates'][i]]
wrong += [r['id'] for r in inserts if after.get(r['id']) != r['data']]
wrong += [i for i in deletes if i in after]
print('\nDefectos en la base después:', len(after))
print('Sin aplicar correctamente:', len(wrong), wrong[:20])
