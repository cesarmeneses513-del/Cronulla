// Facade reference drawing (FCRS) for each stage, served from public/stages.
// Originals come from the Glide app; these are resized copies (thumb + large).
const STAGE_FILES: Record<string, string> = {
  BUILDING: 'building',
  'STAGE 1': 'stage-1',
  'STAGE 2': 'stage-2',
  'STAGE 3': 'stage-3',
  'STAGE 4': 'stage-4',
  'STAGE 5': 'stage-5',
  'STAGE 6': 'stage-6',
  'STAGE 7': 'stage-7',
  'STAGE 8': 'stage-8',
};

export interface StageImage {
  thumb: string;
  full: string;
}

// "stage 1." / "Stage  1" → "STAGE 1".
export function stageImageFor(orientation: string): StageImage | null {
  const key = orientation.toUpperCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim();
  const file = STAGE_FILES[key];
  return file ? { thumb: `/stages/${file}-thumb.jpg`, full: `/stages/${file}.jpg` } : null;
}
