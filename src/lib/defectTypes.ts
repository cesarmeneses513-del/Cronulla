// The defect types offered in the forms, and the measurements each one needs:
// area = Width × Height (m), linear = Linear metres (m), quantity = Quantity.
export type MeasureKind = 'area' | 'linear' | 'quantity';

export const DEFECT_TYPES: { name: string; measures: MeasureKind[] }[] = [
  { name: 'RENDER REPAIR', measures: ['area'] },
  { name: 'RESEALING WORKS', measures: ['linear'] },
  { name: 'SKIM RENDERING', measures: ['area'] },
  { name: 'SEAL WINDOW FRAME', measures: ['linear'] },
  { name: 'RENDER REPAIR TO SLAB EDGE', measures: ['area'] },
  { name: 'RUST SPOT', measures: ['quantity'] },
  { name: 'RUST PIPE', measures: ['quantity'] },
  { name: 'CONCRETE SPALLING', measures: ['area'] },
  // Any of the three is enough.
  { name: 'DILAPIDATION', measures: ['area', 'linear', 'quantity'] },
];

export const STAGES = ['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4', 'STAGE 5', 'STAGE 6', 'STAGE 7', 'STAGE 8'];

// Measurements of a defect type; types outside the list (older data) may use any of them.
export const measuresFor = (defect: string): MeasureKind[] =>
  DEFECT_TYPES.find(d => d.name === defect.trim().toUpperCase())?.measures || ['area', 'linear', 'quantity'];
