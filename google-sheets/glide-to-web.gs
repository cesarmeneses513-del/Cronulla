/**
 * Glide sheet ("Report of Building CPR 2026") → Cronulla web app. One way.
 *
 * Paste into THAT spreadsheet's Extensions → Apps Script, then run `setup` once.
 *
 * Every minute it compares the CRONULLA tab with what it saw last time and sends only what
 * changed to Supabase: new photos, status, technicians, dates, comments, new rows, deleted rows.
 * The web app updates live, and the "Cronulla vs Code" sheet (sync.gs) then fills itself.
 * Nothing is ever written back here except the ID of new rows.
 *
 * Only changes are sent, so edits made in the web app are not overwritten unless the same
 * cell changes here afterwards. The first run just takes a baseline (and adds rows the web
 * app doesn't have yet).
 *
 * Glide writes through its API, which does not fire edit triggers; that's why this polls.
 */

const SUPABASE_URL = 'https://jawmcsrcgqvndjhhvovl.supabase.co';
// Publishable key: the same key the web app ships to browsers.
const SUPABASE_KEY = 'sb_publishable_C5fy8k5sNRW0F5ZBsJDEDw_k8DRptZJ';

// Tab to read: the gid from the sheet's URL (#gid=...). If that tab doesn't look like the
// defects tab, the first tab with ID, DEFECT and PHOTO 1 columns is used instead.
const SHEET_GID = 1503721441;

const CLIENT_ID = 'glide-sheet';
const ID_HEADER = 'ID';
// Hidden helper tabs: last seen content of every row, and rows deleted from the web app.
const SNAPSHOT_SHEET = '_web_sync';
const TRASH_SHEET = '_web_papelera';
// More rows than this disappearing at once is treated as a mistake (filter, bad paste) and ignored.
const MAX_DELETES_PER_RUN = 15;

// Sheet header (trimmed, upper-case) → web field, and the label used in the web's history.
const FIELDS = {
  'NO': ['rowNo', 'Nº fila'],
  'NAME PROYECT': ['projectName', 'Proyecto'],
  'ORIENTATION': ['orientation', 'Stage'],
  'DEFECT': ['defect', 'Defecto'],
  'URGENCY': ['urgency', 'Urgencia'],
  'DROP': ['drop', 'Drop'],
  'LEVEL': ['level', 'Nivel'],
  'STATUS': ['status', 'Estado'],
  'TECHNICIAN START': ['technicianStart', 'Técnico inicio'],
  'DATE 1ST PHOTO': ['date1stPhoto', 'Fecha inicio'],
  'TIME 1ST PHOTO': ['time1stPhoto', 'Hora'],
  'TECHNICIAN COMPLETED': ['technicianCompleted', 'Técnico final'],
  'DATE COMPLETED': ['dateCompleted', 'Fecha final'],
  'TIME COMPLETED': ['timeCompleted', 'Hora'],
  'MAPPING': ['mapping', 'mapping'],
  'COMMENT': ['comment', 'Comentario'],
  'BASE (M)': ['baseM', 'Base'],
  'HEIGHT (M)': ['heightM', 'Alto'],
  'LINEAR METERS': ['linearMeters', 'Metros Lineales (m)'],
  'QUANTITY': ['quantity', 'Cantidad:'],
};
const PHOTO_HEADERS = ['PHOTO 1', 'PHOTO 2', 'PHOTO 3', 'PHOTO 4', 'PHOTO 5', 'PHOTO 6', 'PHOTO 7', 'PHOTO 8', 'PHOTO 9'];
const TRACKED = Object.keys(FIELDS).concat(PHOTO_HEADERS);

const URGENCY_VALUES = { LOW: 'LOW', BAJA: 'LOW', MEDIUM: 'MEDIUM', MEDIA: 'MEDIUM', HIGH: 'HIGH', ALTA: 'HIGH' };
const STATUS_VALUES = {
  'BEFORE': 'BEFORE', 'ANTES': 'BEFORE',
  'IN PROGRESS': 'IN PROGRESS', 'EN PROGRESO': 'IN PROGRESS',
  'COMPLETED': 'COMPLETED', 'COMPLETE': 'COMPLETED', 'COMPLETADO': 'COMPLETED',
};
const UPPERCASE_FIELDS = ['orientation', 'defect', 'level'];

// PHOTO 1-3 BEFORE, 4-6 IN PROGRESS, 7-9 COMPLETED (same as the web app).
const phaseOfSlot_ = i => (i >= 6 ? 'COMPLETED' : i >= 3 ? 'IN PROGRESS' : 'BEFORE');

/** Run once: installs the 1-minute trigger and takes the first baseline. */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncToWeb')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncToWeb').timeBased().everyMinutes(1).create();
  const result = syncToWeb(120000);
  SpreadsheetApp.getUi().alert(
    'Conectado a la web.\n\nPestaña: "' + getSheet_().getName() + '"\n' + describeResult_(result) +
    '\n\nDesde ahora los cambios de esta planilla llegan a la web cada minuto.'
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Web Cronulla')
    .addItem('Enviar cambios ahora', 'syncNowFromMenu')
    .addItem('Agregar a la web las filas que faltan', 'addMissingFromMenu')
    .addItem('Enviar TODO a la web (sobrescribe)', 'pushEverythingFromMenu')
    .addToUi();
}

function syncNowFromMenu() {
  SpreadsheetApp.getUi().alert(describeResult_(syncToWeb(120000)));
}

/** Sends every row as if all its cells had changed. Web edits to those cells are replaced. */
function pushEverythingFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert(
    'Enviar todo',
    'Esto copia TODAS las filas de esta planilla a la web y reemplaza lo que se haya editado allí ' +
      '(las fotos extra que solo están en la web se conservan). ¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (ok !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('forceAll', '1');
  ui.alert(describeResult_(syncToWeb(120000)));
}

/** Creates in the web app the rows of this sheet it doesn't have (e.g. deleted there earlier). */
function addMissingFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert(
    'Agregar filas que faltan',
    'Se crearán en la web las filas de esta planilla que no existen allí, incluidas las que se hayan ' +
      'borrado en la web (por ejemplo duplicados). ¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (ok !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('addMissing', '1');
  ui.alert(describeResult_(syncToWeb(120000)));
}

function describeResult_(r) {
  if (!r) return 'La sincronización automática sigue trabajando (la primera vez puede tardar unos minutos). Espera un poco y vuelve a intentar.';
  const parts = [
    r.baseline ? 'Primera lectura: ' + r.rows + ' filas registradas como punto de partida.' : 'Filas leídas: ' + r.rows + '.',
    'Nuevas en la web: ' + r.added,
    'Actualizadas: ' + r.updated,
    'Borradas: ' + r.deleted,
  ];
  if (r.missing) parts.push('Filas que no están en la web (no se agregaron): ' + r.missing + '. Usa el menú Web Cronulla → Agregar a la web las filas que faltan si quieres crearlas.');
  if (r.skippedDeletes) parts.push('No se borraron ' + r.skippedDeletes + ' filas desaparecidas (demasiadas a la vez; revisa filtros).');
  return parts.join('\n');
}

// ───────────────────────────── Main loop ─────────────────────────────

// `waitMs`: menu actions wait for a running sync to finish instead of giving up.
function syncToWeb(waitMs) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(typeof waitMs === 'number' ? waitMs : 5000)) return null;
  try {
    return syncLocked_();
  } finally {
    lock.releaseLock();
  }
}

function syncLocked_() {
  const props = PropertiesService.getScriptProperties();
  const forceAll = props.getProperty('forceAll') === '1';
  const addMissing = props.getProperty('addMissing') === '1';
  const sheet = getSheet_();
  const headers = readHeaders_(sheet);
  const idIdx = headers.indexOf(ID_HEADER);
  const lastRow = sheet.getLastRow();
  const values = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();

  const snapshot = readSnapshot_();
  const baseline = !props.getProperty('initialized');
  const result = { rows: 0, added: 0, updated: 0, deleted: 0, skippedDeletes: 0, missing: 0, baseline: baseline };

  // Current content of each row, keyed by ID. Rows without an ID (or with a duplicated one,
  // e.g. a copied row) get a new ID written back.
  const seen = {};
  const newRows = [];
  const idWrites = [];
  values.forEach((row, i) => {
    const rec = rowRecord_(headers, row);
    if (!rec.DEFECT && !rec.ORIENTATION && !rec['PHOTO 1']) return; // empty line
    result.rows++;
    let id = idIdx >= 0 ? String(row[idIdx]).trim() : '';
    if (!id || seen[id]) {
      id = 'defect-glide-' + Date.now().toString(36) + '-' + i;
      idWrites.push([i + 2, id]);
      newRows.push(id);
    }
    seen[id] = rec;
  });
  idWrites.forEach(([r, id]) => sheet.getRange(r, idIdx + 1).setValue(id));

  const ids = Object.keys(seen);
  const web = fetchByIds_(ids);
  const now = new Date().toISOString();
  const upserts = [];
  const inserts = [];
  const history = [];
  let position = null;

  ids.forEach(id => {
    const rec = seen[id];
    const old = snapshot[id];
    const current = web[id];
    const user = 'Glide · ' + (rec['TECHNICIAN COMPLETED'] || rec['TECHNICIAN START'] || 'planilla');

    if (!current) {
      // Rows already known (deleted in the web on purpose) and rows present at the first run are
      // only created on request; rows that appear later are new defects and are created.
      if (!addMissing && (old || baseline)) {
        result.missing++;
        return;
      }
      const item = emptyItem_(id);
      applyChanges_(item, rec, {}, TRACKED, []);
      if (position === null) position = fetchMaxPosition_() + 1;
      inserts.push({ id: id, position: position++, data: item, client_id: CLIENT_ID, updated_at: now });
      history.push({ user_name: user, action: 'add', defect_id: id, row_no: item.rowNo, details: { defect: item.defect } });
      result.added++;
      return;
    }
    if (baseline && !forceAll) return; // first run: just remember how the row looks

    const changed = forceAll || !old ? TRACKED : TRACKED.filter(h => (old[h] || '') !== (rec[h] || ''));
    if (changed.length === 0) return;
    const log = [];
    const data = JSON.parse(JSON.stringify(current));
    applyChanges_(data, rec, forceAll ? {} : old || {}, changed, log);
    if (log.length === 0) return; // the web already had these values
    upserts.push({ id: id, data: data, client_id: CLIENT_ID, updated_at: now });
    log.forEach(l => history.push(Object.assign({ user_name: user, defect_id: id, row_no: data.rowNo }, l)));
    result.updated++;
  });

  // Rows removed from the sheet since last time.
  const gone = Object.keys(snapshot).filter(id => !seen[id]);
  if (gone.length > MAX_DELETES_PER_RUN) {
    result.skippedDeletes = gone.length;
  } else if (gone.length > 0 && !baseline) {
    const rows = fetchRowsByIds_(gone);
    appendTrash_(rows);
    deleteByIds_(gone);
    rows.forEach(r =>
      history.push({ user_name: 'Glide · planilla', action: 'delete', defect_id: r.id, row_no: r.data.rowNo, details: { defect: r.data.defect } })
    );
    result.deleted = rows.length;
  }

  chunk_(inserts, 200).forEach(c => post_('defects', c, 'resolution=merge-duplicates,return=minimal'));
  // Upsert only touches the columns sent, so `position` of existing rows is kept.
  chunk_(upserts, 200).forEach(c => post_('defects', c, 'resolution=merge-duplicates,return=minimal'));
  logHistory_(history);

  // Keep the old snapshot for rows whose deletion was skipped, so it's retried/reviewed later.
  const nextSnap = {};
  ids.forEach(id => (nextSnap[id] = seen[id]));
  if (result.skippedDeletes) gone.forEach(id => (nextSnap[id] = snapshot[id]));
  writeSnapshot_(nextSnap);
  props.setProperty('initialized', '1');
  props.deleteProperty('forceAll');
  props.deleteProperty('addMissing');
  return result;
}

// Tracked cells of one sheet row, by header.
function rowRecord_(headers, row) {
  const rec = {};
  TRACKED.forEach(h => {
    const i = headers.indexOf(h);
    rec[h] = i >= 0 ? String(row[i]).trim() : '';
  });
  return rec;
}

// Applies the changed cells to a web item. `old` is how the row looked last time: photos are
// merged 3-way so photos added in the web app are kept. Pushes history entries into `log`.
function applyChanges_(item, rec, old, changed, log) {
  let photosChanged = false;
  changed.forEach(h => {
    if (PHOTO_HEADERS.indexOf(h) >= 0) {
      photosChanged = true;
      return;
    }
    const field = FIELDS[h][0];
    let v = rec[h] || '';
    if (field === 'urgency') {
      v = URGENCY_VALUES[v.toUpperCase()];
      if (!v) return; // unknown or blank: keep the web value
    } else if (field === 'status') {
      v = STATUS_VALUES[v.toUpperCase()];
      if (!v) return;
    } else if (UPPERCASE_FIELDS.indexOf(field) >= 0) {
      v = v.toUpperCase();
    }
    const from = String(item[field] === undefined || item[field] === null ? '' : item[field]);
    if (from === v) return;
    item[field] = v;
    log.push({ action: 'edit', details: { key: field, field: FIELDS[h][1], from: from, to: v } });
  });
  if (photosChanged) mergePhotos_(item, rec, old, log);
}

function mergePhotos_(item, rec, old, log) {
  const slotMap = src => {
    const m = {};
    PHOTO_HEADERS.forEach((h, i) => {
      const url = src[h];
      if (url && /^https?:\/\//.test(url) && !m[url]) m[url] = phaseOfSlot_(i);
    });
    return m;
  };
  const before = slotMap(old);
  const after = slotMap(rec);
  let photos = (item.photos || []).map((p, i) => (typeof p === 'string' ? { url: p, phase: phaseOfSlot_(i) } : p));
  const has = url => photos.some(p => p.url === url);

  Object.keys(before).forEach(url => {
    if (!after[url] && has(url)) {
      photos = photos.filter(p => p.url !== url);
      log.push({ action: 'photo_remove', details: { phase: before[url], url: url } });
    }
  });
  Object.keys(after).forEach(url => {
    const phase = after[url];
    const existing = photos.find(p => p.url === url);
    if (!existing) {
      photos.push({ url: url, phase: phase });
      log.push({ action: 'photo_add', details: { phase: phase, url: url } });
    } else if (existing.phase !== phase && before[url] && before[url] !== phase) {
      log.push({ action: 'photo_phase', details: { from: existing.phase, to: phase, url: url } });
      existing.phase = phase;
    }
  });

  // Keep phases grouped (BEFORE, IN PROGRESS, COMPLETED) like the web app shows them.
  const order = { 'BEFORE': 0, 'IN PROGRESS': 1, 'COMPLETED': 2 };
  photos = photos
    .map((p, i) => ({ p: p, i: i }))
    .sort((a, b) => order[a.p.phase] - order[b.p.phase] || a.i - b.i)
    .map((x, i) => ({ url: x.p.url, phase: x.p.phase, slot: i + 1 }));
  item.photos = photos;
}

function emptyItem_(id) {
  return {
    id: id, rowNo: '', projectName: '', orientation: '', defect: '', urgency: 'LOW', drop: '', level: '',
    photos: [], status: 'BEFORE', technicianStart: '', date1stPhoto: '', time1stPhoto: '',
    technicianCompleted: '', dateCompleted: '', timeCompleted: '', mapping: '', comment: '',
    baseM: '', heightM: '', linearMeters: '', quantity: '', customTags: [],
  };
}

// ───────────────────────────── Supabase ─────────────────────────────

function fetchByIds_(ids) {
  const byId = {};
  fetchRowsByIds_(ids).forEach(r => (byId[r.id] = r.data));
  return byId;
}

function fetchRowsByIds_(ids) {
  const rows = [];
  chunk_(ids, 100).forEach(part => {
    const res = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/defects?select=id,position,data&id=in.(' + idList_(part) + ')',
      { headers: headers_() }
    );
    JSON.parse(res.getContentText()).forEach(r => rows.push(r));
  });
  return rows;
}

function deleteByIds_(ids) {
  chunk_(ids, 100).forEach(part =>
    UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects?id=in.(' + idList_(part) + ')', {
      method: 'delete',
      headers: headers_(),
    })
  );
}

function fetchMaxPosition_() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects?select=position&order=position.desc&limit=1', {
    headers: headers_(),
  });
  const rows = JSON.parse(res.getContentText());
  return rows[0] ? rows[0].position : -1;
}

function post_(table, rows, prefer) {
  if (rows.length === 0) return;
  UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'post',
    contentType: 'application/json',
    headers: headers_({ Prefer: prefer }),
    payload: JSON.stringify(rows),
  });
}

// Change history shown in the web app's "History" panel. Optional: ignored if the table is missing.
function logHistory_(records) {
  if (records.length === 0) return;
  // Every object in one bulk insert must have the same keys.
  const rows = records.map(r => ({
    user_name: r.user_name, action: r.action, defect_id: r.defect_id, row_no: r.row_no || null, details: r.details || {},
  }));
  try {
    chunk_(rows, 500).forEach(c => post_('defect_history', c, 'return=minimal'));
  } catch (e) {
    console.warn('History not written: ' + e);
  }
}

function idList_(ids) {
  return encodeURIComponent(ids.map(id => '"' + String(id).replace(/"/g, '') + '"').join(','));
}

function headers_(extra) {
  return Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, extra || {});
}

function chunk_(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ───────────────────────────── Sheet helpers ─────────────────────────────

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const looksRight = s => {
    if (s.getLastColumn() < 1) return false;
    const h = readHeaders_(s);
    return h.indexOf(ID_HEADER) >= 0 && h.indexOf('DEFECT') >= 0 && h.indexOf('PHOTO 1') >= 0;
  };
  const byGid = ss.getSheets().find(s => s.getSheetId() === SHEET_GID);
  if (byGid && looksRight(byGid)) return byGid;
  const other = ss.getSheets().find(s => !s.isSheetHidden() && looksRight(s));
  if (other) return other;
  throw new Error('No encuentro la pestaña de defectos (necesita columnas ID, DEFECT y PHOTO 1).');
}

function readHeaders_(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(h => String(h).trim().toUpperCase().replace(/\s+/g, ' '));
}

function readSnapshot_() {
  const snap = helperSheet_(SNAPSHOT_SHEET, ['ID', 'ROW']);
  const out = {};
  if (snap.getLastRow() < 2) return out;
  snap.getRange(2, 1, snap.getLastRow() - 1, 2).getValues().forEach(([id, json]) => {
    if (id) out[String(id)] = JSON.parse(json);
  });
  return out;
}

function writeSnapshot_(byId) {
  const snap = helperSheet_(SNAPSHOT_SHEET, ['ID', 'ROW']);
  if (snap.getLastRow() > 1) snap.getRange(2, 1, snap.getLastRow() - 1, 2).clearContent();
  const rows = Object.keys(byId).map(id => [id, JSON.stringify(byId[id])]);
  if (rows.length > 0) snap.getRange(2, 1, rows.length, 2).setValues(rows);
}

function appendTrash_(rows) {
  if (rows.length === 0) return;
  const trash = helperSheet_(TRASH_SHEET, ['BORRADO', 'ID', 'POSITION', 'DATA']);
  const batch = new Date().toISOString();
  const values = rows.map(r => [batch, r.id, r.position, JSON.stringify(r.data)]);
  trash.getRange(trash.getLastRow() + 1, 1, values.length, 4).setValues(values);
}

function helperSheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name, ss.getSheets().length);
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.hideSheet();
  }
  return sheet;
}
