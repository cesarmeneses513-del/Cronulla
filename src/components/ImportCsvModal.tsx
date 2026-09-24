import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseInspectionCsv } from '../utils/csvParser';
import { DefectItem } from '../types/inspection';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: DefectItem[], replace: boolean) => void;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  if (!isOpen) return null;

  const [csvText, setCsvText] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [previewItems, setPreviewItems] = useState<DefectItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParseText = (text: string) => {
    setCsvText(text);
    setError(null);
    try {
      const parsed = parseInspectionCsv(text);
      if (parsed.length === 0) {
        setError('No se detectaron registros válidos en el texto CSV.');
        setPreviewItems([]);
      } else {
        setPreviewItems(parsed);
      }
    } catch (err: any) {
      setError(`Error al procesar CSV: ${err?.message || 'Formato no reconocido'}`);
      setPreviewItems([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      if (content) {
        handleParseText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (previewItems.length === 0) return;
    onImport(previewItems, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Importar Datos desde CSV (Google Sheets / Glide)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <p className="text-slate-600">
            Pega el texto copiado desde Google Sheets o sube un archivo <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.csv</code> con las columnas de inspección (#REF!, No, Defect, Urgency, Drop, Level, PHOTO 1..9, etc.).
          </p>

          {/* File Picker */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold text-slate-800 shadow-xs flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              Seleccionar archivo CSV
            </button>
            <span className="text-slate-500">o pega el contenido en el área inferior:</span>
          </div>

          {/* Text Area */}
          <div>
            <textarea
              rows={8}
              value={csvText}
              onChange={e => handleParseText(e.target.value)}
              placeholder="Pega aquí el contenido CSV con las cabeceras..."
              className="w-full p-3 font-mono text-[11px] border border-slate-200 rounded-xl focus:border-slate-400 focus:outline-hidden leading-relaxed"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview success */}
          {previewItems.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Se detectaron exitosamente <strong>{previewItems.length} registros</strong> de inspección con sus fotos.</span>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="replaceExisting"
              checked={replaceExisting}
              onChange={e => setReplaceExisting(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="replaceExisting" className="text-slate-700 font-medium select-none cursor-pointer">
              Reemplazar los registros actuales con estos datos nuevos (desmarcar para anexar)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={previewItems.length === 0}
            onClick={handleExecuteImport}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
          >
            Importar {previewItems.length > 0 && `(${previewItems.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
