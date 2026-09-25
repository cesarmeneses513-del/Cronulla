/**
 * Glide sheet ("Report of Building CPR 2026") ⇄ Cronulla web app.
 *
 * Paste into THAT spreadsheet's Extensions → Apps Script, then run `setup` once.
 *
 * Every minute it compares the CRONULLA tab with what it saw last time and sends only what
 * changed to Supabase: new photos, status, technicians, dates, comments, new rows, deleted rows.
 * The web app updates live, and the "Cronulla vs Code" sheet (sync.gs) then fills itself.
 * The other direction (web → this tab: photos uploaded in the web, status…) is off until turned
 * on from the menu Web Cronulla → Activar web → Glide.
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
    .addItem('Completar en la web fotos y datos que faltan', 'fillGapsFromMenu')
    .addItem('Agregar a la web las filas que faltan', 'addMissingFromMenu')
    .addItem('Enviar TODO a la web (sobrescribe)', 'pushEverythingFromMenu')
    .addSeparator()
    .addItem('Activar web → Glide (fotos y cambios de la web)', 'webToSheetFromMenu')
    .addItem('Desactivar web → Glide', 'stopWebToSheetFromMenu')
    .addSeparator()
    .addItem('Quitar de aquí las filas borradas en la web', 'removeWebDeletedFromMenu')
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

/**
 * Adds to the web the photos of this sheet it doesn't have yet, and fills web fields that are
 * empty. Never overwrites or removes anything. Useful for changes made before the first sync.
 */
function fillGapsFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert(
    'Completar lo que falta',
    'Se agregarán a la web las fotos de esta planilla que no están allí y se llenarán los campos ' +
      'vacíos. No se borra ni se reemplaza nada. (Si borraste una foto en la web y sigue aquí, volverá.) ¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (ok !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('fillGaps', '1');
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
  if (r.toSheetCells || r.toSheetRows || r.toSheetRemoved) parts.push('Web → Glide: ' + (r.toSheetCells || 0) + ' celdas actualizadas, ' + (r.toSheetRows || 0) + ' filas agregadas, ' + (r.toSheetRemoved || 0) + ' filas quitadas (borradas en la web).');
  if (r.toSheetRemoveSkipped) parts.push('No se quitaron ' + r.toSheetRemoveSkipped + ' filas que no están en la web (demasiadas a la vez). Usa Web Cronulla → Quitar de aquí las filas borradas en la web.');
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
  const fillGaps = props.getProperty('fillGaps') === '1';
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
    if (fillGaps) {
      const log = [];
      const data = JSON.parse(JSON.stringify(current));
      fillGaps_(data, rec, log);
      if (log.length > 0) {
        upserts.push({ id: id, data: data, client_id: CLIENT_ID, updated_at: now });
        log.forEach(l => history.push(Object.assign({ user_name: user, defect_id: id, row_no: data.rowNo }, l)));
        result.updated++;
      }
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

  // Web → this tab, when turned on. Skipped when nothing changed in the web since last time.
  let wroteSheet = false;
  if (props.getProperty('webToSheet') === 'on' && !baseline) {
    const sig = webSignature_();
    if (sig !== props.getProperty('webSig')) {
      const w = pushWebToSheet_(sheet, headers, gone, readWebSnapshot_(), false);
      result.toSheetCells = w.cells;
      result.toSheetRows = w.appended;
      result.toSheetRemoved = w.removed;
      result.toSheetRemoveSkipped = w.removeSkipped;
      wroteSheet = w.cells + w.appended + w.removed > 0;
      // Our own writes above changed nothing in the web, so this is still current.
      props.setProperty('webSig', webSignature_());
    }
  }
  // What we just wrote must not look like a Glide edit next time.
  const current = wroteSheet ? readRecords_(sheet, headers) : seen;

  // Keep the old snapshot for rows whose deletion was skipped, so it's retried/reviewed later.
  const nextSnap = {};
  Object.keys(current).forEach(id => (nextSnap[id] = current[id]));
  if (result.skippedDeletes) gone.forEach(id => (nextSnap[id] = snapshot[id]));
  writeSnapshot_(nextSnap);
  props.setProperty('initialized', '1');
  props.deleteProperty('forceAll');
  props.deleteProperty('addMissing');
  props.deleteProperty('fillGaps');
  return result;
}

// Tracked cells of every row with an ID, by ID.
function readRecords_(sheet, headers) {
  const idIdx = headers.indexOf(ID_HEADER);
  const out = {};
  if (sheet.getLastRow() < 2) return out;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues().forEach(row => {
    const id = String(row[idIdx]).trim();
    const rec = rowRecord_(headers, row);
    if (id && !out[id] && (rec.DEFECT || rec.ORIENTATION || rec['PHOTO 1'])) out[id] = rec;
  });
  return out;
}

// Tracked cells of one sheet row, by header.
function rowRecord_(headers, row) {
  const rec = {};
  TRACKED.forEach(h => {
    const i = headers.indexOf(h);
    rec[h] = i >= 0 ? String(row[i]).trim() : '';
  });
  // Rows added in Glide often leave "No" empty; column "0" holds the same running number.
  const zero = headers.indexOf('0');
  if (!rec.NO && zero >= 0) rec.NO = String(row[zero]).trim();
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

// Only additions: missing photos, and fields that are empty in the web.
function fillGaps_(item, rec, log) {
  const empty = Object.keys(FIELDS).filter(h => {
    const v = item[FIELDS[h][0]];
    return rec[h] && (v === undefined || v === null || String(v).trim() === '');
  });
  applyChanges_(item, rec, {}, empty.concat(PHOTO_HEADERS), log);
}

function mergePhotos_(item, rec, old, log) {
  // A photo is identified by URL + phase: Glide may put the same image in two phases.
  const keys = src => {
    const out = [];
    PHOTO_HEADERS.forEach((h, i) => {
      const url = src[h];
      if (!url || !/^https?:\/\//.test(url)) return;
      const key = phaseOfSlot_(i) + '|' + url;
      if (out.indexOf(key) < 0) out.push(key);
    });
    return out;
  };
  const split = key => ({ phase: key.slice(0, key.indexOf('|')), url: key.slice(key.indexOf('|') + 1) });
  const before = keys(old);
  const after = keys(rec);
  const removed = before.filter(k => after.indexOf(k) < 0);
  const added = after.filter(k => before.indexOf(k) < 0);

  let photos = (item.photos || []).map((p, i) => (typeof p === 'string' ? { url: p, phase: phaseOfSlot_(i) } : p));
  const find = (url, phase) => photos.find(p => p.url === url && p.phase === phase);

  added.forEach(key => {
    const { phase, url } = split(key);
    if (find(url, phase)) return; // the web already has it
    // Same image moved to another phase in Glide: move it in the web too.
    const movedFrom = removed.map(split).find(r => r.url === url && find(url, r.phase));
    if (movedFrom) {
      find(url, movedFrom.phase).phase = phase;
      removed.splice(removed.indexOf(movedFrom.phase + '|' + url), 1);
      log.push({ action: 'photo_phase', details: { from: movedFrom.phase, to: phase, url: url } });
      return;
    }
    photos.push({ url: url, phase: phase });
    log.push({ action: 'photo_add', details: { phase: phase, url: url } });
  });
  removed.forEach(key => {
    const { phase, url } = split(key);
    const photo = find(url, phase);
    if (!photo) return;
    photos = photos.filter(p => p !== photo);
    log.push({ action: 'photo_remove', details: { phase: phase, url: url } });
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

// Apps Script caps URL length (~2 KB), so ID lists go in small batches; for many IDs it is
// cheaper to read the whole table page by page and filter.
const ID_BATCH = 30;

function fetchRowsByIds_(ids) {
  if (ids.length > 300) {
    const wanted = new Set(ids);
    return fetchAllRows_().filter(r => wanted.has(r.id));
  }
  const rows = [];
  chunk_(ids, ID_BATCH).forEach(part => {
    const res = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/defects?select=id,position,data&id=in.(' + idList_(part) + ')',
      { headers: headers_() }
    );
    JSON.parse(res.getContentText()).forEach(r => rows.push(r));
  });
  return rows;
}

function fetchAllRows_() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/defects?select=id,position,data&order=id.asc&offset=' + from + '&limit=1000',
      { headers: headers_() }
    );
    const page = JSON.parse(res.getContentText());
    page.forEach(r => rows.push(r));
    if (page.length < 1000) break;
  }
  return rows;
}

function deleteByIds_(ids) {
  chunk_(ids, ID_BATCH).forEach(part =>
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

// ───────────────────────────── Web → sheet ─────────────────────────────
// Turned on from the menu. Every minute, cells that changed in the web app (photos uploaded
// there, status, comments…) are written into this tab, so Glide shows them too. New web rows
// are appended, and rows deleted in the web are removed (copied first to "_glide_papelera"),
// so both lists have the same rows.

const WEB_SNAPSHOT_SHEET = '_web_to_sheet';
// Written both ways. Dates/times and "No" are only filled in rows appended from the web,
// so Glide's own formats and numbering are never touched.
const WRITE_BACK = [
  'ORIENTATION', 'DEFECT', 'URGENCY', 'DROP', 'LEVEL', 'STATUS', 'TECHNICIAN START', 'TECHNICIAN COMPLETED',
  'COMMENT', 'BASE (M)', 'HEIGHT (M)', 'LINEAR METERS', 'QUANTITY',
].concat(PHOTO_HEADERS);
const APPEND_ONLY = ['NO', 'NAME PROYECT', 'DATE 1ST PHOTO', 'TIME 1ST PHOTO', 'DATE COMPLETED', 'TIME COMPLETED'];
// Rows deleted in the web are removed here automatically, unless more than this disappear at
// once (then nothing is removed and the summary says so; the menu action can do it).
const MAX_AUTO_REMOVE = 50;

function webToSheetFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(120000)) return ui.alert(describeResult_(null));
  let preview;
  try {
    const sheet = getSheet_();
    preview = pushWebToSheet_(sheet, readHeaders_(sheet), [], {}, true);
  } finally {
    lock.releaseLock();
  }
  const answer = ui.alert(
    'Web → Glide',
    'Ahora hay diferencias entre la web y esta planilla en ' + preview.rows + ' filas (' + preview.cells +
      ' celdas), ' + preview.appended + ' filas de la web no están aquí y ' + (preview.removed + preview.removeSkipped) +
      ' filas de aquí ya no existen en la web.\n\n' +
      'SÍ = igualar ahora: la web manda (se escriben esas celdas, se agregan esas filas y se quitan las borradas en la web), y desde ahí se mantiene igual cada minuto.\n' +
      'NO = no cambiar las celdas que ya hay; solo enviar los cambios que se hagan en la web desde ahora (las filas borradas en la web igual se quitan, para que ambas tengan las mismas filas).\n' +
      'CANCELAR = no activar.',
    ui.ButtonSet.YES_NO_CANCEL
  );
  if (answer === ui.Button.CANCEL || answer === ui.Button.CLOSE) return;
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('webSig');
  if (answer === ui.Button.NO) {
    // Remember the web as it is now, so only later changes are written.
    const snap = {};
    fetchAllRows_().forEach(w => (snap[w.id] = desiredCells_(w.data)));
    writeWebSnapshot_(snap);
  } else {
    writeWebSnapshot_({});
  }
  props.setProperty('webToSheet', 'on');
  ui.alert(describeResult_(syncToWeb(120000)) + '\n\nWeb → Glide activado.');
}

function stopWebToSheetFromMenu() {
  PropertiesService.getScriptProperties().deleteProperty('webToSheet');
  SpreadsheetApp.getUi().alert('Web → Glide desactivado. Glide → web sigue funcionando.');
}

// Cells a web item should show in this tab.
function desiredCells_(item) {
  const out = {};
  Object.keys(FIELDS).forEach(h => {
    const v = item[FIELDS[h][0]];
    out[h] = v === undefined || v === null ? '' : String(v);
  });
  const photos = (item.photos || []).map((p, i) => (typeof p === 'string' ? { url: p, phase: phaseOfSlot_(i) } : p));
  [['BEFORE', 0], ['IN PROGRESS', 3], ['COMPLETED', 6]].forEach(([phase, offset]) => {
    const urls = [];
    photos.forEach(p => p.phase === phase && urls.indexOf(p.url) < 0 && urls.push(p.url));
    for (let n = 0; n < 3; n++) out[PHOTO_HEADERS[offset + n]] = urls[n] || '';
  });
  return out;
}

function sameCell_(header, raw, want) {
  if (raw instanceof Date) return true; // never rewrite real dates
  const a = String(raw === null || raw === undefined ? '' : raw).trim();
  const b = String(want === null || want === undefined ? '' : want).trim();
  if (a === b) return true;
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (header === 'URGENCY') return (URGENCY_VALUES[A] || A) === B;
  if (header === 'STATUS') return (STATUS_VALUES[A] || A) === B;
  if (['ORIENTATION', 'DEFECT', 'LEVEL'].indexOf(header) >= 0) return A === B;
  if (a !== '' && b !== '' && !isNaN(Number(a)) && !isNaN(Number(b))) return Number(a) === Number(b);
  return false;
}

// Writes web changes into the tab. `exclude`: IDs deleted from the tab this run (not re-added).
// `webSnap`: how each web row looked last time (only headers that changed since are written;
// rows without an entry are compared in full). Returns counts; `dryRun` writes nothing.
function pushWebToSheet_(sheet, headers, exclude, webSnap, dryRun) {
  const idIdx = headers.indexOf(ID_HEADER);
  const n = Math.max(sheet.getLastRow() - 1, 0);
  const range = n > 0 ? sheet.getRange(2, 1, n, headers.length) : null;
  const raw = range ? range.getValues() : [];
  const formulas = range ? range.getFormulas() : [];
  const rowOf = {};
  raw.forEach((r, i) => {
    const id = String(r[idIdx]).trim();
    if (id && rowOf[id] === undefined) rowOf[id] = i;
  });

  const web = fetchAllRows_();
  const nextSnap = {};
  const writes = [];
  const appends = [];
  const touchedRows = {};

  web.forEach(w => {
    const want = desiredCells_(w.data);
    nextSnap[w.id] = want;
    const prev = webSnap[w.id];
    const i = rowOf[w.id];
    if (i === undefined) {
      if (prev || exclude.indexOf(w.id) >= 0) return; // deleted here earlier, or known and absent
      const row = headers.map(() => '');
      WRITE_BACK.concat(APPEND_ONLY).forEach(h => {
        const c = headers.indexOf(h);
        if (c >= 0) row[c] = want[h];
      });
      row[idIdx] = w.id;
      appends.push(row);
      return;
    }
    WRITE_BACK.forEach(h => {
      const c = headers.indexOf(h);
      if (c < 0 || formulas[i][c]) return;
      if (prev && prev[h] === want[h]) return; // unchanged in the web since last time
      if (sameCell_(h, raw[i][c], want[h])) return;
      writes.push([i + 2, c + 1, want[h]]);
      touchedRows[i] = true;
    });
  });

  // Rows whose defect no longer exists in the web were deleted there: remove them here too.
  const webIds = new Set(web.map(w => w.id));
  const removals = [];
  raw.forEach((r, i) => {
    const id = String(r[idIdx]).trim();
    if (id && !webIds.has(id)) removals.push(i);
  });
  const tooMany = removals.length > MAX_AUTO_REMOVE;

  if (!dryRun) {
    writes.forEach(([r, c, v]) => sheet.getRange(r, c).setValue(v));
    if (appends.length > 0) sheet.getRange(n + 2, 1, appends.length, headers.length).setValues(appends);
    if (removals.length > 0 && !tooMany) {
      const trash = helperSheet_(GLIDE_TRASH_SHEET, ['BORRADO'].concat(headers));
      const stamp = new Date().toISOString();
      trash.getRange(trash.getLastRow() + 1, 1, removals.length, headers.length + 1)
        .setValues(removals.map(i => [stamp].concat(raw[i])));
      // Bottom to top so row numbers stay valid (appended rows are below all of these).
      removals.slice().reverse().forEach(i => sheet.deleteRow(i + 2));
    }
    writeWebSnapshot_(nextSnap);
  }
  return {
    cells: writes.length,
    rows: Object.keys(touchedRows).length,
    appended: appends.length,
    removed: tooMany ? 0 : removals.length,
    removeSkipped: tooMany ? removals.length : 0,
  };
}

function readWebSnapshot_() {
  const snap = helperSheet_(WEB_SNAPSHOT_SHEET, ['ID', 'CELLS']);
  const out = {};
  if (snap.getLastRow() < 2) return out;
  snap.getRange(2, 1, snap.getLastRow() - 1, 2).getValues().forEach(([id, json]) => {
    if (id) out[String(id)] = JSON.parse(json);
  });
  return out;
}

function writeWebSnapshot_(byId) {
  const snap = helperSheet_(WEB_SNAPSHOT_SHEET, ['ID', 'CELLS']);
  if (snap.getLastRow() > 1) snap.getRange(2, 1, snap.getLastRow() - 1, 2).clearContent();
  const rows = Object.keys(byId).map(id => [id, JSON.stringify(byId[id])]);
  if (rows.length > 0) snap.getRange(2, 1, rows.length, 2).setValues(rows);
}

// Row count + latest update in the web: unchanged means there is nothing to write.
function webSignature_() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects?select=updated_at&order=updated_at.desc&limit=1', {
    headers: headers_({ Prefer: 'count=exact' }),
  });
  const h = res.getHeaders();
  const total = String(h['Content-Range'] || h['content-range'] || '').split('/')[1];
  const rows = JSON.parse(res.getContentText());
  return total + '|' + (rows[0] ? rows[0].updated_at : '');
}

// ─────────────────── Rows deleted in the web → remove here ───────────────────

const GLIDE_TRASH_SHEET = '_glide_papelera';

/**
 * Menu action: removes from this tab the rows whose defect no longer exists in the web app
 * (deleted there). They are copied first to the hidden tab "_glide_papelera".
 */
function removeWebDeletedFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(120000)) return ui.alert(describeResult_(null));
  try {
    const sheet = getSheet_();
    const headers = readHeaders_(sheet);
    const idIdx = headers.indexOf(ID_HEADER);
    const n = sheet.getLastRow() - 1;
    if (idIdx < 0 || n < 1) return ui.alert('No hay filas.');
    const values = sheet.getRange(2, 1, n, headers.length).getValues();
    const webIds = new Set(fetchAllRows_().map(r => r.id));
    const doomed = [];
    values.forEach((row, i) => {
      const id = String(row[idIdx]).trim();
      if (id && !webIds.has(id)) doomed.push(i);
    });
    if (doomed.length === 0) return ui.alert('Todas las filas de esta planilla existen en la web. No hay nada que quitar.');

    const col = h => headers.indexOf(h);
    const describe = i => {
      const r = values[i];
      const v = h => (col(h) >= 0 ? String(r[col(h)]).trim() : '');
      return 'No ' + v('NO') + ' · ' + v('ORIENTATION') + ' · ' + v('DEFECT') + ' · D' + v('DROP') + ' L' + v('LEVEL');
    };
    const list = doomed.slice(0, 15).map(describe).join('\n') + (doomed.length > 15 ? '\n… y ' + (doomed.length - 15) + ' más' : '');
    const ok = ui.alert(
      'Quitar filas borradas en la web',
      doomed.length + ' filas de esta planilla ya no existen en la web (se borraron allí):\n\n' + list +
        '\n\nSe copiarán a la pestaña oculta "' + GLIDE_TRASH_SHEET + '" y se quitarán de aquí. ¿Continuar?',
      ui.ButtonSet.YES_NO
    );
    if (ok !== ui.Button.YES) return;

    const trash = helperSheet_(GLIDE_TRASH_SHEET, ['BORRADO'].concat(headers));
    const stamp = new Date().toISOString();
    trash.getRange(trash.getLastRow() + 1, 1, doomed.length, headers.length + 1)
      .setValues(doomed.map(i => [stamp].concat(values[i])));
    // Bottom to top so row numbers stay valid.
    doomed.slice().reverse().forEach(i => sheet.deleteRow(i + 2));

    // Forget them, so the next sync doesn't treat the removal as a deletion to send to the web.
    const gone = new Set(doomed.map(i => String(values[i][idIdx]).trim()));
    const snap = readSnapshot_();
    gone.forEach(id => delete snap[id]);
    writeSnapshot_(snap);
    ui.alert(doomed.length + ' filas quitadas. Quedan guardadas en "' + GLIDE_TRASH_SHEET + '".');
  } finally {
    lock.releaseLock();
  }
}
