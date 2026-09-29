import { DefectPhoto, PhotoPhase } from '../types/inspection';

const RANK: Record<PhotoPhase, number> = { BEFORE: 0, 'IN PROGRESS': 1, COMPLETED: 2 };
const rankOf = (p: DefectPhoto | string, i: number) =>
  typeof p === 'string' ? (i >= 6 ? 2 : i >= 3 ? 1 : 0) : RANK[p.phase] ?? 0;

// Photos always go Before → During → After; within a phase they keep their order.
// Returns the same array when it's already in order, so unchanged rows stay unchanged.
export function sortPhotosByPhase<T extends DefectPhoto | string>(photos: T[]): T[] {
  const ranks = photos.map(rankOf);
  if (ranks.every((r, i) => i === 0 || ranks[i - 1] <= r)) return photos;
  return photos
    .map((p, i) => ({ p, r: ranks[i], i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.p);
}
