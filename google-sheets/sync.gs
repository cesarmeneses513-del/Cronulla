/**
 * Cronulla ⇄ Google Sheets sync.
 *
 * Paste into the spreadsheet's Extensions → Apps Script, then run `setup` once.
 *
 * App → sheet: every minute it checks Supabase and, only if something changed, rewrites the
 * data rows of SHEET_NAME. Columns are matched by their header text (row 1), so their order
 * doesn't matter; columns it doesn't recognise are left empty.
 *
 * Sheet → app: editing cells pushes just the edited columns of those rows to Supabase, and the
 * web app picks them up live. A new row (with Defect or Orientation filled) creates a defect.
 * Rows are identified by the ID column, which the script adds and fills — don't edit it.
 * Deleting rows in the sheet (right-click → Delete row) deletes those defects in the app. Deleted
 * rows are first copied to a hidden "_papelera" tab; Cronulla → Restaurar último borrado brings
 * the last batch back. Clearing a row's contents is NOT a delete — use Delete row.
 *
 * Order: rows are sorted by Stage, Drop and Level whenever the web writes the sheet and whenever
 * the spreadsheet is opened. The last "No" column (B) is renumbered 1, 2, 3… in that order and is
 * never sent to the web. Any other column the web doesn't write (like the first "No", column A)
 * belongs to the sheet: what is typed there moves with its row and is never erased.
 */

const SUPABASE_URL = 'https://jawmcsrcgqvndjhhvovl.supabase.co';
// Publishable key: the same key the web app ships to browsers.
const SUPABASE_KEY = 'sb_publishable_C5fy8k5sNRW0F5ZBsJDEDw_k8DRptZJ';

// Tab to sync. Empty = the first tab of the spreadsheet.
const SHEET_NAME = '';

const PAGE_SIZE = 1000;
const ID_HEADER = 'ID';
// Hidden helper tabs: IDs the sheet showed after the last rewrite, and deleted rows (for restore).
const SNAPSHOT_SHEET = '_sync_ids';
const TRASH_SHEET = '_papelera';

// Sheet header (trimmed, upper-case) → DefectItem field, for plain text columns.
// "No" is not here: the sheet numbers its own rows (see NUMBER_HEADER).
const FIELDS = {
  'NAME PROYECT': 'projectName',
  'NAME PROJECT': 'projectName',
  'NAME PROJECT:': 'projectName',
  'ORIENTATION': 'orientation',
  'DEFECT': 'defect',
  'URGENCY': 'urgency',
  'DROP': 'drop',
  'LEVEL': 'level',
  'STATUS': 'status',
  'TECHNICIAN START': 'technicianStart',
  'DATE START': 'date1stPhoto',
  'DATE 1ST PHOTO': 'date1stPhoto', // former name of DATE START
  'TIME 1ST PHOTO': 'time1stPhoto',
  'TECHNICIAN DURING': 'technicianDuring',
  'DATE DURING': 'dateDuring',
  'TIME DURING': 'timeDuring',
  'TECHNICIAN COMPLETED': 'technicianCompleted',
  'DATE COMPLETED': 'dateCompleted',
  'TIME COMPLETED': 'timeCompleted',
  'MAPPING': 'mapping',
  'COMMENT': 'comment',
  'BASE (M)': 'baseM',
  'HEIGHT (M)': 'heightM',
  'LINEAR METERS': 'linearMeters',
  'QUANTITY': 'quantity',
};

// Values typed in the sheet (English or Spanish) → the app's codes.
const URGENCY_VALUES = { LOW: 'LOW', BAJA: 'LOW', MEDIUM: 'MEDIUM', MEDIA: 'MEDIUM', HIGH: 'HIGH', ALTA: 'HIGH' };
const STATUS_VALUES = {
  'BEFORE': 'BEFORE', 'ANTES': 'BEFORE',
  'IN PROGRESS': 'IN PROGRESS', 'EN PROGRESO': 'IN PROGRESS', 'EN CURSO': 'IN PROGRESS',
  'COMPLETED': 'COMPLETED', 'COMPLETADO': 'COMPLETED', 'LISTO': 'COMPLETED',
};
const UPPERCASE_FIELDS = ['orientation', 'defect', 'level'];

// PHOTO 1-3 BEFORE, 4-6 IN PROGRESS, 7-9 COMPLETED (same as the app's CSV export).
const PHOTO_PHASES = [['BEFORE', 0], ['IN PROGRESS', 3], ['COMPLETED', 6]];

/** Run once: installs the triggers, adds the ID column, then does a first sync. */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['syncIfChanged', 'onSheetEdit', 'onSheetChange'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('syncIfChanged').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create();
  ensureIdColumn_(getSheet_());
  syncNow();
}

function onOpen() {
  // Opening the spreadsheet puts the rows in order (Stage, Drop, Level) and renumbers them.
  try {
    sortSheetRows_();
    ensureCompletedHighlight_(getSheet_());
  } catch (err) {
    // Read-only viewers can't edit; the sheet is still shown as it is.
  }
  SpreadsheetApp.getUi()
    .createMenu('Cronulla')
    .addItem('Enviar la planilla a la web', 'sendSheetToWeb')
    .addItem('Traer datos de la web (reemplaza la planilla)', 'syncNowFromMenu')
    .addSeparator()
    .addItem('Restaurar último borrado', 'restoreLastDeletion')
    .addToUi();
}

/** Menu action: rewrites the sheet from the web, after a warning. */
function syncNowFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert(
    'Traer datos de la web',
    'La planilla se reemplazará con lo que tiene la web. Si hiciste cambios aquí que aún no llegaron a la web, ' +
      'usa primero "Enviar la planilla a la web". ¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (ok === ui.Button.YES) syncNow();
}

/** Always rewrites, ignoring the change check. */
function syncNow() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('signature');
  props.deleteProperty('pushFailed');
  syncIfChanged(true);
}

// ───────────────────────────── App → sheet ─────────────────────────────

// `force === true` only from the menu (the time trigger passes an event object).
function syncIfChanged(force) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // an edit push or previous run is in progress
  try {
    const props = PropertiesService.getScriptProperties();
    // An edit here didn't reach the web: rewriting now would erase it. Wait until it's sent
    // (Cronulla → Enviar la planilla a la web) or the user chooses "Traer datos de la web".
    if (force !== true && props.getProperty('pushFailed')) return;
    const signature = fetchSignature_();
    if (signature === props.getProperty('signature')) return;

    writeRows_(fetchAllDefects_());
    props.setProperty('signature', signature);
  } finally {
    lock.releaseLock();
  }
}

// Row count + latest update time: changes on every insert, edit or delete.
function fetchSignature_() {
  const res = UrlFetchApp.fetch(
    SUPABASE_URL + '/rest/v1/defects?select=updated_at&order=updated_at.desc&limit=1',
    { headers: headers_({ Prefer: 'count=exact' }) }
  );
  const total = String(res.getHeaders()['Content-Range'] || res.getHeaders()['content-range'] || '').split('/')[1];
  const rows = JSON.parse(res.getContentText());
  return total + '|' + (rows[0] ? rows[0].updated_at : '');
}

function fetchAllDefects_() {
  const items = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/defects?select=data&order=position.asc,id.asc&offset=' + from + '&limit=' + PAGE_SIZE,
      { headers: headers_() }
    );
    const page = JSON.parse(res.getContentText());
    page.forEach(r => items.push(r.data));
    if (page.length < PAGE_SIZE) break;
  }
  return items;
}

function normalizePhotos_(photos) {
  return (photos || []).map((p, i) =>
    typeof p === 'string' ? { url: p, phase: i >= 6 ? 'COMPLETED' : i >= 3 ? 'IN PROGRESS' : 'BEFORE', slot: i + 1 } : p
  );
}

function photoSlots_(item) {
  const slots = ['', '', '', '', '', '', '', '', ''];
  const photos = normalizePhotos_(item.photos);
  PHOTO_PHASES.forEach(([phase, offset]) => {
    photos.filter(p => p.phase === phase).slice(0, 3).forEach((p, i) => (slots[offset + i] = p.url));
  });
  return slots;
}

function columnValue_(header, item, slots) {
  const photo = header.match(/^PHOTO\s*(\d)$/);
  if (photo) return slots[Number(photo[1]) - 1] || '';
  if (header === ID_HEADER) return item.id;
  if (header === 'CUSTOM TAGS') return (item.customTags || []).join(';');
  if (COMPUTED[header]) return COMPUTED[header](item);
  const field = FIELDS[header];
  if (!field) return '';
  if (DATE_HEADERS.indexOf(header) >= 0) return isoDate_(item[field]);
  if (TIME_HEADERS.indexOf(header) >= 0) return isoTime_(item[field]);
  return item[field];
}

// Dates and times are written as ISO text ("2026-08-17", "14:04:48"), which Sheets reads the same
// way in every locale, and shown as dd/MM/yyyy and HH:mm:ss. Text like "08/09/2026" would be read
// as 9 August or 8 September depending on the spreadsheet's locale.
const DATE_HEADERS = ['DATE START', 'DATE 1ST PHOTO', 'DATE DURING', 'DATE COMPLETED'];
const TIME_HEADERS = ['TIME 1ST PHOTO', 'TIME DURING', 'TIME COMPLETED'];

function isoDate_(v) {
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : v === undefined || v === null ? '' : v;
}

function isoTime_(v) {
  const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!m) return v === undefined || v === null ? '' : v;
  let h = Number(m[1]);
  if (m[4] && /p/i.test(m[4]) && h < 12) h += 12;
  if (m[4] && /a/i.test(m[4]) && h === 12) h = 0;
  return ('0' + h).slice(-2) + ':' + m[2] + ':' + (m[3] || '00');
}

function formatDateTimeColumns_(sheet, headers, rowCount) {
  if (rowCount < 1) return;
  headers.forEach((h, c) => {
    if (DATE_HEADERS.indexOf(h) >= 0) sheet.getRange(2, c + 1, rowCount, 1).setNumberFormat('dd/MM/yyyy');
    if (TIME_HEADERS.indexOf(h) >= 0) sheet.getRange(2, c + 1, rowCount, 1).setNumberFormat('HH:mm:ss');
  });
}

// The sheet is always written in Stage, Drop, Level order, whatever order the web keeps internally.
// Levels go up the building: G, 1, 2, … 12, then R; blanks last. Ties keep their current order.
const NUMBER_HEADER = 'NO';

const natural_ = (a, b) => {
  a = String(a === undefined || a === null ? '' : a).trim();
  b = String(b === undefined || b === null ? '' : b).trim();
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

function levelRank_(level) {
  const v = String(level === undefined || level === null ? '' : level).trim().toUpperCase();
  if (!v) return Number.POSITIVE_INFINITY;
  if (v === 'G') return -1;
  if (v === 'R') return 100000;
  const n = parseFloat(v);
  return isNaN(n) ? 50000 : n;
}

// `key` returns { level, drop, stage } for each element of `list`.
function sortForSheet_(list, key) {
  return list
    .map((x, i) => ({ x: x, k: key(x), i: i }))
    .sort((a, b) => {
      const byStageDrop = natural_(a.k.stage, b.k.stage) || natural_(a.k.drop, b.k.drop);
      if (byStageDrop) return byStageDrop;
      const la = levelRank_(a.k.level);
      const lb = levelRank_(b.k.level);
      if (la !== lb) return la < lb ? -1 : 1;
      return natural_(a.k.level, b.k.level) || a.i - b.i;
    })
    .map(e => e.x);
}

const itemKey_ = item => ({ level: item.level, drop: item.drop, stage: item.orientation });

// Columns sheet edits send to the web.
function sentToWeb_(h) {
  return !!FIELDS[h] || /^PHOTO\s*\d$/.test(h) || h === 'CUSTOM TAGS';
}

// Filled only by hand in the sheet; the web never writes them.
const SHEET_ONLY_HEADERS = ['MAPPING'];

// Columns worked out by the script on each rewrite (never sent to the web), placed right after
// LINEAR METERS: M^2 = Base × Height and LM = Linear Meters, each at least 1. Blank when the
// measurements are blank.
const toNumber_ = v => {
  const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.'));
  return isNaN(n) ? null : n;
};
const atLeastOne_ = n => (n === null ? '' : Math.max(1, Math.round(n * 100) / 100));
const COMPUTED = {
  'M^2': item => {
    const base = toNumber_(item.baseM);
    const height = toNumber_(item.heightM);
    return atLeastOne_(base === null || height === null ? null : base * height);
  },
  'LM': item => atLeastOne_(toNumber_(item.linearMeters)),
};
const COMPUTED_HEADERS = ['M^2', 'LM'];

function ensureComputedColumns_(sheet) {
  const headers = readHeaders_(sheet);
  const missing = COMPUTED_HEADERS.filter(h => headers.indexOf(h) < 0);
  if (missing.length === 0) return;
  const after = headers.indexOf('LINEAR METERS');
  const col = after >= 0 ? after + 1 : sheet.getLastColumn();
  sheet.insertColumnsAfter(col, missing.length);
  sheet.getRange(1, col + 1, 1, missing.length).setValues([missing]);
}

// Columns the web writes on each rewrite; every other one keeps what was typed in the sheet.
function writtenByWeb_(h) {
  return h === ID_HEADER || !!COMPUTED[h] || (sentToWeb_(h) && SHEET_ONLY_HEADERS.indexOf(h) < 0);
}

function writeRows_(items) {
  items = sortForSheet_(items, itemKey_);
  const sheet = getSheet_();
  ensureIdColumn_(sheet);
  ensureDuringColumns_(sheet);
  renameHeader_(sheet, 'DATE 1ST PHOTO', 'DATE START');
  ensureComputedColumns_(sheet);
  ensureCompletedHighlight_(sheet);
  const headers = readHeaders_(sheet);
  const width = headers.length;
  const numberIdx = headers.lastIndexOf(NUMBER_HEADER);

  // Columns the web never writes (e.g. the first "No"): each row keeps what was typed in the
  // sheet, matched by ID, since rows move when the sheet is re-sorted.
  const oldCount = Math.max(sheet.getLastRow() - 1, 0);
  const idIdx = headers.indexOf(ID_HEADER);
  const kept = {};
  const oldValues = oldCount > 0 ? sheet.getRange(2, 1, oldCount, width).getValues() : [];
  headers.forEach((h, c) => {
    if (c === numberIdx || writtenByWeb_(h)) return;
    kept[c] = {};
    oldValues.forEach(r => {
      const id = String(r[idIdx]).trim();
      if (id) kept[c][id] = r[c];
    });
  });

  const values = items.map((item, i) => {
    const slots = photoSlots_(item);
    return headers.map((h, c) => {
      if (c === numberIdx) return i + 1;
      if (kept[c]) return kept[c][item.id] === undefined ? '' : kept[c][item.id];
      const v = columnValue_(h, item, slots);
      return v === undefined || v === null ? '' : v;
    });
  });

  const oldRows = Math.max(sheet.getLastRow() - 1, 0);
  if (values.length > 0) {
    sheet.getRange(2, 1, values.length, width).setValues(values);
    formatDateTimeColumns_(sheet, headers, values.length);
  }
  writeSnapshot_(items.map(i => i.id));

  // Clear leftover app rows (the app now has fewer). Rows without an ID are someone typing
  // a new defect in the sheet, so leave those alone.
  if (oldRows > values.length) {
    const idCol = headers.indexOf(ID_HEADER) + 1;
    const start = values.length + 2;
    const ids = sheet.getRange(start, idCol, oldRows - values.length, 1).getValues();
    ids.forEach((row, i) => {
      if (String(row[0]).trim()) sheet.getRange(start + i, 1, 1, width).clearContent();
    });
  }
}

/**
 * Sorts the rows already in the sheet (Stage, Drop, Level) and renumbers the last "No" column,
 * without asking the web. Rows move whole, so every column keeps its value. Rows without an ID
 * (a defect still being typed) stay at the bottom.
 */
function sortSheetRows_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // a sync is writing; it sorts the sheet itself
  try {
    const sheet = getSheet_();
    const headers = readHeaders_(sheet);
    const idIdx = headers.indexOf(ID_HEADER);
    const n = sheet.getLastRow() - 1;
    if (idIdx < 0 || n < 1) return;
    const col = h => headers.indexOf(h);
    const [levelIdx, dropIdx, stageIdx] = ['LEVEL', 'DROP', 'ORIENTATION'].map(col);
    const numberIdx = headers.lastIndexOf(NUMBER_HEADER);
    const at = (r, c) => (c >= 0 ? r[c] : '');

    const range = sheet.getRange(2, 1, n, headers.length);
    const values = range.getValues();
    const hasId = r => String(r[idIdx]).trim() !== '';
    const sorted = sortForSheet_(values.filter(hasId), r => ({
      level: at(r, levelIdx),
      drop: at(r, dropIdx),
      stage: at(r, stageIdx),
    })).concat(values.filter(r => !hasId(r)));
    let count = 0;
    sorted.forEach(r => {
      if (numberIdx >= 0 && hasId(r)) r[numberIdx] = ++count;
    });

    const changed = sorted.some((r, i) => r.some((v, c) => String(v) !== String(values[i][c])));
    if (changed) range.setValues(sorted);
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────────── Sheet → app ─────────────────────────────

/** Installable onEdit trigger (installed by `setup`). */
function onSheetEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getSheetId() !== getSheet_().getSheetId()) return;

  const firstRow = Math.max(e.range.getRow(), 2);
  const lastRow = e.range.getLastRow();
  if (lastRow < firstRow) return;

  const headers = readHeaders_(sheet);
  const idIdx = headers.indexOf(ID_HEADER);
  if (idIdx < 0) return;

  const editedHeaders = [];
  for (let c = e.range.getColumn(); c <= e.range.getLastColumn(); c++) {
    const h = headers[c - 1];
    if (h && h !== ID_HEADER && sentToWeb_(h)) editedHeaders.push(h);
  }
  if (editedHeaders.length === 0) return;

  // Read the edited rows right away, before waiting for the lock, so a concurrent
  // app → sheet rewrite can't replace what the user just typed.
  const rows = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, headers.length).getDisplayValues();

  // A row copied together with its ID repeats another defect's ID. The copy (the row just
  // edited or pasted) becomes a new defect instead of overwriting the original.
  const allIds = sheet.getRange(2, idIdx + 1, Math.max(sheet.getLastRow() - 1, 1), 1).getDisplayValues().map(r => String(r[0]).trim());
  const where = {};
  allIds.forEach((id, k) => id && (where[id] = (where[id] || []).concat(k + 2)));
  rows.forEach((row, k) => {
    const id = String(row[idIdx]).trim();
    const at = where[id];
    if (!id || !at || at.length < 2) return;
    const outside = at.filter(r => r < firstRow || r > lastRow);
    const original = outside.length > 0 ? outside[0] : at[0];
    if (firstRow + k === original) return;
    row[idIdx] = '';
    sheet.getRange(firstRow + k, idIdx + 1).setValue('');
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    pushRows_(sheet, firstRow, rows, headers, editedHeaders);
  } catch (err) {
    PropertiesService.getScriptProperties().setProperty('pushFailed', String(err).slice(0, 300));
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Este cambio no llegó a la web. La planilla no se actualizará hasta que uses Cronulla → Enviar la planilla a la web.',
      'Cronulla',
      20
    );
  } finally {
    lock.releaseLock();
  }
}

const MAX_NEW_ROWS_PER_EDIT = 10;

function pushRows_(sheet, firstRow, rows, headers, editedHeaders, allowManyNew) {
  const idIdx = headers.indexOf(ID_HEADER);
  const cell = (row, header) => {
    const i = headers.indexOf(header);
    return i >= 0 ? String(row[i]).trim() : '';
  };

  const existing = rows.filter(r => String(r[idIdx]).trim());
  const fresh = rows
    .map((r, i) => ({ row: r, sheetRow: firstRow + i }))
    .filter(x => !String(x.row[idIdx]).trim() && (cell(x.row, 'DEFECT') || cell(x.row, 'ORIENTATION')));

  const now = new Date().toISOString();

  // Edited rows: patch only the edited columns into the current data.
  if (existing.length > 0) {
    const current = fetchByIds_(existing.map(r => String(r[idIdx]).trim()));
    const updates = [];
    existing.forEach(r => {
      const id = String(r[idIdx]).trim();
      const data = current[id];
      if (!data) return; // deleted in the app meanwhile
      applyRow_(data, r, headers, editedHeaders);
      updates.push({ id: id, data: data, client_id: 'google-sheet', updated_at: now });
    });
    // Upsert only touches the columns sent, so `position` of existing rows is kept.
    upsert_(updates);
  }

  // Many rows without ID at once is almost always a paste without the ID column, which would
  // duplicate every defect. Those are not created from an edit; the menu send asks first.
  if (fresh.length > MAX_NEW_ROWS_PER_EDIT && !allowManyNew) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      fresh.length + ' filas sin ID no se crearon en la web (¿se pegaron sin la columna ID?). ' +
        'Si de verdad son defectos nuevos, usa Cronulla → Enviar la planilla a la web.',
      'Cronulla',
      30
    );
    PropertiesService.getScriptProperties().setProperty('pushFailed', 'filas sin ID');
    return;
  }

  // New rows: create defects at the end of the list and write their IDs back.
  if (fresh.length > 0) {
    let position = fetchMaxPosition_() + 1;
    const inserts = fresh.map((x, i) => {
      const item = emptyItem_('defect-sheet-' + Date.now() + '-' + i);
      applyRow_(item, x.row, headers, headers);
      return { id: item.id, position: position++, data: item, client_id: 'google-sheet', updated_at: now };
    });
    upsert_(inserts);
    fresh.forEach((x, i) => sheet.getRange(x.sheetRow, idIdx + 1).setValue(inserts[i].id));
    writeSnapshot_(readSnapshot_().concat(inserts.map(r => r.id)));
  }
}

// Every object in one bulk request must have the same keys, so callers batch by shape.
function upsert_(rows) {
  // The same ID twice in one request makes the database reject all of it: keep the last one.
  const byId = {};
  rows.forEach(r => (byId[r.id] = r));
  rows = Object.keys(byId).map(id => byId[id]);
  for (let i = 0; i < rows.length; i += 300) {
    UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects', {
      method: 'post',
      contentType: 'application/json',
      headers: headers_({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      payload: JSON.stringify(rows.slice(i, i + 300)),
    });
  }
}

function applyRow_(item, row, headers, editedHeaders) {
  const value = h => String(row[headers.indexOf(h)]).trim();
  let photosEdited = false;

  editedHeaders.forEach(h => {
    if (/^PHOTO\s*\d$/.test(h)) {
      photosEdited = true;
    } else if (h === 'CUSTOM TAGS') {
      item.customTags = value(h).split(';').map(t => t.trim()).filter(Boolean);
    } else if (FIELDS[h]) {
      const field = FIELDS[h];
      let v = value(h);
      if (field === 'urgency') {
        v = URGENCY_VALUES[v.toUpperCase()];
        if (!v) return; // unknown value: keep the current one
      } else if (field === 'status') {
        v = STATUS_VALUES[v.toUpperCase()];
        if (!v) return;
      } else if (UPPERCASE_FIELDS.indexOf(field) >= 0) {
        v = v.toUpperCase();
      }
      item[field] = v;
    }
  });

  if (photosEdited) {
    const slots = [];
    for (let n = 1; n <= 9; n++) slots.push(headers.indexOf('PHOTO ' + n) >= 0 ? value('PHOTO ' + n) : '');
    const current = normalizePhotos_(item.photos);
    const photos = [];
    PHOTO_PHASES.forEach(([phase, offset]) => {
      slots.slice(offset, offset + 3).filter(Boolean).forEach(url => photos.push({ url: url, phase: phase }));
      // The sheet only shows 3 photos per phase; keep any extra ones the app has.
      current.filter(p => p.phase === phase).slice(3).forEach(p => photos.push({ url: p.url, phase: phase }));
    });
    // Photos that stay in their phase keep who put them there, and when (set by the web).
    const known = {};
    current.forEach(p => (known[p.phase + '|' + p.url] = p));
    item.photos = photos.map((p, i) => {
      const k = known[p.phase + '|' + p.url];
      const photo = { url: p.url, phase: p.phase, slot: i + 1 };
      if (k && k.by) Object.assign(photo, { by: k.by, date: k.date || '', time: k.time || '' });
      return photo;
    });
    // The status follows the photos (as in the web), unless STATUS was edited too.
    if (editedHeaders.indexOf('STATUS') < 0 && item.photos.length > 0) {
      const has = ph => item.photos.some(p => p.phase === ph);
      item.status = has('COMPLETED') ? 'COMPLETED' : has('IN PROGRESS') ? 'IN PROGRESS' : 'BEFORE';
    }
  }
}

function emptyItem_(id) {
  return {
    id: id, rowNo: '', projectName: '', orientation: '', defect: '', urgency: 'LOW', drop: '', level: '',
    photos: [], status: 'BEFORE', technicianStart: '', date1stPhoto: '', time1stPhoto: '',
    technicianDuring: '', dateDuring: '', timeDuring: '',
    technicianCompleted: '', dateCompleted: '', timeCompleted: '', mapping: '', comment: '',
    baseM: '', heightM: '', linearMeters: '', quantity: '', customTags: [],
  };
}

function fetchByIds_(ids) {
  const byId = {};
  fetchRowsByIds_(ids).forEach(r => (byId[r.id] = r.data));
  return byId;
}

// Apps Script caps URL length (~2 KB): ID lists go in small batches, and for many IDs the whole
// table is read page by page instead. (Batches of 100 made multi-row edits fail silently.)
const ID_BATCH = 30;

function fetchRowsByIds_(ids) {
  if (ids.length > 300) {
    const wanted = new Set(ids);
    return fetchAllRows_().filter(r => wanted.has(r.id));
  }
  const rows = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const res = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/defects?select=id,position,data&id=in.(' + idList_(ids.slice(i, i + ID_BATCH)) + ')',
      { headers: headers_() }
    );
    JSON.parse(res.getContentText()).forEach(r => rows.push(r));
  }
  return rows;
}

function fetchAllRows_() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/defects?select=id,position,data&order=position.asc,id.asc&offset=' + from + '&limit=' + PAGE_SIZE,
      { headers: headers_() }
    );
    const page = JSON.parse(res.getContentText());
    page.forEach(r => rows.push(r));
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function deleteByIds_(ids) {
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects?id=in.(' + idList_(ids.slice(i, i + ID_BATCH)) + ')', {
      method: 'delete',
      headers: headers_(),
    });
  }
}

function idList_(ids) {
  return encodeURIComponent(ids.map(id => '"' + String(id).replace(/"/g, '') + '"').join(','));
}

function fetchMaxPosition_() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects?select=position&order=position.desc&limit=1', {
    headers: headers_(),
  });
  const rows = JSON.parse(res.getContentText());
  return rows[0] ? rows[0].position : -1;
}

// ─────────────────────────── Row deletions ───────────────────────────

/** Installable onChange trigger (installed by `setup`): propagates deleted rows to the app. */
function onSheetChange(e) {
  if (!e || e.changeType !== 'REMOVE_ROW') return;
  const sheet = getSheet_();
  const idIdx = readHeaders_(sheet).indexOf(ID_HEADER);
  if (idIdx < 0) return;

  // Read what's left right away, before a concurrent rewrite could restore the rows.
  const remaining = new Set(readColumn_(sheet, idIdx + 1));

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const known = readSnapshot_();
    // Only IDs the sheet was showing: rows the app added since the last rewrite are never touched.
    const removed = known.filter(id => !remaining.has(id));
    if (removed.length === 0) return;

    const rows = fetchRowsByIds_(removed);
    appendTrash_(rows);
    deleteByIds_(removed);
    writeSnapshot_(known.filter(id => remaining.has(id)));
  } finally {
    lock.releaseLock();
  }
}

/** Menu action: re-creates the most recent batch of rows deleted from the sheet. */
function restoreLastDeletion() {
  const trash = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRASH_SHEET);
  const ui = SpreadsheetApp.getUi();
  if (!trash || trash.getLastRow() < 2) {
    ui.alert('No hay borrados para restaurar.');
    return;
  }
  const values = trash.getRange(2, 1, trash.getLastRow() - 1, 4).getValues();
  const batch = String(values[values.length - 1][0]);
  const rowsIdx = [];
  values.forEach((v, i) => {
    if (String(v[0]) === batch) rowsIdx.push(i);
  });

  const now = new Date().toISOString();
  const rows = rowsIdx.map(i => ({
    id: String(values[i][1]),
    position: Number(values[i][2]),
    data: JSON.parse(values[i][3]),
    client_id: 'google-sheet',
    updated_at: now,
  }));

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (let i = 0; i < rows.length; i += 500) upsert_(rows.slice(i, i + 500));
    // Drop the restored batch from the trash (they are the last rows).
    trash.deleteRows(rowsIdx[0] + 2, rowsIdx.length);
  } finally {
    lock.releaseLock();
  }
  syncNow();
  ui.alert(rows.length + ' fila(s) restaurada(s).');
}

function appendTrash_(rows) {
  if (rows.length === 0) return;
  const trash = helperSheet_(TRASH_SHEET, ['BORRADO', 'ID', 'POSITION', 'DATA']);
  const batch = new Date().toISOString();
  const values = rows.map(r => [batch, r.id, r.position, JSON.stringify(r.data)]);
  trash.getRange(trash.getLastRow() + 1, 1, values.length, 4).setValues(values);
}

function readSnapshot_() {
  const snap = helperSheet_(SNAPSHOT_SHEET, ['ID']);
  return snap.getLastRow() < 2 ? [] : readColumn_(snap, 1);
}

function writeSnapshot_(ids) {
  const snap = helperSheet_(SNAPSHOT_SHEET, ['ID']);
  if (snap.getLastRow() > 1) snap.getRange(2, 1, snap.getLastRow() - 1, 1).clearContent();
  if (ids.length > 0) snap.getRange(2, 1, ids.length, 1).setValues(ids.map(id => [id]));
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

function readColumn_(sheet, col) {
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, col, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(r => String(r[0]).trim())
    .filter(Boolean);
}

// ───────────────────────────── Helpers ─────────────────────────────

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sheet) throw new Error('No existe la pestaña "' + SHEET_NAME + '"');
  return sheet;
}

function readHeaders_(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(h => String(h).trim().toUpperCase());
}

function ensureIdColumn_(sheet) {
  if (readHeaders_(sheet).indexOf(ID_HEADER) >= 0) return;
  sheet.getRange(1, sheet.getLastColumn() + 1).setValue(ID_HEADER);
}

// Who added the latest During photo, and when: three columns placed right after TIME 1ST PHOTO.
const DURING_HEADERS = ['TECHNICIAN DURING', 'DATE DURING', 'TIME DURING'];

function ensureDuringColumns_(sheet) {
  const headers = readHeaders_(sheet);
  if (DURING_HEADERS.every(h => headers.indexOf(h) >= 0)) return;
  const after = headers.indexOf('TIME 1ST PHOTO');
  const missing = DURING_HEADERS.filter(h => headers.indexOf(h) < 0);
  const col = after >= 0 ? after + 1 : sheet.getLastColumn();
  sheet.insertColumnsAfter(col, missing.length);
  sheet.getRange(1, col + 1, 1, missing.length).setValues([missing]);
}

// Rows whose STATUS is COMPLETED are shown green (the same green as Sheets' default rules).
const COMPLETED_GREEN = '#b7e1cd';

function ensureCompletedHighlight_(sheet) {
  const statusIdx = readHeaders_(sheet).indexOf('STATUS');
  if (statusIdx < 0) return;
  const col = sheet.getRange(1, statusIdx + 1).getA1Notation().replace(/\d+/g, '');
  const formula = '=$' + col + '2="COMPLETED"';
  const range = sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), sheet.getMaxColumns());
  // Replace an earlier version of this rule (the STATUS column or the sheet size may have changed).
  const rules = sheet.getConditionalFormatRules().filter(r => {
    const c = r.getBooleanCondition();
    const f = c && c.getCriteriaType() === SpreadsheetApp.BooleanCriteria.CUSTOM_FORMULA ? String(c.getCriteriaValues()[0]) : '';
    return !/^=\$[A-Z]+2="COMPLETED"$/.test(f);
  });
  rules.unshift(
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setBackground(COMPLETED_GREEN).setRanges([range]).build()
  );
  sheet.setConditionalFormatRules(rules);
}

function renameHeader_(sheet, from, to) {
  const c = readHeaders_(sheet).indexOf(from);
  if (c >= 0) sheet.getRange(1, c + 1).setValue(to);
}

function headers_(extra) {
  return Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, extra || {});
}

// ─────────────────────── Whole sheet → app (menu) ───────────────────────

// Dates and times are left out of the bulk comparison: Sheets reformats them on its own
// (e.g. 17/08/2026 shown as 8/17/2026), which would look like edits.
const BULK_SKIP = ['DATE START', 'DATE 1ST PHOTO', 'TIME 1ST PHOTO', 'DATE DURING', 'TIME DURING', 'DATE COMPLETED', 'TIME COMPLETED'];

/**
 * Menu action: compares every row of the sheet with the web and sends what differs (the sheet
 * wins). Use it after pasting or editing many rows, or if edits did not reach the web.
 */
function sendSheetToWeb() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) return ui.alert('Hay otra sincronización en curso. Intenta en un minuto.');
  try {
    const sheet = getSheet_();
    const headers = readHeaders_(sheet);
    const idIdx = headers.indexOf(ID_HEADER);
    const n = sheet.getLastRow() - 1;
    if (idIdx < 0 || n < 1) return ui.alert('No hay filas.');
    const rows = sheet.getRange(2, 1, n, headers.length).getDisplayValues();
    const web = {};
    fetchAllRows_().forEach(r => (web[r.id] = r.data));

    const tracked = headers.filter(h => h && h !== ID_HEADER && BULK_SKIP.indexOf(h) < 0 && (FIELDS[h] || /^PHOTO\s*\d$/.test(h) || h === 'CUSTOM TAGS'));
    const photoKey = item => normalizePhotos_(item.photos).map(p => p.phase + '|' + p.url).sort().join(',');
    const now = new Date().toISOString();
    const updates = [];
    const examples = [];
    const fresh = [];
    // Rows sharing an ID: there's no telling which one is the original, so none are sent.
    const rowsOf = {};
    rows.forEach((row, i) => {
      const id = String(row[idIdx]).trim();
      if (id) (rowsOf[id] = rowsOf[id] || []).push(i + 2);
    });
    const repeated = Object.keys(rowsOf)
      .filter(id => rowsOf[id].length > 1)
      .map(id => 'Filas ' + rowsOf[id].join(', ') + ' tienen el mismo ID');

    rows.forEach((row, i) => {
      const id = String(row[idIdx]).trim();
      if (!id) {
        const value = h => String(row[headers.indexOf(h)] || '').trim();
        if (value('DEFECT') || value('ORIENTATION')) fresh.push(i);
        return;
      }
      if (rowsOf[id].length > 1) return;
      const current = web[id];
      if (!current) return; // deleted in the web
      const data = JSON.parse(JSON.stringify(current));
      applyRow_(data, row, headers, tracked);
      const photosChanged = photoKey(data) !== photoKey(current);
      if (!photosChanged) data.photos = current.photos;
      const changed = tracked.filter(h => {
        if (/^PHOTO/.test(h)) return photosChanged;
        if (h === 'CUSTOM TAGS') return (data.customTags || []).join(';') !== (current.customTags || []).join(';');
        const f = FIELDS[h];
        return String(data[f] === undefined ? '' : data[f]) !== String(current[f] === undefined ? '' : current[f]);
      });
      if (changed.length === 0) return;
      updates.push({ id: id, data: data, client_id: 'google-sheet', updated_at: now });
      if (examples.length < 12) {
        const names = changed.map(h => (/^PHOTO/.test(h) ? 'FOTOS' : h)).filter((h, k, a) => a.indexOf(h) === k);
        examples.push('Fila ' + (i + 2) + ' (No ' + (data.rowNo || '—') + '): ' + names.slice(0, 4).join(', '));
      }
    });

    const repeatedNote = repeated.length
      ? '\n\nNo se enviaron filas con ID repetido. En la copia (el defecto nuevo) borra el ID de la última columna y vuelve a enviar:\n' +
        repeated.slice(0, 10).join('\n') + (repeated.length > 10 ? '\n…' : '')
      : '';
    if (updates.length === 0 && fresh.length === 0) {
      if (!repeated.length) PropertiesService.getScriptProperties().deleteProperty('pushFailed');
      return ui.alert('La web ya tiene todo lo que hay en la planilla. No hay nada que enviar.' + repeatedNote);
    }
    const ok = ui.alert(
      'Enviar la planilla a la web',
      updates.length + ' filas tienen cambios que la web no tiene' + (fresh.length ? ' y hay ' + fresh.length + ' filas nuevas' : '') + ':\n\n' +
        examples.join('\n') + (updates.length > examples.length ? '\n…' : '') +
        '\n\nLos valores de la planilla reemplazarán a los de la web. ¿Enviar?' + repeatedNote,
      ui.ButtonSet.YES_NO
    );
    if (ok !== ui.Button.YES) return;

    upsert_(updates);
    // New rows (no ID yet) are created the same way as when typed one by one.
    fresh.forEach(i => pushRows_(sheet, i + 2, [rows[i]], headers, headers, true));
    if (!repeated.length) PropertiesService.getScriptProperties().deleteProperty('pushFailed');
    ui.alert(updates.length + ' filas actualizadas' + (fresh.length ? ' y ' + fresh.length + ' creadas' : '') + ' en la web.' + repeatedNote);
  } finally {
    lock.releaseLock();
  }
}
