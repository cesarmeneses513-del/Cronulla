import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DefectItem } from '../types/inspection';
import { shrinkPhoto } from './shrinkPhoto';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Null when env vars are missing: the app then falls back to localStorage only.
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

const TABLE = 'defects';
const PHOTO_BUCKET = 'inspection-photos';
const WRITE_CHUNK = 500;
const DELETE_CHUNK = 100;

// Identifies this browser tab so realtime events caused by our own writes can be skipped.
const CLIENT_ID = crypto.randomUUID();

interface DefectRow {
  id: string;
  position: number;
  data: DefectItem;
  client_id?: string | null;
  modified_at?: string | null;
  modified_by?: string | null;
}

// `modifiedAt`/`modifiedBy` come from their own columns (kept by the database), not from `data`.
const withModified = (r: DefectRow): DefectItem => {
  if (!r.modified_at && !r.modified_by) return r.data;
  const item = { ...r.data };
  if (r.modified_at) item.modifiedAt = r.modified_at;
  if (r.modified_by) item.modifiedBy = r.modified_by;
  return item;
};
export const withoutModified = (item: DefectItem): DefectItem => {
  if (!('modifiedAt' in item) && !('modifiedBy' in item)) return item;
  const { modifiedAt: _at, modifiedBy: _by, ...rest } = item;
  return rest;
};
// Extra columns to read, dropped one by one if the database doesn't have them yet
// (supabase/modified-at.sql, supabase/modified-by.sql).
const EXTRA_COLUMNS = [', modified_at, modified_by', ', modified_at', ''];
let extra = 0;

export async function fetchDefects(): Promise<DefectItem[]> {
  if (!supabase) throw new Error('Supabase no configurado');
  // PostgREST caps each response (1000 rows by default), so page through the table.
  const PAGE = 1000;
  const rows: DefectRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, position, data' + EXTRA_COLUMNS[extra])
      .order('position')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error && from === 0 && extra < EXTRA_COLUMNS.length - 1) {
      extra++;
      return fetchDefects();
    }
    if (error) throw error;
    rows.push(...(data as unknown as DefectRow[]));
    if (data.length < PAGE) break;
  }
  return rows.map(withModified);
}

// Numbers every defect 1, 2, 3… in Stage, Drop, Level order (supabase/renumber.sql).
export async function renumberDefects(): Promise<void> {
  if (!supabase) throw new Error('Supabase no configurado');
  // Administrators only once the database is closed (accounts-lockdown.sql); before that only the
  // plain function exists.
  const checked = await supabase.rpc('renumber_defects_checked');
  if (!checked.error) return;
  if (checked.error.code !== 'PGRST202') throw checked.error;
  const { error } = await supabase.rpc('renumber_defects');
  if (error) throw error;
}

export async function fetchDefectsByIds(ids: string[]): Promise<Map<string, DefectItem>> {
  const found = new Map<string, DefectItem>();
  if (!supabase) return found;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    const select = (cols: string) => supabase!.from(TABLE).select(cols).in('id', chunk);
    let res = await select('id, data' + EXTRA_COLUMNS[extra]);
    while (res.error && extra < EXTRA_COLUMNS.length - 1) {
      extra++;
      res = await select('id, data' + EXTRA_COLUMNS[extra]);
    }
    if (res.error) throw res.error;
    (res.data as unknown as DefectRow[]).forEach(r => found.set(r.id, withModified(r)));
  }
  return found;
}

type Photo = DefectItem['photos'][number];
const photoUrl = (p: Photo) => (typeof p === 'string' ? p : p.url);
// Key order doesn't matter: rows read back from the database come with their keys reordered.
const stable = (v: unknown) =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce<Record<string, unknown>>((o, k) => ((o[k] = (val as Record<string, unknown>)[k]), o), {})
      : val
  );
const same = (a: unknown, b: unknown) => a === b || stable(a) === stable(b);

// Same defect data, ignoring the change time / person (kept by the database).
export const sameData = (a: DefectItem, b: DefectItem) => same(withoutModified(a), withoutModified(b));

// Photos: keep everyone's. Ours win for the ones we added or changed; ones we removed stay removed.
function mergePhotos(base: Photo[], mine: Photo[], theirs: Photo[]): Photo[] {
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  const baseByUrl = new Map(base.map(p => [photoUrl(p), p]));
  const mineByUrl = new Map(mine.map(p => [photoUrl(p), p]));
  const removed = new Set(base.map(photoUrl).filter(u => !mineByUrl.has(u)));
  const result = theirs
    .filter(p => !removed.has(photoUrl(p)))
    .map(p => {
      const m = mineByUrl.get(photoUrl(p));
      return m && !same(m, baseByUrl.get(photoUrl(p))) ? m : p;
    });
  const inResult = new Set(result.map(photoUrl));
  mine.forEach(p => {
    if (!inResult.has(photoUrl(p)) && !baseByUrl.has(photoUrl(p))) result.push(p);
  });
  return result;
}

// Three-way merge of one row: fields we changed since `base` come from `mine`, the rest from the
// database, so a phone with an older copy never undoes what someone else saved meanwhile.
export function mergeItem(base: DefectItem, mine: DefectItem, theirs: DefectItem): DefectItem {
  const merged = { ...theirs } as Record<string, unknown>;
  const b = base as unknown as Record<string, unknown>;
  const m = mine as unknown as Record<string, unknown>;
  Object.keys(m).forEach(k => {
    if (k === 'photos') return;
    if (!same(m[k], b[k])) merged[k] = m[k];
  });
  merged.photos = mergePhotos(base.photos || [], mine.photos || [], theirs.photos || []);
  return merged as unknown as DefectItem;
}

// Persist the difference between two snapshots: upsert new/changed rows, delete removed ones.
// Changed rows are merged with the database's current version first; returns the rows that
// ended up different from `next` (someone else had changed them), so the caller can show them.
// `normalize` brings database rows to the shape the app keeps (e.g. old string photos).
export async function syncDefects(
  prev: DefectItem[],
  next: DefectItem[],
  normalize: (items: DefectItem[]) => DefectItem[] = items => items
): Promise<DefectItem[]> {
  if (!supabase) return [];
  const prevById = new Map<string, { item: DefectItem; position: number }>();
  prev.forEach((item, position) => prevById.set(item.id, { item, position }));

  // The change time isn't part of the row's data: it's left out of comparisons and writes.
  const stamps = new Map<string, Pick<DefectItem, 'modifiedAt' | 'modifiedBy'>>();
  const upserts: DefectRow[] = [];
  // Rows whose data changed here (not just moved): they also carry who changed them.
  const edited = new Set<string>();
  next.forEach((item, position) => {
    const old = prevById.get(item.id);
    // Rows that only moved in the list are not written: the list is shown sorted by No, and
    // rewriting hundreds of rows for a new or deleted defect was slow and let a phone with an
    // older copy of a row overwrite it.
    if (!old || old.item !== item) {
      upserts.push({ id: item.id, position, data: withoutModified(item) });
      if (item.modifiedAt || item.modifiedBy) stamps.set(item.id, { modifiedAt: item.modifiedAt, modifiedBy: item.modifiedBy });
      if ((!old || old.item !== item) && item.modifiedBy) edited.add(item.id);
    }
  });

  const existing = upserts.filter(r => prevById.has(r.id)).map(r => r.id);
  const remote = existing.length > 0 ? await fetchDefectsByIds(existing) : new Map<string, DefectItem>();
  const changed: DefectItem[] = [];
  upserts.forEach(r => {
    const raw = remote.get(r.id);
    const theirs = raw && withoutModified(normalize([raw])[0]);
    const prevItem = prevById.get(r.id)?.item;
    const base = prevItem && withoutModified(prevItem);
    if (!theirs || !base || same(theirs, base)) return;
    const merged = mergeItem(base, r.data, theirs);
    if (!same(merged, r.data)) {
      r.data = merged;
      const stamp = stamps.get(r.id);
      changed.push(stamp ? { ...merged, ...stamp } : merged);
    }
  });

  const nextIds = new Set(next.map(i => i.id));
  const deletes = prev.filter(i => !nextIds.has(i.id)).map(i => i.id);

  // Chunked: bulk deletes put every id in the URL, which has a length limit.
  const now = new Date().toISOString();
  // Separate requests: in one bulk upsert every row gets the same columns, and rows that only
  // moved must not overwrite who last changed them.
  const withBy = extra === 0 ? upserts.filter(r => edited.has(r.id)) : [];
  const withoutBy = extra === 0 ? upserts.filter(r => !edited.has(r.id)) : upserts;
  for (let i = 0; i < withBy.length; i += WRITE_CHUNK) {
    const { error } = await supabase.from(TABLE).upsert(
      withBy.slice(i, i + WRITE_CHUNK).map(r => ({
        ...r,
        client_id: CLIENT_ID,
        updated_at: now,
        modified_by: stamps.get(r.id)?.modifiedBy,
      }))
    );
    if (error) throw error;
  }
  for (let i = 0; i < withoutBy.length; i += WRITE_CHUNK) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(withoutBy.slice(i, i + WRITE_CHUNK).map(r => ({ ...r, client_id: CLIENT_ID, updated_at: now })));
    if (error) throw error;
  }
  for (let i = 0; i < deletes.length; i += DELETE_CHUNK) {
    const { error } = await supabase.from(TABLE).delete().in('id', deletes.slice(i, i + DELETE_CHUNK));
    if (error) throw error;
  }
  return changed;
}

// client_id of the rows the database renumbers (supabase/renumber.sql): only their rowNo changed.
export const RENUMBER_CLIENT = 'renumber';

export function subscribeToDefects(
  onUpsert: (item: DefectItem, position: number, clientId?: string | null) => void,
  onDelete: (id: string) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('defects-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, payload => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as Partial<DefectRow>).id;
        if (id) onDelete(id);
      } else {
        const row = payload.new as DefectRow;
        if (row.client_id !== CLIENT_ID) onUpsert(withModified(row), row.position, row.client_id);
      }
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Uploads to Supabase Storage and returns a public URL; falls back to an inline data URL offline.
export async function uploadPhoto(original: File): Promise<string> {
  const file = await shrinkPhoto(original);
  if (!supabase) return readAsDataUrl(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) {
    console.warn('Photo upload failed, storing inline', error);
    return readAsDataUrl(file);
  }
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
