import { CURRENT_PROJECT } from '../lib/currentProject';
import { thumbUrl } from '../lib/thumb';

// Drawings uploaded from the web for the open project (projects.stage_images); they win over
// the files below.
let uploaded: Record<string, string> = {};
export const setUploadedStageImages = (images: Record<string, string> | undefined) => {
  uploaded = images || {};
};

// Facade reference drawing (FCRS) for each stage of each project, served from public/stages.
// Cronulla's come from the Glide app; these are resized copies (thumb + large).
const STAGE_FILES: Record<string, Record<string, string>> = {
  cronulla: {
    BUILDING: 'building',
    'STAGE 1': 'stage-1',
    'STAGE 2': 'stage-2',
    'STAGE 3': 'stage-3',
    'STAGE 4': 'stage-4',
    'STAGE 5': 'stage-5',
    'STAGE 6': 'stage-6',
    'STAGE 7': 'stage-7',
    'STAGE 8': 'stage-8',
  },
  // Each face with its numbered drops; the roof plan (which face is which) for the reference row.
  'altitude-high': {
    NORTH: 'altitude-high-north',
    SOUTH: 'altitude-high-south',
    EAST: 'altitude-high-east',
    WEST: 'altitude-high-west',
    '': 'altitude-high-plan',
  },
  // The building from above for the reference row.
  'altitude-low': {
    NORTH: 'altitude-low-north',
    SOUTH: 'altitude-low-south',
    EAST: 'altitude-low-east',
    WEST: 'altitude-low-west',
    '': 'altitude-low-building',
  },
};

export interface StageImage {
  thumb: string;
  full: string;
}

// "stage 1." / "Stage  1" → "STAGE 1".
export function stageImageFor(orientation: string): StageImage | null {
  const key = orientation.toUpperCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim();
  const url = uploaded[key];
  if (url) return { thumb: thumbUrl(url, 360), full: url };
  const file = STAGE_FILES[CURRENT_PROJECT]?.[key];
  return file ? { thumb: `/stages/${file}-thumb.jpg`, full: `/stages/${file}.jpg` } : null;
}
