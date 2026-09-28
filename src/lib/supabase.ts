import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DefectItem } from '../types/inspection';

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
}

export async function fetchDefects(): Promise<DefectItem[]> {
  if (!supabase) throw new Error('Supabase no configurado');
  // PostgREST caps each response (1000 rows by default), so page through the table.
  const PAGE = 1000;
  const rows: DefectRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, position, data')
      .order('position')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as DefectRow[]));
    if (data.length < PAGE) break;
  }
  return rows.map(r => r.data);
}

export async function fetchDefectsByIds(ids: string[]): Promise<Map<string, DefectItem>> {
  const found = new Map<string, DefectItem>();
  if (!supabase) return found;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const { data, error } = await supabase.from(TABLE).select('id, data').in('id', ids.slice(i, i + DELETE_CHUNK));
    if (error) throw error;
    (data as DefectRow[]).forEach(r => found.set(r.id, r.data));
  }
  return found;
}

type Photo = DefectItem['photos'][number];
const photoUrl = (p: Photo) => (typeof p === 'string' ? p : p.url);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

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
function mergeItem(base: DefectItem, mine: DefectItem, theirs: DefectItem): DefectItem {
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

  const upserts: DefectRow[] = [];
  next.forEach((item, position) => {
    const old = prevById.get(item.id);
    if (!old || old.item !== item || old.position !== position) {
      upserts.push({ id: item.id, position, data: item });
    }
  });

  const existing = upserts.filter(r => prevById.has(r.id)).map(r => r.id);
  const remote = existing.length > 0 ? await fetchDefectsByIds(existing) : new Map<string, DefectItem>();
  const changed: DefectItem[] = [];
  upserts.forEach(r => {
    const raw = remote.get(r.id);
    const theirs = raw && normalize([raw])[0];
    const base = prevById.get(r.id)?.item;
    if (!theirs || !base || same(theirs, base)) return;
    const merged = mergeItem(base, r.data, theirs);
    if (!same(merged, r.data)) {
      r.data = merged;
      changed.push(merged);
    }
  });

  const nextIds = new Set(next.map(i => i.id));
  const deletes = prev.filter(i => !nextIds.has(i.id)).map(i => i.id);

  // Chunked: bulk deletes put every id in the URL, which has a length limit.
  const now = new Date().toISOString();
  for (let i = 0; i < upserts.length; i += WRITE_CHUNK) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(upserts.slice(i, i + WRITE_CHUNK).map(r => ({ ...r, client_id: CLIENT_ID, updated_at: now })));
    if (error) throw error;
  }
  for (let i = 0; i < deletes.length; i += DELETE_CHUNK) {
    const { error } = await supabase.from(TABLE).delete().in('id', deletes.slice(i, i + DELETE_CHUNK));
    if (error) throw error;
  }
  return changed;
}

export function subscribeToDefects(
  onUpsert: (item: DefectItem, position: number) => void,
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
        if (row.client_id !== CLIENT_ID) onUpsert(row.data, row.position);
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
export async function uploadPhoto(file: File): Promise<string> {
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
