"""
Recupera lo que Natalia Onate hizo hoy entre las 8:36 y las 10:58 (Brisbane) y se perdió con la
sobrescritura: las fotos y el cierre del #611 y sus 5 duplicados (Stage 2, Drop 14, Levels 10 a 6),
reconstruidos paso a paso desde el Historial.

Uso (en la Terminal, dentro de la carpeta Inspection):
    python3 recuperar-natalia-14-10.py             solo muestra lo que haría
    python3 recuperar-natalia-14-10.py --aplicar   lo hace (pide la clave secreta de Supabase)
"""
import json,sys,copy,datetime,urllib.request,urllib.parse,os,getpass
HERE=os.path.dirname(os.path.abspath(__file__)); APPLY='--aplicar' in sys.argv
hist=json.load(open(os.path.join(HERE,'recuperacion-natalia','historial-hoy.json'))); cur={r['id']:r for r in json.load(open(os.path.join(HERE,'recuperacion-natalia','defectos-antes.json')))}
ORIG='defect-new-1791930580570'
syd=lambda z:(datetime.datetime.fromisoformat(z[:19])+datetime.timedelta(hours=11))
PH=['BEFORE','IN PROGRESS','COMPLETED']
state={ORIG:copy.deepcopy(cur[ORIG]['data'])}
ids=[ORIG]
for r in hist:
    i=r['defect_id']
    if r['created_at']<'2026-10-13T23:00:00' or r['created_at']>'2026-10-14T00:58:00' or i is None: continue
    if i!=ORIG and i in cur: continue
    d=r['details']
    if r['action']=='add':
        src=r['row_no'].rsplit('-copia',1)[0]; srcid=[k for k in ids if state[k]['_no']==src][0] if src!='1385' else ORIG
        state[i]=copy.deepcopy(state[srcid]); state[i]['id']=i; state[i]['_no']=r['row_no']; ids.append(i); continue
    s=state[i]; s.setdefault('_no','1385')
    if r['action']=='photo_add':
        t=syd(r['created_at']); s['photos'].append({'url':d['url'],'phase':d['phase'],'by':r['user_name'],'date':t.strftime('%d/%m/%Y'),'time':t.strftime('%H:%M:%S')})
        if d['phase']=='IN PROGRESS': s.update(technicianDuring=r['user_name'],dateDuring=t.strftime('%d/%m/%Y'),timeDuring=t.strftime('%H:%M:%S'))
        if d['phase']=='COMPLETED': s.update(technicianCompleted=r['user_name'],dateCompleted=t.strftime('%d/%m/%Y'),timeCompleted=t.strftime('%H:%M:%S'))
    elif r['action']=='photo_remove': s['photos']=[p for p in s['photos'] if p['url']!=d['url']]
    elif r['action']=='edit':
        s[d['key']]=d['to']
        if d['key']=='dateCompleted' and not d['to']: s['timeCompleted']=''
state[ORIG]['_no']='1385'
for i in ids:
    s=state[i]; s['photos'].sort(key=lambda p:PH.index(p['phase']))
    n={ph:0 for ph in PH}
    for p in s['photos']: n[p['phase']]+=1; p['slot']=PH.index(p['phase'])*3+n[p['phase']]
    if s['photos']:
        ph=[p['phase'] for p in s['photos']]; exp='COMPLETED' if 'COMPLETED' in ph else 'IN PROGRESS' if 'IN PROGRESS' in ph else 'BEFORE'
        assert exp==s['status'],(i,exp,s['status'])
maxno=max(int(r['data']['rowNo']) for r in cur.values()); maxpos=max(r['position'] for r in cur.values())
for k,i in enumerate(ids[1:]): state[i]['rowNo']=str(maxno+1+k)
out={}
for i in ids:
    s={k:v for k,v in state[i].items() if k!='_no'}; out[i]=s
    print('%s #%s L%s %s %s lm=%r | fotos %s | durante %s %s %s | final %s %s %s'%('ACTUALIZAR' if i==ORIG else 'INSERTAR  ',s['rowNo'],s['level'],s['defect'],s['status'],s['linearMeters'],[(p['phase'][0],p['time']) for p in s['photos']],s['technicianDuring'],s['dateDuring'],s['timeDuring'],s['technicianCompleted'],s['dateCompleted'],s['timeCompleted']))
if not APPLY: sys.exit()
URL='https://jawmcsrcgqvndjhhvovl.supabase.co/rest/v1'; KEY=os.environ.get('SUPABASE_SECRET_KEY') or getpass.getpass('Clave secreta de Supabase: ').strip()
def call(m,p,b=None,prefer=None):
    hh={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'}
    if prefer: hh['Prefer']=prefer
    r=urllib.request.urlopen(urllib.request.Request(URL+p,data=None if b is None else json.dumps(b).encode(),method=m,headers=hh)); t=r.read().decode(); return json.loads(t) if t else None
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
res=call('PATCH','/defects?id=eq.%s&updated_at=eq.%s'%(ORIG,urllib.parse.quote(cur[ORIG]['updated_at'])),{'data':out[ORIG],'client_id':'data-fix','updated_at':now},'return=representation')
print('#611 actualizado' if res else '#611 NO (cambió mientras tanto)')
rows=[{'id':i,'position':maxpos+1+k,'data':out[i],'client_id':'data-fix','updated_at':now} for k,i in enumerate(ids[1:])]
exists=[i for i in ids[1:] if call('GET','/defects?select=id&id=eq.'+i)]
assert not exists, exists
call('POST','/defects',rows,'return=minimal'); print('insertados',len(rows))
call('POST','/defect_history',[{'user_name':'Restauración 14/10','action':'bulk','defect_id':None,'row_no':None,'details':{'label':'Recuperados los 5 duplicados de Natalia Onate y las fotos del #611','added':len(rows),'removed':0,'changed':1}}],'return=minimal')
back={r['id']:r['data'] for r in call('GET','/defects?select=id,data&id=in.(%s)'%','.join(ids))}
print('verificados', sum(back.get(i)==out[i] for i in ids),'de',len(ids))
