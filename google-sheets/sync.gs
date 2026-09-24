/**
 * Cronulla → Google Sheets mirror.
 *
 * Paste into the spreadsheet's Extensions → Apps Script, then run `setup` once.
 * Every minute it checks Supabase and, only if something changed, rewrites the data rows
 * of SHEET_NAME. Columns are matched by their header text (row 1), so their order in the
 * sheet doesn't matter; columns it doesn't recognise are left empty.
 *
 * One-way: app → sheet. Manual edits to the data rows are overwritten on the next change.
 */

const SUPABASE_URL = 'https://jawmcsrcgqvndjhhvovl.supabase.co';
// Publishable key: read-only use here, same key the web app ships to browsers.
const SUPABASE_KEY = 'sb_publishable_C5fy8k5sNRW0F5ZBsJDEDw_k8DRptZJ';

// Tab to write into. Empty = the first tab of the spreadsheet.
const SHEET_NAME = '';

const PAGE_SIZE = 1000;

/** Run once: installs the 1-minute trigger and the menu, then does a first sync. */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncIfChanged')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncIfChanged').timeBased().everyMinutes(1).create();
  syncNow();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Cronulla')
    .addItem('Actualizar ahora', 'syncNow')
    .addToUi();
}

/** Menu action: always rewrites, ignoring the change check. */
function syncNow() {
  PropertiesService.getScriptProperties().deleteProperty('signature');
  syncIfChanged();
}

function syncIfChanged() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // a previous run is still writing
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

function headers_(extra) {
  return Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, extra || {});
}

// Same photo layout as the app's CSV export: PHOTO 1-3 BEFORE, 4-6 IN PROGRESS, 7-9 COMPLETED.
function photoSlots_(item) {
  const slots = ['', '', '', '', '', '', '', '', ''];
  const photos = (item.photos || []).map((p, i) =>
    typeof p === 'string' ? { url: p, phase: i >= 6 ? 'COMPLETED' : i >= 3 ? 'IN PROGRESS' : 'BEFORE' } : p
  );
  [['BEFORE', 0], ['IN PROGRESS', 3], ['COMPLETED', 6]].forEach(([phase, offset]) => {
    photos.filter(p => p.phase === phase).slice(0, 3).forEach((p, i) => (slots[offset + i] = p.url));
  });
  return slots;
}

// Header text (trimmed, upper-case) → value for one defect.
function columnValue_(header, item, slots) {
  const photo = header.match(/^PHOTO\s*(\d)$/);
  if (photo) return slots[Number(photo[1]) - 1] || '';
  switch (header) {
    case 'NO': return item.rowNo;
    case 'NAME PROYECT':
    case 'NAME PROJECT':
    case 'NAME PROJECT:': return item.projectName;
    case 'ORIENTATION': return item.orientation;
    case 'DEFECT': return item.defect;
    case 'URGENCY': return item.urgency;
    case 'DROP': return item.drop;
    case 'LEVEL': return item.level;
    case 'STATUS': return item.status;
    case 'TECHNICIAN START': return item.technicianStart;
    case 'DATE 1ST PHOTO': return item.date1stPhoto;
    case 'TIME 1ST PHOTO': return item.time1stPhoto;
    case 'TECHNICIAN COMPLETED': return item.technicianCompleted;
    case 'DATE COMPLETED': return item.dateCompleted;
    case 'TIME COMPLETED': return item.timeCompleted;
    case 'MAPPING': return item.mapping;
    case 'COMMENT': return item.comment;
    case 'BASE (M)': return item.baseM;
    case 'HEIGHT (M)': return item.heightM;
    case 'LINEAR METERS': return item.linearMeters;
    case 'QUANTITY': return item.quantity;
    case 'CUSTOM TAGS': return (item.customTags || []).join(';');
    default: return '';
  }
}

function writeRows_(items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sheet) throw new Error('No existe la pestaña "' + SHEET_NAME + '"');

  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(h => String(h).trim().toUpperCase());

  const values = items.map(item => {
    const slots = photoSlots_(item);
    return headers.map(h => {
      const v = columnValue_(h, item, slots);
      return v === undefined || v === null ? '' : v;
    });
  });

  const oldRows = Math.max(sheet.getLastRow() - 1, 0);
  if (values.length > 0) sheet.getRange(2, 1, values.length, width).setValues(values);
  // Clear leftovers when the app now has fewer rows than the sheet.
  if (oldRows > values.length) sheet.getRange(values.length + 2, 1, oldRows - values.length, width).clearContent();
}
