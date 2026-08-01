import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon, FileJsonIcon, CloseIcon, AlertIcon, SparklesIcon, DownloadIcon } from './icons';
import { parseAndValidateJSON, importParsedJSONToDatabase, ParsedJSONResult, exportFullBackupAsJSON } from '../services/importExportService';
import * as apiService from '../services/dbService';
import { TPData } from '../types';

interface ImportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedMessage: string) => void;
  currentSubject?: string | null;
  initialTab?: 'upload' | 'paste' | 'export';
}

export const ImportJsonModal: React.FC<ImportJsonModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSubject,
  initialTab = 'upload',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'export'>(initialTab);
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsedJSONResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [overrideSubject, setOverrideSubject] = useState<boolean>(!!currentSubject);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      validateJSON(content);
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file JSON.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorMsg(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setErrorMsg('File harus berformat .json');
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setJsonText(content);
        validateJSON(content);
      };
      reader.readAsText(file);
    }
  };

  const validateJSON = (text: string) => {
    setErrorMsg(null);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const result = parseAndValidateJSON(text);
    setParseResult(result);
    if (!result.isValid && result.error) {
      setErrorMsg(result.error);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    validateJSON(text);
  };

  const handleExecuteImport = async () => {
    if (!parseResult || !parseResult.isValid) return;

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const targetSub = (overrideSubject && currentSubject) ? currentSubject : undefined;
      const res = await importParsedJSONToDatabase(parseResult, targetSub);
      setIsImporting(false);
      onSuccess(res.message);
      handleReset();
      onClose();
    } catch (err: any) {
      setIsImporting(false);
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengimpor data ke database.');
    }
  };

  const handleReset = () => {
    setJsonText('');
    setFileName(null);
    setParseResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl">
              <FileJsonIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Impor Data JSON</h2>
              <p className="text-xs text-slate-500">Unggah file JSON atau tempel kode JSON perangkat ajar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition"
            title="Tutup Modal"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Navigation Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadIcon className="w-4 h-4" />
              Unggah File (.json)
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileJsonIcon className="w-4 h-4" />
              Tempel Kode JSON
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'export'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DownloadIcon className="w-4 h-4" />
              Ekspor Data (.json)
            </button>
          </div>

          {/* Tab 1: Upload File */}
          {activeTab === 'upload' && (
            <div>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50/50 hover:bg-teal-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto mb-3 bg-teal-100 text-teal-600 group-hover:bg-teal-600 group-hover:text-white rounded-2xl flex items-center justify-center transition-all duration-200 shadow-sm">
                  <UploadIcon className="w-8 h-8" />
                </div>
                {fileName ? (
                  <div>
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-semibold">
                      <FileJsonIcon className="w-4 h-4" />
                      {fileName}
                    </span>
                    <p className="text-xs text-slate-400 mt-2">Klik atau tarik file lain untuk mengganti</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-teal-700">
                      Tarik & Letakkan File JSON di sini
                    </p>
                    <p className="text-xs text-slate-400 mt-1">atau klik untuk menelusuri dari perangkat Anda (.json)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Paste Raw JSON */}
          {activeTab === 'paste' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Kode JSON Raw:</label>
              <textarea
                value={jsonText}
                onChange={handleTextareaChange}
                placeholder='Tempelkan struktur JSON di sini, contoh: [{"subject": "Fikih", "grade": "7", "tpGroups": [...]}]'
                rows={6}
                className="w-full border border-slate-300 rounded-xl p-3 font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          )}

          {/* Tab 3: Export JSON */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl">
                    <DownloadIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Unduh Data JSON Perangkat Ajar</h3>
                    <p className="text-xs text-slate-500">Simpan cadangan data (backup) atau bagikan ke guru lain</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  {currentSubject && (
                    <button
                      onClick={async () => {
                        setIsExporting(true);
                        try {
                          const [tps, atps, protas, kktps, prosems, rpms, settings] = await Promise.all([
                            apiService.getTPsBySubject(currentSubject),
                            apiService.getATPsBySubject(currentSubject),
                            apiService.getPROTAsBySubject(currentSubject),
                            apiService.getKKTPsBySubject(currentSubject),
                            apiService.getPROSEMsBySubject(currentSubject),
                            apiService.getRPMsBySubject(currentSubject),
                            apiService.getAdminSettings(),
                          ]);
                          exportFullBackupAsJSON(tps, atps, protas, kktps, prosems, rpms, settings);
                          onSuccess(`Berhasil mengekspor data TP dan perangkat ajar mata pelajaran ${currentSubject} ke file JSON.`);
                        } catch (e: any) {
                          setErrorMsg(e.message || 'Gagal mengekspor data.');
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                      disabled={isExporting}
                      className="w-full p-4 bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-300 rounded-xl text-left transition flex items-center justify-between group shadow-sm"
                    >
                      <div>
                        <span className="block font-bold text-sm text-slate-800 group-hover:text-teal-700">
                          Ekspor Mata Pelajaran: {currentSubject}
                        </span>
                        <span className="text-xs text-slate-500">
                          Unduh seluruh TP dan Perangkat Ajar (ATP, Prota, KKTP, Prosem, RPM) untuk {currentSubject}
                        </span>
                      </div>
                      <DownloadIcon className="w-5 h-5 text-slate-400 group-hover:text-teal-600" />
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      setIsExporting(true);
                      try {
                        const [tps, atps, protas, kktps, prosems, rpms, settings] = await Promise.all([
                          apiService.getAllTPs(),
                          apiService.getAllATPs(),
                          apiService.getAllPROTAs(),
                          apiService.getAllKKTPs(),
                          apiService.getAllPROSEMs(),
                          apiService.getAllRPMs(),
                          apiService.getAdminSettings(),
                        ]);
                        exportFullBackupAsJSON(tps, atps, protas, kktps, prosems, rpms, settings);
                        onSuccess('Berhasil mengekspor seluruh cadangan data aplikasi dan Pengaturan Admin ke file JSON.');
                      } catch (e: any) {
                        setErrorMsg(e.message || 'Gagal mengekspor data.');
                      } finally {
                        setIsExporting(false);
                      }
                    }}
                    disabled={isExporting}
                    className="w-full p-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-left transition flex items-center justify-between shadow-md"
                  >
                    <div>
                      <span className="block font-bold text-sm text-white">
                        Ekspor Seluruh Cadangan Data (Full Backup JSON)
                      </span>
                      <span className="text-xs text-teal-100">
                        Unduh semua TP, Perangkat Ajar, serta Pengaturan Admin di sistem
                      </span>
                    </div>
                    <DownloadIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
              <AlertIcon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5 font-bold">Gagal memproses JSON:</strong>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Validation & Preview Section */}
          {parseResult && parseResult.isValid && (
            <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-teal-200/80 pb-3">
                <div className="flex items-center gap-2 text-teal-800 font-bold text-sm">
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                    ✓
                  </div>
                  Struktur JSON Valid & Siap Diimpor
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-teal-200/70 text-teal-900 rounded-full">
                  Tipe: {parseResult.type}
                </span>
              </div>

              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-teal-100 shadow-sm text-center">
                  <span className="block text-2xl font-black text-teal-700">{parseResult.summary.tpCount}</span>
                  <span className="text-xs text-slate-500 font-medium">Tujuan Pembelajaran (TP)</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-teal-100 shadow-sm text-center">
                  <span className="block text-2xl font-black text-teal-700">{parseResult.summary.atpCount}</span>
                  <span className="text-xs text-slate-500 font-medium">ATP</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-teal-100 shadow-sm text-center">
                  <span className="block text-2xl font-black text-teal-700">
                    {parseResult.summary.protaCount + parseResult.summary.prosemCount + parseResult.summary.kktpCount + parseResult.summary.rpmCount}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Perangkat Ajar Lain (PROTA/KKTP/RPM)</span>
                </div>
              </div>

              {/* Subject & Details */}
              <div className="text-xs text-slate-700 space-y-1 pt-1">
                <p>
                  <strong>Mata Pelajaran dalam JSON:</strong>{' '}
                  {parseResult.summary.subjects.length > 0
                    ? parseResult.summary.subjects.join(', ')
                    : 'Umum'}
                </p>
                <p>
                  <strong>Kelas/Fase:</strong>{' '}
                  {parseResult.summary.grades.length > 0
                    ? parseResult.summary.grades.join(', ')
                    : '7'}
                </p>
                {parseResult.summary.creatorName && (
                  <p>
                    <strong>Pembuat:</strong> {parseResult.summary.creatorName}
                  </p>
                )}
                {parseResult.summary.hasSettings && (
                  <p className="text-teal-800 font-bold flex items-center gap-1.5 pt-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Termasuk Pengaturan Admin (Tahun Pelajaran, Kepala Madrasah, Mapel, dll)
                  </p>
                )}
              </div>

              {/* Subject Mapping Override Option */}
              {currentSubject && parseResult.summary.subjects.some(s => s !== currentSubject) && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={overrideSubject}
                      onChange={(e) => setOverrideSubject(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span>
                      Ubah Mata Pelajaran yang diimpor menjadi <strong className="text-teal-700">{currentSubject}</strong> (sesuai dasbor saat ini)
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg transition"
            disabled={isImporting}
          >
            Bersihkan Input
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition"
              disabled={isImporting}
            >
              Batal
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={!parseResult || !parseResult.isValid || isImporting}
              className="px-6 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Mengimpor Data...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Impor Data Sekarang
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportJsonModal;
