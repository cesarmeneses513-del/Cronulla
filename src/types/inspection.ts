export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type DefectStatus = 'BEFORE' | 'IN PROGRESS' | 'COMPLETED';
export type PhotoPhase = 'BEFORE' | 'IN PROGRESS' | 'COMPLETED';

export interface DefectPhoto {
  url: string;
  phase: PhotoPhase;
  slot?: number; // 1 to 9 corresponding to PHOTO 1..9
}

export interface DefectItem {
  id: string; // unique row id
  rowNo: string; // e.g. "21", "22", "1326"
  projectName: string; // e.g. "CRONULLA JOB"
  orientation: string; // e.g. "STAGE 1", "STAGE 2", "STAGE 3"
  defect: string; // e.g. "RENDER REPAIR", "RESEALING WORKS"
  urgency: UrgencyLevel;
  drop: string; // e.g. "1", "2", "3", "11", etc.
  level: string; // e.g. "1", "2", ..., "12", "G", "R"
  photos: DefectPhoto[]; // URLs & phase of photos (1 to 9)
  status: DefectStatus;
  technicianStart: string;
  date1stPhoto: string;
  time1stPhoto: string;
  technicianCompleted: string;
  dateCompleted: string;
  timeCompleted: string;
  mapping: string;
  comment: string;
  baseM: string;
  heightM: string;
  linearMeters: string;
  quantity: string;
  customTags?: string[];
}

export interface FilterState {
  searchQuery: string;
  orientations: string[];
  defects: string[];
  urgencies: string[];
  statuses: string[];
  drops: string[];
  levels: string[];
  technicians: string[];
  hasPhotosOnly: boolean;
}

export interface DragPhotoPayload {
  sourceItemId: string;
  photoUrl: string;
  photoIndex: number;
  phase?: PhotoPhase;
}
