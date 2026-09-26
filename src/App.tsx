import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { FilterBar, ViewMode } from './components/FilterBar';
import { DefectRowCard } from './components/DefectRowCard';
import { PhotoMosaicView } from './components/PhotoMosaicView';
import { ElevationMatrixView } from './components/ElevationMatrixView';
import { TableView } from './components/TableView';
import { PhotoLightbox } from './components/PhotoLightbox';
import { EditDefectModal } from './components/EditDefectModal';
import { ImportCsvModal } from './components/ImportCsvModal';
import { RoleSelectScreen, AppRole, getStoredUserName } from './components/RoleSelectScreen';
import { HistoryPanel } from './components/HistoryPanel';
import { diffForHistory, logHistory } from './lib/history';
import { useI18n, PHASE_LABEL } from './i18n';
import { SortBar, SortState, sortDefects, parseStoredSort } from './components/SortBar';
import { Pagination } from './components/Pagination';
import { DefectItem, FilterState, DragPhotoPayload, DefectStatus, UrgencyLevel, PhotoPhase, DefectPhoto } from './types/inspection';
import { INITIAL_DEFECTS } from './data/initialData';
import { exportInspectionCsv } from './utils/csvParser';
import { supabase, fetchDefects, syncDefects, subscribeToDefects } from './lib/supabase';
import { Plus, Check, Info, AlertTriangle, Cloud, CloudOff, Loader2, Undo2, CheckSquare, Trash2, X } from 'lucide-react';

const STORAGE_KEY = 'inspection_gallery_defects_v2';
const ROLE_KEY = 'cronulla_role';
const SORT_KEY = 'cronulla_sort';

type SyncStatus = 'local' | 'loading' | 'synced' | 'saving' | 'error';

type RemoteChange = { type: 'upsert'; item: DefectItem; position: number } | { type: 'delete'; id: string };

const applyRemoteChange = (list: DefectItem[], change: RemoteChange): DefectItem[] => {
  if (change.type === 'delete') return list.filter(i => i.id !== change.id);
  const idx = list.findIndex(i => i.id === change.item.id);
  if (idx >= 0) return list.map((i, n) => (n === idx ? change.item : i));
  const next = [...list];
  next.splice(Math.min(change.position, next.length), 0, change.item);
  return next;
};

// One undoable editor action: the list right before and right after it.
type HistoryEntry = { label: string; before: DefectItem[]; after: DefectItem[] };
const MAX_HISTORY = 30;

// Reverts only the rows the action touched, so changes made since (e.g. by other users) survive.
const revertEntry = (current: DefectItem[], { before, after }: HistoryEntry): DefectItem[] => {
  const beforeIds = new Set(before.map(i => i.id));
  const afterById = new Map(after.map(i => [i.id, i]));
  // Drop rows the action created.
  const result = current.filter(i => beforeIds.has(i.id) || !afterById.has(i.id));
  before.forEach((item, idx) => {
    if (afterById.get(item.id) === item) return; // untouched by the action
    const pos = result.findIndex(i => i.id === item.id);
    if (pos >= 0) result[pos] = item;
    else result.splice(Math.min(idx, result.length), 0, item);
  });
  return result;
};

const normalizeItems = (rawItems: DefectItem[]): DefectItem[] => {
  return rawItems.map(item => ({
    ...item,
    photos: item.photos.map((p: any, idx: number) => {
      if (typeof p === 'string') {
        const phase: PhotoPhase = idx >= 6 ? 'COMPLETED' : idx >= 3 ? 'IN PROGRESS' : 'BEFORE';
        return {
          url: p,
          phase,
          slot: idx + 1,
        };
      }
      return p;
    }),
  }));
};

export default function App() {
  const { t } = useI18n();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Chosen on the start screen; kept for the browser session so a reload doesn't ask again.
  const [role, setRole] = useState<AppRole | null>(() => {
    try {
      const stored = sessionStorage.getItem(ROLE_KEY);
      return stored === 'editor' || stored === 'client' ? stored : null;
    } catch {
      return null;
    }
  });
  const readOnly = role !== 'editor';

  const handleSelectRole = useCallback((next: AppRole | null) => {
    setRole(next);
    try {
      if (next) sessionStorage.setItem(ROLE_KEY, next);
      else sessionStorage.removeItem(ROLE_KEY);
    } catch {}
  }, []);

  // Load initial data from localStorage if present
  const [items, setItems] = useState<DefectItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeItems(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load stored defects', e);
    }
    return INITIAL_DEFECTS;
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to persist to localStorage', e);
    }
  }, [items]);

  // Supabase sync. `syncedRef` is the last snapshot known to match the database;
  // null until the first load succeeds, so a failed load never overwrites remote data.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? 'loading' : 'local');
  const syncedRef = useRef<DefectItem[] | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchDefects();
        if (cancelled) return;
        if (remote.length === 0) {
          // Empty database: seed it with what this browser has.
          syncedRef.current = [];
          setItems(current => [...current]);
          setSyncStatus('saving');
        } else {
          const normalized = normalizeItems(remote);
          syncedRef.current = normalized;
          setItems(normalized);
          setSyncStatus('synced');
        }
      } catch (e) {
        console.error('Failed to load defects from Supabase', e);
        if (!cancelled) setSyncStatus('error');
      }
    })();

    const unsubscribe = subscribeToDefects(
      (item, position) => {
        const change: RemoteChange = { type: 'upsert', item: normalizeItems([item])[0], position };
        if (syncedRef.current) syncedRef.current = applyRemoteChange(syncedRef.current, change);
        setItems(prev => applyRemoteChange(prev, change));
      },
      id => {
        const change: RemoteChange = { type: 'delete', id };
        if (syncedRef.current) syncedRef.current = applyRemoteChange(syncedRef.current, change);
        setItems(prev => applyRemoteChange(prev, change));
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Push local changes to Supabase (debounced, one save at a time).
  useEffect(() => {
    if (!supabase || readOnly || syncedRef.current === null || items === syncedRef.current) return;
    const timer = setTimeout(() => {
      const prev = syncedRef.current;
      if (!prev) return;
      syncedRef.current = items;
      setSyncStatus('saving');
      saveQueueRef.current = saveQueueRef.current
        .then(() => syncDefects(prev, items))
        .then(() => {
          if (syncedRef.current === items) setSyncStatus('synced');
        })
        .catch(e => {
          console.error('Failed to save defects to Supabase', e);
          syncedRef.current = prev;
          setSyncStatus('error');
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [items, readOnly]);

  // View Mode
  const [viewMode, setViewMode] = useState<ViewMode>('rows');

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    orientations: [],
    defects: [],
    urgencies: [],
    statuses: [],
    drops: [],
    levels: [],
    technicians: [],
    hasPhotosOnly: false,
  });

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; undoable: boolean } | null>(null);

  const showToast = useCallback((message: string, undoable = false) => {
    const next = { message, undoable };
    setToast(next);
    setTimeout(() => {
      setToast(prev => (prev === next ? null : prev));
    }, undoable ? 6000 : 3000);
  }, []);

  // Undo history for editor actions. `itemsRef` lets consecutive actions build on each other
  // without waiting for a re-render.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Reload everything from the database. Pending local edits are saved first so none are lost.
  const [reloading, setReloading] = useState(false);
  const handleReload = useCallback(async () => {
    if (!supabase || reloading) return;
    setReloading(true);
    try {
      await saveQueueRef.current;
      const synced = syncedRef.current;
      if (!readOnly && synced && itemsRef.current !== synced) {
        await syncDefects(synced, itemsRef.current);
      }
      const normalized = normalizeItems(await fetchDefects());
      syncedRef.current = normalized;
      itemsRef.current = normalized;
      setItems(normalized);
      setSyncStatus('synced');
      showToast(t('Datos actualizados: {n} defectos', { n: normalized.length }));
    } catch (e) {
      console.error('Failed to reload defects', e);
      setSyncStatus('error');
    } finally {
      setReloading(false);
    }
  }, [reloading, readOnly, showToast, t]);

  const updateItems = useCallback((updater: (prev: DefectItem[]) => DefectItem[], label: string) => {
    const before = itemsRef.current;
    const after = updater(before);
    if (after === before) return;
    itemsRef.current = after;
    setItems(after);
    setHistory(h => [...h.slice(-(MAX_HISTORY - 1)), { label, before, after }]);
    logHistory(getStoredUserName(), diffForHistory(before, after, label));
  }, []);

  const handleUndo = useCallback(() => {
    const entry = history[history.length - 1];
    if (!entry || readOnly) return;
    setHistory(history.slice(0, -1));
    const current = itemsRef.current;
    const next = revertEntry(current, entry);
    itemsRef.current = next;
    setItems(next);
    logHistory(getStoredUserName(), [
      { action: 'undo', defect_id: null, row_no: null, details: { label: entry.label } },
      ...diffForHistory(current, next, entry.label).filter(r => r.action !== 'bulk'),
    ]);
    showToast(t('Deshecho: {label}', { label: entry.label }));
  }, [history, readOnly, showToast, t]);

  // Cmd/Ctrl + Z outside text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault();
      handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

  // Modal States
  const [editingItem, setEditingItem] = useState<DefectItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Lightbox State
  const [lightboxItem, setLightboxItem] = useState<DefectItem | null>(null);
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number>(0);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matches =
          item.rowNo.toLowerCase().includes(q) ||
          item.defect.toLowerCase().includes(q) ||
          item.orientation.toLowerCase().includes(q) ||
          item.drop.toLowerCase().includes(q) ||
          item.level.toLowerCase().includes(q) ||
          item.comment.toLowerCase().includes(q) ||
          item.technicianStart.toLowerCase().includes(q) ||
          item.technicianCompleted.toLowerCase().includes(q) ||
          item.projectName.toLowerCase().includes(q) ||
          (item.customTags || []).some(t => t.toLowerCase().includes(q));

        if (!matches) return false;
      }

      // Orientations
      if (filters.orientations.length > 0 && !filters.orientations.includes(item.orientation)) {
        return false;
      }

      // Defects
      if (filters.defects.length > 0 && !filters.defects.includes(item.defect)) {
        return false;
      }

      // Urgencies
      if (filters.urgencies.length > 0 && !filters.urgencies.includes(item.urgency)) {
        return false;
      }

      // Statuses
      if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) {
        return false;
      }

      // Drops
      if (filters.drops.length > 0 && !filters.drops.includes(item.drop)) {
        return false;
      }

      // Levels
      if (filters.levels.length > 0 && !filters.levels.includes(item.level)) {
        return false;
      }

      // Technicians
      if (
        filters.technicians.length > 0 &&
        !filters.technicians.includes(item.technicianStart) &&
        !filters.technicians.includes(item.technicianCompleted)
      ) {
        return false;
      }

      // Has photos only
      if (filters.hasPhotosOnly && item.photos.length === 0) {
        return false;
      }

      return true;
    });
  }, [items, filters]);

  // Display-only ordering; the stored order (and the Google Sheet) are untouched.
  const [sort, setSort] = useState<SortState>(() => {
    try {
      const stored = parseStoredSort(JSON.parse(localStorage.getItem(SORT_KEY) || 'null'));
      if (stored) return stored;
    } catch {}
    return { keys: [], direction: 'asc' };
  });

  const handleSortChange = useCallback((next: SortState) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const sortedItems = useMemo(
    () => sortDefects(filteredItems, sort),
    [filteredItems, sort]
  );

  // The list is shown a page at a time: rendering ~1,500 rows with their photos at once is slow.
  const pageSize = viewMode === 'rows' ? 25 : viewMode === 'photos' ? 20 : 50;
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filters, sort, viewMode]);
  const currentPage = Math.min(page, pageCount);
  const pagedItems = useMemo(
    () => sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedItems, currentPage, pageSize]
  );
  const mainRef = useRef<HTMLElement>(null);
  const goToPage = useCallback((next: number) => {
    setPage(next);
    const top = (mainRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 120;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);
  const pager = (
    <Pagination page={currentPage} pageCount={pageCount} total={sortedItems.length} pageSize={pageSize} onChange={goToPage} />
  );

  // Multi-select for bulk delete (editor only).
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const lastSelectedRef = useRef<string | null>(null);
  const selectionActive = selecting && !readOnly;

  // Only what is visible counts, so hidden (filtered-out) selections are never deleted.
  const visibleSelected = useMemo(
    () => (selectionActive ? sortedItems.filter(i => selectedIds.has(i.id)) : []),
    [selectionActive, sortedItems, selectedIds]
  );

  const handleToggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      const anchor = lastSelectedRef.current;
      lastSelectedRef.current = id;
      setSelectedIds(prev => {
        const next = new Set(prev);
        const select = !prev.has(id);
        if (shiftKey && anchor && anchor !== id) {
          // Shift + click: apply to the whole range between the last click and this one.
          const ids = sortedItems.map(i => i.id);
          const a = ids.indexOf(anchor);
          const b = ids.indexOf(id);
          if (a >= 0 && b >= 0) {
            ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => (select ? next.add(x) : next.delete(x)));
            return next;
          }
        }
        if (select) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [sortedItems]
  );

  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
    lastSelectedRef.current = null;
  }, []);

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(i => {
      if (i.orientation) counts.set(i.orientation, (counts.get(i.orientation) || 0) + 1);
    });
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }, [items]);

  const totalPhotos = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.photos.length, 0);
  }, [items]);

  // Handler: Move photo between rows or within same row
  const handleMovePhoto = useCallback(
    (payload: DragPhotoPayload, targetItemId: string, targetPhotoIndex?: number) => {
      updateItems(prevItems => {
        const sourceItem = prevItems.find(i => i.id === payload.sourceItemId);
        const targetItem = prevItems.find(i => i.id === targetItemId);

        if (!sourceItem || !targetItem) return prevItems;

        // Moving within the same row (reordering)
        if (sourceItem.id === targetItem.id) {
          if (targetPhotoIndex === undefined || targetPhotoIndex === payload.photoIndex) {
            return prevItems;
          }
          const photos = [...sourceItem.photos];
          const [movedPhoto] = photos.splice(payload.photoIndex, 1);
          photos.splice(targetPhotoIndex, 0, movedPhoto);

          showToast(t('Foto reordenada en la fila #{row}', { row: sourceItem.rowNo }), true);
          return prevItems.map(i => (i.id === sourceItem.id ? { ...i, photos } : i));
        }

        // Moving between different rows
        const originalPhoto = sourceItem.photos[payload.photoIndex];
        const resolvedPhase: PhotoPhase = payload.phase || (typeof originalPhoto === 'object' ? originalPhoto.phase : 'BEFORE');
        const movedPhoto: DefectPhoto = {
          url: payload.photoUrl,
          phase: resolvedPhase,
          slot: (targetPhotoIndex ?? targetItem.photos.length) + 1,
        };

        const sourcePhotos = sourceItem.photos.filter((_, idx) => idx !== payload.photoIndex);
        const targetPhotos = [...targetItem.photos];

        if (targetPhotoIndex !== undefined && targetPhotoIndex >= 0) {
          targetPhotos.splice(targetPhotoIndex, 0, movedPhoto);
        } else {
          targetPhotos.push(movedPhoto);
        }

        showToast(
          t('Foto trasladada de Fila #{a} ({da}) a Fila #{b} ({db})', {
            a: sourceItem.rowNo,
            da: sourceItem.defect,
            b: targetItem.rowNo,
            db: targetItem.defect,
          }),
          true
        );

        return prevItems.map(i => {
          if (i.id === sourceItem.id) return { ...i, photos: sourcePhotos };
          if (i.id === targetItem.id) return { ...i, photos: targetPhotos };
          return i;
        });
      }, t('mover foto'));
    },
    [showToast, updateItems, t]
  );

  // Handler: Add photo to row
  const handleAddPhoto = useCallback(
    (itemId: string, photoUrl: string, phase: PhotoPhase = 'BEFORE') => {
      updateItems(
        prev =>
          prev.map(i => {
            if (i.id !== itemId) return i;
            const newPhoto: DefectPhoto = {
              url: photoUrl,
              phase,
              slot: i.photos.length + 1,
            };
            return { ...i, photos: [...i.photos, newPhoto] };
          }),
        t('añadir foto')
      );
      showToast(t('Fotografía añadida a {phase}', { phase: t(PHASE_LABEL[phase]) }), true);
    },
    [showToast, updateItems, t]
  );

  // Handler: Update photo phase directly
  const handleUpdatePhotoPhase = useCallback(
    (itemId: string, photoIndex: number, newPhase: PhotoPhase) => {
      updateItems(prev =>
        prev.map(item => {
          if (item.id !== itemId) return item;
          const photos = [...item.photos];
          const cur = photos[photoIndex];
          const url = typeof cur === 'string' ? cur : cur.url;
          photos[photoIndex] = {
            url,
            phase: newPhase,
            slot: typeof cur === 'object' ? cur.slot : photoIndex + 1,
          };
          return { ...item, photos };
        }),
        t('cambiar fase de foto')
      );
      showToast(t('Foto cambiada a {phase}', { phase: t(PHASE_LABEL[newPhase]) }), true);
    },
    [showToast, updateItems, t]
  );

  // Handler: Delete photo
  const handleDeletePhoto = useCallback(
    (itemId: string, photoIndex: number) => {
      updateItems(
        prev =>
          prev.map(i => {
            if (i.id !== itemId) return i;
            return {
              ...i,
              photos: i.photos.filter((_, idx) => idx !== photoIndex),
            };
          }),
        t('eliminar foto')
      );
      showToast(t('Fotografía eliminada'), true);
    },
    [showToast, updateItems, t]
  );

  // Handler: Quick update status
  const handleQuickUpdateStatus = useCallback(
    (itemId: string, status: DefectStatus) => {
      updateItems(prev => prev.map(i => (i.id === itemId ? { ...i, status } : i)), t('cambiar estado'));
    },
    [updateItems, t]
  );

  // Handler: Quick update urgency
  const handleQuickUpdateUrgency = useCallback(
    (itemId: string, urgency: UrgencyLevel) => {
      updateItems(prev => prev.map(i => (i.id === itemId ? { ...i, urgency } : i)), t('cambiar urgencia'));
    },
    [updateItems, t]
  );

  // Handler: Open Edit Modal
  const handleOpenEdit = useCallback((item: DefectItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  }, []);

  // Handler: Save from Edit Modal
  const handleSaveDefect = useCallback(
    (updated: DefectItem) => {
      updateItems(prev => {
        const exists = prev.some(i => i.id === updated.id);
        if (exists) {
          return prev.map(i => (i.id === updated.id ? updated : i));
        }
        return [updated, ...prev];
      }, t('guardar registro #{row}', { row: updated.rowNo }));
      showToast(t('Registro #{row} guardado', { row: updated.rowNo }), true);
    },
    [showToast, updateItems, t]
  );

  // Handler: Duplicate defect
  const handleDuplicateDefect = useCallback(
    (original: DefectItem) => {
      const duplicate: DefectItem = {
        ...original,
        id: `defect-${Date.now()}`,
        rowNo: `${original.rowNo}-copia`,
        photos: [...original.photos],
        customTags: [...(original.customTags || [])],
      };
      updateItems(prev => [duplicate, ...prev], t('duplicar registro #{row}', { row: original.rowNo }));
      showToast(t('Registro #{row} duplicado', { row: original.rowNo }), true);
    },
    [showToast, updateItems, t]
  );

  // Handler: Delete defect
  const handleDeleteDefect = useCallback(
    (id: string) => {
      const target = items.find(i => i.id === id);
      if (window.confirm(t('¿Estás seguro de eliminar el registro #{row} ({defect})?', { row: target?.rowNo || '', defect: target?.defect || '' }))) {
        updateItems(prev => prev.filter(i => i.id !== id), t('eliminar registro #{row}', { row: target?.rowNo || '' }));
        showToast(t('Registro eliminado'), true);
      }
    },
    [items, showToast, updateItems, t]
  );

  // Handler: Delete all selected (visible) defects
  const handleDeleteSelected = useCallback(() => {
    const ids = new Set(visibleSelected.map(i => i.id));
    if (ids.size === 0) return;
    if (!window.confirm(t('¿Eliminar {n} registros seleccionados?\n\nPuedes recuperarlos con el botón "Deshacer".', { n: ids.size }))) return;
    updateItems(prev => prev.filter(i => !ids.has(i.id)), t('eliminar {n} registros', { n: ids.size }));
    setSelectedIds(new Set());
    lastSelectedRef.current = null;
    showToast(t('{n} registros eliminados', { n: ids.size }), true);
  }, [visibleSelected, updateItems, showToast, t]);

  // Handler: New Defect
  const handleNewDefect = useCallback(() => {
    const newItem: DefectItem = {
      id: `defect-new-${Date.now()}`,
      rowNo: `${items.length + 1}`,
      projectName: 'CRONULLA JOB',
      orientation: 'STAGE 1',
      defect: 'RENDER REPAIR',
      urgency: 'LOW',
      drop: '1',
      level: '1',
      photos: [],
      status: 'BEFORE',
      technicianStart: '',
      date1stPhoto: new Date().toLocaleDateString('es-ES'),
      time1stPhoto: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      technicianCompleted: '',
      dateCompleted: '',
      timeCompleted: '',
      mapping: '',
      comment: '',
      baseM: '',
      heightM: '',
      linearMeters: '',
      quantity: '',
      customTags: ['Nuevo'],
    };
    setEditingItem(newItem);
    setIsEditModalOpen(true);
  }, [items.length]);

  // Handler: Open Photo Lightbox
  const handleOpenPhotoLightbox = useCallback((item: DefectItem, photoIndex: number) => {
    setLightboxItem(item);
    setLightboxPhotoIndex(photoIndex);
  }, []);

  // Handler: Navigate Photo in Lightbox
  const handleNavigatePhoto = useCallback((item: DefectItem, newIndex: number) => {
    setLightboxItem(item);
    setLightboxPhotoIndex(newIndex);
  }, []);

  // Handler: Prompt to Move Photo from Mosaic View
  const handlePromptMovePhoto = useCallback((sourceItem: DefectItem, photoIndex: number) => {
    setLightboxItem(sourceItem);
    setLightboxPhotoIndex(photoIndex);
  }, []);

  // Handler: Select Cell from Elevation Matrix (applies Drop & Level filter)
  const handleSelectElevationCell = useCallback((drop: string, level: string) => {
    setFilters(prev => ({
      ...prev,
      drops: [drop],
      levels: [level],
    }));
    setViewMode('rows');
    showToast(t('Filtrado por Drop {drop} y Nivel {level}', { drop, level }));
  }, [showToast, t]);

  // Export CSV
  const handleExportCsv = useCallback(() => {
    const csvData = exportInspectionCsv(items);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspeccion-cronulla-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('Archivo CSV exportado exitosamente'));
  }, [items, showToast, t]);

  // Import CSV handler
  const handleImportCsv = useCallback(
    (importedItems: DefectItem[], replace: boolean) => {
      updateItems(prev => {
        if (replace) return importedItems;
        // Append mode: rows whose ID already exists update in place, the rest go on top.
        const byId = new Map(importedItems.map(i => [i.id, i]));
        const updated = prev.map(i => byId.get(i.id) || i);
        const prevIds = new Set(prev.map(i => i.id));
        return [...importedItems.filter(i => !prevIds.has(i.id)), ...updated];
      }, t('importar CSV'));
      showToast(t('{n} registros importados correctamente', { n: importedItems.length }), true);
    },
    [showToast, updateItems, t]
  );


  if (!role) {
    return <RoleSelectScreen onSelect={handleSelectRole} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased overflow-x-clip">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-slate-700 animate-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toast.message}</span>
          {toast.undoable && !readOnly && history.length > 0 && (
            <button
              onClick={() => {
                setToast(null);
                handleUndo();
              }}
              className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-amber-300 font-semibold transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              {t('Deshacer')}
            </button>
          )}
        </div>
      )}

      {/* Sync status */}
      <div
        className={`fixed bottom-5 left-5 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium shadow-md border ${
          syncStatus === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : syncStatus === 'local'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-white text-slate-600 border-slate-200'
        }`}
        title={syncStatus === 'error' ? t('Revisa la consola del navegador para más detalles') : undefined}
      >
        {syncStatus === 'loading' || syncStatus === 'saving' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : syncStatus === 'synced' ? (
          <Cloud className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <CloudOff className="w-3.5 h-3.5" />
        )}
        {t(
          {
            loading: 'Cargando desde la nube…',
            saving: 'Guardando…',
            synced: 'Sincronizado',
            error: 'Error de sincronización',
            local: 'Solo en este navegador',
          }[syncStatus]
        )}
      </div>

      {/* Header */}
      <Header
        items={items}
        filteredCount={filteredItems.length}
        totalPhotos={totalPhotos}
        onNewDefect={handleNewDefect}
        onExportCsv={handleExportCsv}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        readOnly={readOnly}
        onLogout={() => handleSelectRole(null)}
        onUndo={handleUndo}
        undoLabel={history.length > 0 ? history[history.length - 1].label : null}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onReload={supabase ? handleReload : undefined}
        reloading={reloading}
      />

      {/* Filter and View Mode Controller */}
      <FilterBar
        items={items}
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filteredCount={filteredItems.length}
        readOnly={readOnly}
      />

      {/* Main View Area */}
      <main ref={mainRef} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Info className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">{t('No se encontraron defectos coincidentes')}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {t('Intenta cambiar los filtros seleccionados o el término de búsqueda para ver los registros de inspección.')}
            </p>
            <button
              onClick={() =>
                setFilters({
                  searchQuery: '',
                  orientations: [],
                  defects: [],
                  urgencies: [],
                  statuses: [],
                  drops: [],
                  levels: [],
                  technicians: [],
                  hasPhotosOnly: false,
                })
              }
              className="inline-flex items-center gap-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              {t('Restablecer Filtros')}
            </button>
          </div>
        ) : viewMode === 'rows' ? (
          /* View Mode 1: Detailed Rows with Drag and Drop Photo Reordering */
          <div className="space-y-4">
            <SortBar
              sort={sort}
              onChange={handleSortChange}
              actions={
                !readOnly && (
                  <button
                    onClick={() => (selecting ? exitSelection() : setSelecting(true))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selecting
                        ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selecting ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                    {selecting ? t('Cancelar selección') : t('Seleccionar')}
                  </button>
                )
              }
            />
            {pager}
            {pagedItems.map((item, idx) => (
              <DefectRowCard
                key={item.id}
                item={item}
                index={idx}
                onEdit={handleOpenEdit}
                onDuplicate={handleDuplicateDefect}
                onDelete={handleDeleteDefect}
                onOpenPhotoLightbox={handleOpenPhotoLightbox}
                onMovePhoto={handleMovePhoto}
                onAddPhoto={handleAddPhoto}
                onDeletePhoto={handleDeletePhoto}
                onQuickUpdateStatus={handleQuickUpdateStatus}
                onQuickUpdateUrgency={handleQuickUpdateUrgency}
                onUpdatePhotoPhase={readOnly ? undefined : handleUpdatePhotoPhase}
                readOnly={readOnly}
                selectable={selectionActive}
                selected={selectionActive && selectedIds.has(item.id)}
                onToggleSelect={handleToggleSelect}
              />
            ))}
            {pager}
          </div>
        ) : viewMode === 'photos' ? (
          /* View Mode 2: Photo Mosaic Grid */
          <>
          <SortBar sort={sort} onChange={handleSortChange} />
          {pager}
          <PhotoMosaicView
            items={pagedItems}
            onOpenPhotoLightbox={handleOpenPhotoLightbox}
            onDeletePhoto={handleDeletePhoto}
            onMovePhotoPrompt={handlePromptMovePhoto}
            onUpdatePhotoPhase={readOnly ? undefined : handleUpdatePhotoPhase}
            readOnly={readOnly}
          />
          {pager}
          </>
        ) : viewMode === 'matrix' ? (
          /* View Mode 3: Elevation Matrix (Drop vs Level) */
          <ElevationMatrixView
            items={filteredItems}
            stages={stageCounts}
            selectedStages={filters.orientations}
            onSelectStage={stage => setFilters(prev => ({ ...prev, orientations: stage ? [stage] : [] }))}
            onSelectCell={handleSelectElevationCell}
            onOpenPhotoLightbox={handleOpenPhotoLightbox}
          />
        ) : (
          /* View Mode 4: Table View */
          <>
          <SortBar
            sort={sort}
            onChange={handleSortChange}
            actions={
              !readOnly && (
              <button
                onClick={() => (selecting ? exitSelection() : setSelecting(true))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  selecting
                    ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {selecting ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                {selecting ? t('Cancelar selección') : t('Seleccionar')}
              </button>
              )
            }
          />
          {pager}
          <TableView
            items={pagedItems}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteDefect}
            onOpenPhotoLightbox={handleOpenPhotoLightbox}
            onQuickUpdateStatus={handleQuickUpdateStatus}
            readOnly={readOnly}
            selectable={selectionActive}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
          {pager}
          </>
        )}
      </main>

      {/* Bulk selection bar */}
      {selectionActive && (viewMode === 'rows' || viewMode === 'table') && (
        <div className="fixed bottom-16 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] sm:w-auto flex flex-wrap items-center justify-center gap-2 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700">
          <span className="font-semibold tabular-nums">
            {t('{n} seleccionados', { n: visibleSelected.length })}
          </span>
          <span className="text-slate-500 hidden sm:inline">·</span>
          <button
            onClick={() => setSelectedIds(new Set(sortedItems.map(i => i.id)))}
            className="px-2 py-1 rounded-md hover:bg-white/10 text-slate-200"
          >
            {t('Seleccionar todos ({n})', { n: sortedItems.length })}
          </button>
          {visibleSelected.length > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 rounded-md hover:bg-white/10 text-slate-200"
            >
              {t('Quitar selección')}
            </button>
          )}
          <button
            onClick={handleDeleteSelected}
            disabled={visibleSelected.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('Eliminar ({n})', { n: visibleSelected.length })}
          </button>
          <button onClick={exitSelection} title={t('Salir de la selección')} className="p-1.5 rounded-md hover:bg-white/10">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxItem && (
        <PhotoLightbox
          item={items.find(i => i.id === lightboxItem.id) || lightboxItem}
          photoIndex={lightboxPhotoIndex}
          allItems={items}
          onClose={() => setLightboxItem(null)}
          onNavigatePhoto={handleNavigatePhoto}
          onDeletePhoto={handleDeletePhoto}
          onUpdatePhotoPhase={readOnly ? undefined : handleUpdatePhotoPhase}
          onSaveItem={readOnly ? undefined : handleSaveDefect}
          readOnly={readOnly}
        />
      )}

      {/* Edit Defect Modal */}
      <EditDefectModal
        item={editingItem}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveDefect}
      />

      {/* Import CSV Modal */}
      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportCsv}
        existingItems={items}
      />

      {/* Change history */}
      {isHistoryOpen && !readOnly && <HistoryPanel onClose={() => setIsHistoryOpen(false)} />}

      {/* Quiet footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{t('Cronulla Job · Sistema de Control de Inspección en Altura & Defectos de Fachada')}</span>
          <span className="font-mono text-[11px] text-slate-400">
            {t('{n} filas registradas', { n: items.length })} · {readOnly ? t('Solo lectura') : t('Drag & Drop habilitado')}
          </span>
        </div>
        <p className="max-w-7xl mx-auto px-4 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
          {t('Creado por')} <span className="font-semibold text-slate-600">CIMA &amp; Daniel Vidal</span> · CPR 2026
        </p>
      </footer>
    </div>
  );
}
