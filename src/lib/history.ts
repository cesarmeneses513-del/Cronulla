import { supabase } from './supabase';
import { DefectItem, PhotoPhase } from '../types/inspection';
import { PHASE_LABEL, STATUS_LABEL, URGENCY_LABEL, TFunction } from '../i18n';

const TABLE = 'defect_history';
// Actions touching more rows than this (imports, bulk deletes) are logged as one summary entry.
const BULK_LIMIT = 25;

export interface HistoryRecord {
  id?: number;
  created_at?: string;
  user_name: string;
  action: string;
  defect_id: string | null;
  row_no: string | null;
  details: Record<string, any>;
}

type NewRecord = Omit<HistoryRecord, 'id' | 'created_at' | 'user_name'>;

// Fields compared for "edit" entries, with the label shown in the history panel.
const FIELDS: { key: keyof DefectItem; label: string }[] = [
  { key: 'rowNo', label: 'Nº fila' },
  { key: 'status', label: 'Estado' },
  { key: 'urgency', label: 'Urgencia' },
  { key: 'defect', label: 'Defecto' },
  { key: 'orientation', label: 'Stage' },
  { key: 'drop', label: 'Drop' },
  { key: 'level', label: 'Nivel' },
  { key: 'projectName', label: 'Proyecto' },
  { key: 'comment', label: 'Comentario' },
  { key: 'technicianStart', label: 'Técnico inicio' },
  { key: 'date1stPhoto', label: 'Fecha inicio' },
  { key: 'technicianCompleted', label: 'Técnico final' },
  { key: 'dateCompleted', label: 'Fecha final' },
  { key: 'linearMeters', label: 'Metros Lineales (m)' },
  { key: 'baseM', label: 'Base' },
  { key: 'heightM', label: 'Alto' },
  { key: 'quantity', label: 'Cantidad:' },
  { key: 'customTags', label: 'Etiquetas' },
];

const phaseOf = (photo: DefectItem['photos'][number], idx: number): PhotoPhase =>
  typeof photo === 'string' ? (idx >= 6 ? 'COMPLETED' : idx >= 3 ? 'IN PROGRESS' : 'BEFORE') : photo.phase;

const photoMap = (item: DefectItem) =>
  new Map(item.photos.map((p, idx) => [typeof p === 'string' ? p : p.url, phaseOf(p, idx)] as const));

// Inline (offline) photos are data URLs; too big to keep in the log.
const loggableUrl = (url: string) => (url.startsWith('data:') ? undefined : url);

const fieldValue = (item: DefectItem, key: keyof DefectItem) => {
  const v = item[key];
  return Array.isArray(v) ? v.join('; ') : String(v ?? '');
};

// Turns one editor action (list before → list after) into readable history entries.
export function diffForHistory(before: DefectItem[], after: DefectItem[], label: string): NewRecord[] {
  const beforeById = new Map(before.map(i => [i.id, i]));
  const afterIds = new Set(after.map(i => i.id));

  const added = after.filter(i => !beforeById.has(i.id));
  const removed = before.filter(i => !afterIds.has(i.id));
  const changed = after.filter(i => beforeById.has(i.id) && beforeById.get(i.id) !== i);

  if (added.length + removed.length + changed.length > BULK_LIMIT) {
    return [
      {
        action: 'bulk',
        defect_id: null,
        row_no: null,
        details: { label, added: added.length, removed: removed.length, changed: changed.length },
      },
    ];
  }

  const records: NewRecord[] = [];

  // Photos that left one row and appeared in another in the same action were moved.
  const lost = new Map<string, DefectItem>();
  const gained = new Map<string, DefectItem>();
  changed.forEach(item => {
    const b = photoMap(beforeById.get(item.id)!);
    const a = photoMap(item);
    b.forEach((_, url) => !a.has(url) && lost.set(url, item));
    a.forEach((_, url) => !b.has(url) && gained.set(url, item));
  });
  const moved = new Set([...lost.keys()].filter(url => gained.has(url)));

  changed.forEach(item => {
    const old = beforeById.get(item.id)!;
    const base = { defect_id: item.id, row_no: item.rowNo };
    const b = photoMap(old);
    const a = photoMap(item);
    let photoChange = false;

    a.forEach((phase, url) => {
      if (!b.has(url)) {
        photoChange = true;
        if (moved.has(url)) {
          records.push({
            ...base,
            action: 'photo_move',
            details: { from: lost.get(url)!.rowNo, to: item.rowNo, phase, url: loggableUrl(url) },
          });
        } else {
          records.push({ ...base, action: 'photo_add', details: { phase, url: loggableUrl(url) } });
        }
      } else if (b.get(url) !== phase) {
        photoChange = true;
        records.push({ ...base, action: 'photo_phase', details: { from: b.get(url), to: phase, url: loggableUrl(url) } });
      }
    });
    b.forEach((phase, url) => {
      if (!a.has(url)) {
        photoChange = true;
        if (!moved.has(url)) {
          records.push({ ...base, action: 'photo_remove', details: { phase, url: loggableUrl(url) } });
        }
      }
    });
    if (!photoChange && old.photos !== item.photos && old.photos.length === item.photos.length) {
      const order = (i: DefectItem) => i.photos.map(p => (typeof p === 'string' ? p : p.url)).join('|');
      if (order(old) !== order(item)) records.push({ ...base, action: 'photo_reorder', details: {} });
    }

    FIELDS.forEach(({ key, label: field }) => {
      const from = fieldValue(old, key);
      const to = fieldValue(item, key);
      if (from !== to) records.push({ ...base, action: 'edit', details: { key, field, from, to } });
    });
  });

  added.forEach(item =>
    records.push({ action: 'add', defect_id: item.id, row_no: item.rowNo, details: { defect: item.defect } })
  );
  removed.forEach(item =>
    records.push({ action: 'delete', defect_id: item.id, row_no: item.rowNo, details: { defect: item.defect } })
  );

  return records;
}

// Set once the table turns out to be missing, so the app stops trying (and the panel can explain).
let historyUnavailable = false;
export const isHistoryUnavailable = () => historyUnavailable;

const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205' || /defect_history/.test(error.message || '');

export async function logHistory(userName: string, records: NewRecord[]): Promise<void> {
  if (!supabase || historyUnavailable || records.length === 0) return;
  const { error } = await supabase.from(TABLE).insert(records.map(r => ({ ...r, user_name: userName })));
  if (error) {
    if (isMissingTable(error)) historyUnavailable = true;
    console.warn('Failed to write change history', error);
  }
}

export async function fetchHistory(limit: number, olderThan?: string): Promise<HistoryRecord[]> {
  if (!supabase) return [];
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (olderThan) query = query.lt('created_at', olderThan);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) historyUnavailable = true;
    throw error;
  }
  return data as HistoryRecord[];
}

// Deletes every entry. Returns how many were deleted: 0 with entries present means the
// delete policy (supabase/history-clear.sql) hasn't been added yet.
export async function clearHistory(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.from(TABLE).delete().gte('id', 0).select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

export function subscribeToHistory(onInsert: (record: HistoryRecord) => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('history-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, payload =>
      onInsert(payload.new as HistoryRecord)
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

const displayValue = (key: string | undefined, value: string, t: TFunction) => {
  if (!value) return '—';
  if (key === 'status') return t(STATUS_LABEL[value] || value);
  if (key === 'urgency') return t(URGENCY_LABEL[value] || value);
  return value.length > 60 ? `${value.slice(0, 60)}…` : value;
};

export function describeHistory(r: HistoryRecord, t: TFunction): string {
  const d = r.details || {};
  const phase = (p: string) => t(PHASE_LABEL[p] || p);
  switch (r.action) {
    case 'photo_add':
      return t('subió una foto ({phase})', { phase: phase(d.phase) });
    case 'photo_remove':
      return t('quitó una foto ({phase})', { phase: phase(d.phase) });
    case 'photo_move':
      return t('movió una foto de la fila #{from} a la #{to}', { from: d.from, to: d.to });
    case 'photo_phase':
      return t('cambió la fase de una foto: {from} → {to}', { from: phase(d.from), to: phase(d.to) });
    case 'photo_reorder':
      return t('reordenó las fotos');
    case 'edit':
      return t('cambió {field}: "{from}" → "{to}"', {
        field: t(d.field).replace(/:$/, ''),
        from: displayValue(d.key, d.from, t),
        to: displayValue(d.key, d.to, t),
      });
    case 'add':
    case 'sheet_add':
      return t('creó el defecto ({defect})', { defect: d.defect || '' });
    case 'delete':
      return t('eliminó el defecto ({defect})', { defect: d.defect || '' });
    case 'undo':
      return t('deshizo: {label}', { label: d.label || '' });
    case 'bulk':
      return t('{label}: {added} nuevos, {removed} eliminados, {changed} modificados', {
        label: d.label || '',
        added: d.added ?? 0,
        removed: d.removed ?? 0,
        changed: d.changed ?? 0,
      });
    case 'sheet_edit':
      return t('editó en Google Sheet: {fields}', { fields: (d.fields || []).join(', ') });
    default:
      return r.action;
  }
}
