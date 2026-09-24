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
const FIELDS = {
  'NO': 'rowNo',
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
  'DATE 1ST PHOTO': 'date1stPhoto',
  'TIME 1ST PHOTO': 'time1stPhoto',
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
  SpreadsheetApp.getUi()
    .createMenu('Cronulla')
    .addItem('Actualizar ahora', 'syncNow')
    .addItem('Restaurar último borrado', 'restoreLastDeletion')
    .addToUi();
}

/** Menu action: always rewrites, ignoring the change check. */
function syncNow() {
  PropertiesService.getScriptProperties().deleteProperty('signature');
  syncIfChanged();
}

// ───────────────────────────── App → sheet ─────────────────────────────

function syncIfChanged() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // an edit push or previous run is in progress
  try {
    const signature = fetchSignature_();
    const props = PropertiesService.getScriptProperties();
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
  const field = FIELDS[header];
  return field ? item[field] : '';
}

function writeRows_(items) {
  const sheet = getSheet_();
  ensureIdColumn_(sheet);
  const headers = readHeaders_(sheet);
  const width = headers.length;

  const values = items.map(item => {
    const slots = photoSlots_(item);
    return headers.map(h => {
      const v = columnValue_(h, item, slots);
      return v === undefined || v === null ? '' : v;
    });
  });

  const oldRows = Math.max(sheet.getLastRow() - 1, 0);
  if (values.length > 0) sheet.getRange(2, 1, values.length, width).setValues(values);
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
    if (h && h !== ID_HEADER) editedHeaders.push(h);
  }
  if (editedHeaders.length === 0) return;

  // Read the edited rows right away, before waiting for the lock, so a concurrent
  // app → sheet rewrite can't replace what the user just typed.
  const rows = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, headers.length).getDisplayValues();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    pushRows_(sheet, firstRow, rows, headers, editedHeaders);
  } finally {
    lock.releaseLock();
  }
}

function pushRows_(sheet, firstRow, rows, headers, editedHeaders) {
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
  if (rows.length === 0) return;
  UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects', {
    method: 'post',
    contentType: 'application/json',
    headers: headers_({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    payload: JSON.stringify(rows),
  });
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
    item.photos = photos.map((p, i) => ({ url: p.url, phase: p.phase, slot: i + 1 }));
  }
}

function emptyItem_(id) {
  return {
    id: id, rowNo: '', projectName: '', orientation: '', defect: '', urgency: 'LOW', drop: '', level: '',
    photos: [], status: 'BEFORE', technicianStart: '', date1stPhoto: '', time1stPhoto: '',
    technicianCompleted: '', dateCompleted: '', timeCompleted: '', mapping: '', comment: '',
    baseM: '', heightM: '', linearMeters: '', quantity: '', customTags: [],
  };
}

function fetchByIds_(ids) {
  const byId = {};
  fetchRowsByIds_(ids).forEach(r => (byId[r.id] = r.data));
  return byId;
}

function fetchRowsByIds_(ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 100) {
    const res = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/defects?select=id,position,data&id=in.(' + idList_(ids.slice(i, i + 100)) + ')',
      { headers: headers_() }
    );
    JSON.parse(res.getContentText()).forEach(r => rows.push(r));
  }
  return rows;
}

function deleteByIds_(ids) {
  for (let i = 0; i < ids.length; i += 100) {
    UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/defects?id=in.(' + idList_(ids.slice(i, i + 100)) + ')', {
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

function headers_(extra) {
  return Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, extra || {});
}
