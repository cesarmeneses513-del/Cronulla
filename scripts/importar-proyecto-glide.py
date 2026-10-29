"""
Carga un proyecto de los respaldos de Glide (CSV + fotos ya descargadas) como proyecto de solo
lectura en la web: crea el proyecto, sube sus fotos al almacenamiento de Supabase e inserta los
defectos. Requiere haber ejecutado supabase/projects.sql.

Uso (en la Terminal, dentro de la carpeta Inspection):
    python3 scripts/importar-proyecto-glide.py altitude            solo revisa, no cambia nada
    python3 scripts/importar-proyecto-glide.py altitude --aplicar  lo carga (pide la clave secreta)

Se puede volver a ejecutar: las fotos ya subidas no se suben otra vez y los defectos se
reemplazan por los del CSV.
"""
import csv, datetime, getpass, glob, json, mimetypes, os, re, sys, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP = os.path.join(HERE, '..', '..', 'respaldo-fotos-glide', 'por-pestaña')
URL = 'https://jawmcsrcgqvndjhhvovl.supabase.co'
BUCKET = 'inspection-photos'

# Each project: its tab in the backup, which CSV rows belong to it, and how its columns map.
PROJECTS = {
    'altitude': {
        'name': 'Altitude',
        'address': '37 Chandler St, Belconnen ACT 2617',
        'tab': 'ALTITUDE',
        # Two towers: the tower goes in front of the face as the "Stage" (HIGH-RISE NORTH…).
        'tower': lambda name: 'HIGH-RISE' if 'HIGH' in name.upper() else 'LOW-RISE',
    },
}

APPLY = '--aplicar' in sys.argv
pid = next((a for a in sys.argv[1:] if not a.startswith('--')), None)
if pid not in PROJECTS:
    sys.exit('Proyecto desconocido. Opciones: ' + ', '.join(PROJECTS))
P = PROJECTS[pid]
tab_dir = os.path.join(BACKUP, P['tab'])

rows = list(csv.DictReader(open(os.path.join(tab_dir, P['tab'] + '.csv'), encoding='utf-8-sig')))

# Local copies of the photos, by Glide file id (the part of the name after PHOTOn_).
local = {}
for f in glob.glob(os.path.join(tab_dir, '**', '*'), recursive=True):
    m = re.match(r'.*_PHOTO\d+_([A-Za-z0-9]+)\.\w+$', os.path.basename(f))
    if m and os.path.isfile(f):
        local[m.group(1)] = f
glide_id = lambda url: re.sub(r'\.\w+$', '', url.rstrip('/').rsplit('/', 1)[-1])

def num(v):
    v = (v or '').strip()
    try:
        f = float(v)
        return str(int(f)) if f == int(f) else str(f)
    except ValueError:
        return v

def level(v):
    v = (v or '').strip().upper()
    return {'GROUND': 'G', 'ROOF': 'R', 'LEVEL': ''}.get(v, num(v))

def when(serial):
    # Sheets dates are days since 30/12/1899 (local time on the phone).
    try:
        d = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=float(serial))
        return d.strftime('%d/%m/%Y'), d.strftime('%H:%M:%S')
    except (TypeError, ValueError):
        return '', ''

LEVEL_RANK = lambda l: -1 if l == 'G' else 100000 if l == 'R' else float(l) if re.match(r'^\d+(\.\d+)?$', l) else 50000

items, photos_needed, missing = [], [], []
for n, r in enumerate(rows):
    if not any((v or '').strip() for v in r.values()):
        continue
    face = (r.get('ORIENTATION') or '').strip().upper()
    face = '' if face == 'ORIENTATION' else face
    stage = (P['tower'](r.get('Name Project', '')) + ' ' + face).strip()
    date, time = when(r.get('DATE'))
    tech = (r.get('TECHNICIAN') or '').strip()
    photos = []
    for k in range(1, 10):
        u = (r.get('PHOTO %d' % k) or '').strip()
        if not u.startswith('http'):
            continue
        gid = glide_id(u)
        f = local.get(gid)
        if not f:
            missing.append((n + 2, k, u))
            continue
        ext = os.path.splitext(f)[1].lower()
        path = 'projects/%s/%s%s' % (pid, gid, ext)
        photos_needed.append((f, path))
        photos.append({'url': '%s/storage/v1/object/public/%s/%s' % (URL, BUCKET, path), 'phase': 'BEFORE', 'slot': len(photos) + 1,
                       **({'by': tech, 'date': date, 'time': time} if tech else {})})
    defect = (r.get('DEFECT') or '').strip().upper()
    # Each tower's first row is its orientation reference photo, not a defect.
    if (r.get('ORIENTATION') or '').strip().upper() == 'ORIENTATION' or (r.get('mapping') or '').strip().lower() == 'photo reference':
        defect = 'PHOTO REFERENCE'
    items.append({
        'id': '%s-%04d' % (pid, n + 1), 'rowNo': '', 'projectName': P['name'].upper(),
        'orientation': stage, 'defect': defect, 'urgency': 'LOW',
        'drop': num(r.get('DROPS')), 'level': level(r.get('LEVEL')),
        'photos': photos, 'status': 'BEFORE',
        'technicianStart': tech, 'date1stPhoto': date if photos else '', 'time1stPhoto': time if photos else '',
        'technicianDuring': '', 'dateDuring': '', 'timeDuring': '',
        'technicianCompleted': '', 'dateCompleted': '', 'timeCompleted': '',
        'mapping': (r.get('mapping') or '').strip(), 'comment': (r.get('COMMENT') or '').strip(),
        'baseM': num(r.get('Width')), 'heightM': num(r.get('Height')),
        'linearMeters': num(r.get('Linear Meters')), 'quantity': num(r.get('Units')), 'customTags': [],
    })

# Numbers 1, 2, 3… in Stage, Drop, Level order (as "Sort and renumber" does for Cronulla).
items.sort(key=lambda i: (i['orientation'] == '', i['orientation'], i['drop'] == '', float(i['drop']) if re.match(r'^\d+(\.\d+)?$', i['drop']) else 1e9, LEVEL_RANK(i['level'])))
for k, i in enumerate(items):
    i['rowNo'] = str(k + 1)

def count(f):
    c = {}
    for i in items:
        c[f(i)] = c.get(f(i), 0) + 1
    return dict(sorted(c.items(), key=lambda x: -x[1]))

print('Proyecto:', P['name'], '| defectos:', len(items), '| fotos:', len(photos_needed), '| fotos sin archivo local:', len(missing))
print('Stages:', count(lambda i: i['orientation']))
print('Tipos:', count(lambda i: i['defect'] or '(sin tipo)'))
print('Niveles:', count(lambda i: i['level']))
print('Técnicos:', count(lambda i: i['technicianStart'] or '(nadie)'))
print('Fechas:', count(lambda i: i['date1stPhoto'][3:] or '(sin fecha)'))
print('Ejemplo:', json.dumps(items[1], ensure_ascii=False)[:600])
for m in missing[:10]:
    print('  sin archivo: fila %d PHOTO %d %s' % m)
if not APPLY:
    sys.exit('\nNo se cambió nada. Para cargarlo: python3 scripts/importar-proyecto-glide.py %s --aplicar' % pid)

KEY = os.environ.get('SUPABASE_SECRET_KEY') or getpass.getpass('Clave secreta de Supabase: ').strip()
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}

def call(method, path, body=None, prefer=None, raw=None, ctype='application/json'):
    h = dict(H)
    if body is not None or raw is not None:
        h['Content-Type'] = ctype
    if prefer:
        h['Prefer'] = prefer
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(urllib.request.Request(URL + path, data=data, method=method, headers=h)) as res:
        t = res.read().decode()
        return json.loads(t) if t and 'json' in res.headers.get('Content-Type', '') else t

# 1. The project (viewing only).
cover = next((i['photos'][0]['url'] for i in items if i['defect'] == 'PHOTO REFERENCE' and i['photos']), items[0]['photos'][0]['url'] if items and items[0]['photos'] else '')
call('POST', '/rest/v1/projects', [{'id': pid, 'name': P['name'], 'address': P['address'], 'cover_url': cover, 'editable': False, 'position': 10}],
     'resolution=merge-duplicates,return=minimal')
print('Proyecto creado:', P['name'])

# 2. Photos (already uploaded ones are skipped).
done = 0
for f, path in photos_needed:
    ctype = mimetypes.guess_type(f)[0] or 'image/jpeg'
    try:
        call('POST', '/storage/v1/object/%s/%s' % (BUCKET, urllib.parse.quote(path)), raw=open(f, 'rb').read(), ctype=ctype)
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        if e.code not in (400, 409) or 'exist' not in msg.lower():
            sys.exit('Falló la subida de %s: %s %s' % (path, e.code, msg[:200]))
    done += 1
    if done % 50 == 0 or done == len(photos_needed):
        print('  fotos subidas %d de %d' % (done, len(photos_needed)))

# 3. Defects: replaced by the CSV's.
call('DELETE', '/rest/v1/defects?project_id=eq.%s' % pid, prefer='return=minimal')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
rows_out = [{'id': i['id'], 'position': k, 'data': i, 'project_id': pid, 'client_id': 'import', 'updated_at': now} for k, i in enumerate(items)]
for k in range(0, len(rows_out), 200):
    call('POST', '/rest/v1/defects', rows_out[k:k + 200], 'return=minimal')
back = call('GET', '/rest/v1/defects?select=id&project_id=eq.%s&limit=5000' % pid)
print('Defectos en la web para %s: %d (esperados %d)' % (P['name'], len(back), len(items)))
