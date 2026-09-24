import { DefectItem, UrgencyLevel, DefectStatus, DefectPhoto, PhotoPhase } from '../types/inspection';

export function parseInspectionCsv(csvContent: string): DefectItem[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const items: DefectItem[] = [];

  // Helper to split CSV row taking quotes into account
  const parseRow = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // Find header index
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].toLowerCase().includes('defect') || lines[i].toLowerCase().includes('photo 1')) {
      headerIndex = i;
      break;
    }
  }

  const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = startRow; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    if (cols.length < 5) continue;

    // Check if row has data
    const rowNo = cols[1] || cols[0] || `${i}`;
    const projectName = cols[2] || 'CRONULLA JOB';
    const orientation = cols[3] || 'STAGE 1';
    const defect = cols[4] || 'UNSPECIFIED';

    // Urgency
    let rawUrgency = (cols[5] || 'LOW').toUpperCase();
    let urgency: UrgencyLevel = 'LOW';
    if (rawUrgency.includes('HIGH')) urgency = 'HIGH';
    else if (rawUrgency.includes('MED')) urgency = 'MEDIUM';

    const drop = cols[6] || '';
    const level = cols[7] || '';

    // Photos 1 to 9: cols 8 to 16
    // Slot 1..3 (PHOTO 1-3) -> BEFORE
    // Slot 4..6 (PHOTO 4-6) -> IN PROGRESS
    // Slot 7..9 (PHOTO 7-9) -> COMPLETED
    const photos: DefectPhoto[] = [];
    for (let p = 8; p <= 16; p++) {
      const url = cols[p];
      if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image'))) {
        const slot = p - 7;
        let phase: PhotoPhase = 'BEFORE';
        if (slot >= 7) phase = 'COMPLETED';
        else if (slot >= 4) phase = 'IN PROGRESS';
        else phase = 'BEFORE';

        photos.push({
          url,
          phase,
          slot,
        });
      }
    }

    // Status: normally col 17, but in some rows it could be elsewhere
    let rawStatus = (cols[17] || '').toUpperCase();
    let status: DefectStatus = 'BEFORE';

    // Scan cols for known status if cols[17] is not recognized
    const statusCandidate = [cols[17], cols[18], cols[27], cols[28], cols[29]].find(c =>
      c && (c.includes('COMPLETED') || c.includes('IN PROGRESS') || c === 'BEFORE')
    );

    if (statusCandidate) {
      if (statusCandidate.includes('COMPLETED')) status = 'COMPLETED';
      else if (statusCandidate.includes('IN PROGRESS')) status = 'IN PROGRESS';
      else status = 'BEFORE';
    } else if (rawStatus.includes('COMPLETED')) {
      status = 'COMPLETED';
    } else if (rawStatus.includes('IN PROGRESS')) {
      status = 'IN PROGRESS';
    }

    // Technician start & completed
    // Standard format:
    // col 21: Technician Start (e.g. César Meneses)
    // col 22: Date 1st Photo
    // col 23: Time 1st Photo
    // col 24: Technician Completed
    // col 25: Date Completed
    // col 26: Time Completed
    // col 28: Comment
    // col 29: Base
    // col 30: Height
    // col 31: Linear Meters
    // col 32: Quantity

    let techStart = cols[21] || '';
    let date1st = cols[22] || '';
    let time1st = cols[23] || '';
    let techComp = cols[24] || '';
    let dateComp = cols[25] || '';
    let timeComp = cols[26] || '';
    let comment = cols[28] || '';
    let baseM = cols[29] || '';
    let heightM = cols[30] || '';
    let linearM = cols[31] || '';
    let quantity = cols[32] || '';

    // Handle the shifted format in later rows (where techStart is in col 18/19/20)
    if (!techStart && cols[18] && !cols[18].startsWith('http') && cols[18] !== 'BEFORE' && cols[18] !== 'CHECK') {
      techStart = cols[18];
      date1st = cols[19] || '';
      time1st = cols[20] || '';
      techComp = cols[21] || '';
      dateComp = cols[22] || '';
      timeComp = cols[23] || '';
      comment = cols[25] || cols[26] || '';
    }

    // Also look for dimension numbers if they ended up elsewhere
    const lastFew = cols.slice(25);
    for (const val of lastFew) {
      if (val && !isNaN(Number(val)) && Number(val) > 0) {
        if (!linearM && !baseM) {
          linearM = val;
        }
      }
    }

    items.push({
      id: `defect-${i}-${rowNo}-${Date.now().toString(36)}`,
      rowNo: rowNo || `${items.length + 1}`,
      projectName,
      orientation: orientation || 'STAGE 1',
      defect: defect.toUpperCase(),
      urgency,
      drop,
      level,
      photos,
      status,
      technicianStart: techStart,
      date1stPhoto: date1st,
      time1stPhoto: time1st,
      technicianCompleted: techComp,
      dateCompleted: dateComp,
      timeCompleted: timeComp,
      mapping: cols[27] || '',
      comment: comment || '',
      baseM,
      heightM,
      linearMeters: linearM,
      quantity,
      customTags: []
    });
  }

  return items;
}

export function exportInspectionCsv(items: DefectItem[]): string {
  const header = [
    '#REF!',
    'No',
    'Name proyect',
    'Orientation',
    'Defect',
    'Urgency',
    'Drop',
    'Level',
    'PHOTO 1',
    'PHOTO 2',
    'PHOTO 3',
    'PHOTO 4',
    'PHOTO 5',
    'PHOTO 6',
    'PHOTO 7',
    'PHOTO 8',
    'PHOTO 9',
    'STATUS',
    '#REF!',
    '',
    '',
    'TECHNICIAN START',
    'DATE 1ST PHOTO',
    'TIME 1ST PHOTO',
    'TECHNICIAN COMPLETED',
    'DATE COMPLETED',
    'TIME COMPLETED',
    'mapping',
    'NAME PROJECT:',
    'COMMENT ',
    'Base (m)',
    'Height (m)',
    'Linear Meters',
    'Quantity',
    'CUSTOM TAGS'
  ];

  const escapeCol = (val: string | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = items.map((item, idx) => {
    const photoSlots: string[] = Array(9).fill('');
    const beforePhotos = item.photos.filter(p => p.phase === 'BEFORE');
    const inProgressPhotos = item.photos.filter(p => p.phase === 'IN PROGRESS');
    const completedPhotos = item.photos.filter(p => p.phase === 'COMPLETED');

    beforePhotos.forEach((p, bIdx) => {
      if (bIdx < 3) photoSlots[bIdx] = p.url;
    });
    inProgressPhotos.forEach((p, pIdx) => {
      if (pIdx < 3) photoSlots[3 + pIdx] = p.url;
    });
    completedPhotos.forEach((p, cIdx) => {
      if (cIdx < 3) photoSlots[6 + cIdx] = p.url;
    });

    const row = [
      item.rowNo || String(idx + 1),
      item.rowNo || String(idx + 1),
      item.projectName,
      item.orientation,
      item.defect,
      item.urgency,
      item.drop,
      item.level,
      ...photoSlots,
      item.status,
      item.status,
      '',
      '',
      item.technicianStart,
      item.date1stPhoto,
      item.time1stPhoto,
      item.technicianCompleted,
      item.dateCompleted,
      item.timeCompleted,
      item.mapping || '',
      item.projectName,
      item.comment,
      item.baseM,
      item.heightM,
      item.linearMeters,
      item.quantity,
      (item.customTags || []).join(';')
    ];
    return row.map(escapeCol).join(',');
  });

  return [header.join(','), ...rows].join('\n');
}
