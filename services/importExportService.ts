import { TPData, ATPData, PROTAData, KKTPData, PROSEMData, RPMData } from '../types';
import * as apiService from './dbService';
import { AdminSettings } from './dbService';

export interface ImportSummary {
  tpCount: number;
  atpCount: number;
  protaCount: number;
  kktpCount: number;
  prosemCount: number;
  rpmCount: number;
  subjects: string[];
  grades: string[];
  creatorName?: string;
  hasSettings?: boolean;
}

export interface ParsedJSONResult {
  isValid: boolean;
  error?: string;
  type: 'SINGLE_TP' | 'MULTIPLE_TPS' | 'FULL_BACKUP' | 'ATP' | 'PROTA' | 'KKTP' | 'PROSEM' | 'RPM' | 'UNKNOWN';
  summary: ImportSummary;
  rawPayload: any;
}

/**
 * Validates and parses raw text or JSON object into a standard import structure
 */
export const parseAndValidateJSON = (jsonInput: string | any): ParsedJSONResult => {
  let parsed: any;
  if (typeof jsonInput === 'string') {
    try {
      parsed = JSON.parse(jsonInput);
    } catch (err: any) {
      return {
        isValid: false,
        error: `Format JSON tidak valid: ${err.message}`,
        type: 'UNKNOWN',
        summary: createEmptySummary(),
        rawPayload: null,
      };
    }
  } else {
    parsed = jsonInput;
  }

  if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
    return {
      isValid: false,
      error: 'Data JSON harus berupa objek atau array data.',
      type: 'UNKNOWN',
      summary: createEmptySummary(),
      rawPayload: null,
    };
  }

  // Case 1: Array of TPs or Array of items
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        isValid: false,
        error: 'Array JSON kosong, tidak ada data untuk diimpor.',
        type: 'UNKNOWN',
        summary: createEmptySummary(),
        rawPayload: null,
      };
    }

    // Check if items are TP items (contain subject, grade, tpGroups or cpElements)
    const validTps = parsed.filter(item => isTPObject(item));
    if (validTps.length > 0) {
      const summary = extractSummaryFromTPs(validTps);
      return {
        isValid: true,
        type: 'MULTIPLE_TPS',
        summary,
        rawPayload: { tps: validTps },
      };
    }

    return {
      isValid: false,
      error: 'Struktur array JSON tidak mengenali objek Tujuan Pembelajaran (TP).',
      type: 'UNKNOWN',
      summary: createEmptySummary(),
      rawPayload: null,
    };
  }

  // Case 2: Full Backup Package { type: "AGRU_BACKUP", tps: [...], ... }
  if (parsed.tps && Array.isArray(parsed.tps)) {
    const tps: TPData[] = parsed.tps.filter(isTPObject);
    const atps: ATPData[] = Array.isArray(parsed.atps) ? parsed.atps : [];
    const protas: PROTAData[] = Array.isArray(parsed.protas) ? parsed.protas : [];
    const kktps: KKTPData[] = Array.isArray(parsed.kktps) ? parsed.kktps : [];
    const prosems: PROSEMData[] = Array.isArray(parsed.prosems) ? parsed.prosems : [];
    const rpms: RPMData[] = Array.isArray(parsed.rpms) ? parsed.rpms : [];
    const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : undefined;

    const summary = extractSummaryFromTPs(tps);
    summary.atpCount = atps.length;
    summary.protaCount = protas.length;
    summary.kktpCount = kktps.length;
    summary.prosemCount = prosems.length;
    summary.rpmCount = rpms.length;
    if (settings) summary.hasSettings = true;

    return {
      isValid: true,
      type: 'FULL_BACKUP',
      summary,
      rawPayload: { tps, atps, protas, kktps, prosems, rpms, settings },
    };
  }

  // Case 3: SINGLE_TP_BUNDLE wrapper { type: "SINGLE_TP_BUNDLE", tp: { ... }, settings?: { ... } }
  if (parsed.tp && isTPObject(parsed.tp)) {
    const tp = parsed.tp;
    const atps = Array.isArray(tp.atps) ? tp.atps : (Array.isArray(parsed.atps) ? parsed.atps : []);
    const protas = Array.isArray(tp.protas) ? tp.protas : (Array.isArray(parsed.protas) ? parsed.protas : []);
    const kktps = Array.isArray(tp.kktps) ? tp.kktps : (Array.isArray(parsed.kktps) ? parsed.kktps : []);
    const prosems = Array.isArray(tp.prosems) ? tp.prosems : (Array.isArray(parsed.prosems) ? parsed.prosems : []);
    const rpms = Array.isArray(tp.rpms) ? tp.rpms : (Array.isArray(parsed.rpms) ? parsed.rpms : []);
    const settings = (parsed.settings || tp.settings) && typeof (parsed.settings || tp.settings) === 'object' ? (parsed.settings || tp.settings) : undefined;

    const summary = extractSummaryFromTPs([tp]);
    summary.atpCount = atps.length;
    summary.protaCount = protas.length;
    summary.kktpCount = kktps.length;
    summary.prosemCount = prosems.length;
    summary.rpmCount = rpms.length;
    if (settings) summary.hasSettings = true;

    return {
      isValid: true,
      type: 'SINGLE_TP',
      summary,
      rawPayload: { tps: [tp], atps, protas, kktps, prosems, rpms, settings },
    };
  }

  // Case 4: Single TP directly (may contain nested atps, protas, etc.)
  if (isTPObject(parsed)) {
    const tp = parsed as TPData & {
      atps?: ATPData[];
      protas?: PROTAData[];
      kktps?: KKTPData[];
      prosems?: PROSEMData[];
      rpms?: RPMData[];
    };

    const atps = Array.isArray(tp.atps) ? tp.atps : [];
    const protas = Array.isArray(tp.protas) ? tp.protas : [];
    const kktps = Array.isArray(tp.kktps) ? tp.kktps : [];
    const prosems = Array.isArray(tp.prosems) ? tp.prosems : [];
    const rpms = Array.isArray(tp.rpms) ? tp.rpms : [];
    const settings = (parsed.settings || (tp as any).settings) && typeof (parsed.settings || (tp as any).settings) === 'object' ? (parsed.settings || (tp as any).settings) : undefined;

    const summary = extractSummaryFromTPs([tp]);
    summary.atpCount = atps.length;
    summary.protaCount = protas.length;
    summary.kktpCount = kktps.length;
    summary.prosemCount = prosems.length;
    summary.rpmCount = rpms.length;
    if (settings) summary.hasSettings = true;

    return {
      isValid: true,
      type: 'SINGLE_TP',
      summary,
      rawPayload: { tps: [tp], atps, protas, kktps, prosems, rpms, settings },
    };
  }

  // Case 4: Individual ATP
  if (parsed.content && Array.isArray(parsed.content) && parsed.subject && parsed.tpId) {
    const summary = createEmptySummary();
    summary.atpCount = 1;
    summary.subjects = [parsed.subject];
    return {
      isValid: true,
      type: 'ATP',
      summary,
      rawPayload: { atps: [parsed] },
    };
  }

  return {
    isValid: false,
    error: 'Format JSON tidak dikenali. Pastikan file JSON berisi data TP atau Perangkat Ajar yang valid.',
    type: 'UNKNOWN',
    summary: createEmptySummary(),
    rawPayload: null,
  };
};

/**
 * Execute import of parsed data into Firestore
 */
export const importParsedJSONToDatabase = async (
  parsedResult: ParsedJSONResult,
  subjectOverride?: string
): Promise<{ success: boolean; importedCount: number; message: string }> => {
  if (!parsedResult.isValid || !parsedResult.rawPayload) {
    throw new Error(parsedResult.error || 'Data JSON tidak valid untuk diimpor.');
  }

  const { tps = [], atps = [], protas = [], kktps = [], prosems = [], rpms = [], settings } = parsedResult.rawPayload;
  let importedTPCount = 0;
  let importedItemCount = 0;

  const tpIdMap: Record<string, string> = {};
  const atpIdMap: Record<string, string> = {};
  const protaIdMap: Record<string, string> = {};

  // 0. Import Admin Settings if available
  let settingsImported = false;
  if (settings && typeof settings === 'object') {
    try {
      await apiService.saveAdminSettings(settings);
      settingsImported = true;
    } catch (err) {
      console.warn("Gagal mengimpor pengaturan admin:", err);
    }
  }

  // 1. Import TPs
  for (const rawTp of tps) {
    const subject = subjectOverride || rawTp.subject || 'Umum';
    const grade = rawTp.grade || '7';

    const tpPayload: Omit<TPData, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
      subject,
      grade,
      cpElements: rawTp.cpElements || [],
      creatorEmail: rawTp.creatorEmail || '',
      creatorName: rawTp.creatorName || 'Guru',
      cpSourceVersion: rawTp.cpSourceVersion || 'KMA 347',
      additionalNotes: rawTp.additionalNotes || '',
      tpGroups: rawTp.tpGroups || [],
    };

    const savedTp = await apiService.saveTP(tpPayload);
    if (rawTp.id) {
      tpIdMap[rawTp.id] = savedTp.id!;
    }
    importedTPCount++;
    importedItemCount++;

    // If child devices are directly nested on rawTp
    if (Array.isArray(rawTp.atps)) {
      for (const atp of rawTp.atps) {
        const savedAtp = await apiService.saveATP({
          subject: subject,
          tpId: savedTp.id!,
          content: atp.content || [],
          creatorEmail: atp.creatorEmail || '',
          creatorName: atp.creatorName || rawTp.creatorName || 'Guru',
        });
        if (atp.id) atpIdMap[atp.id] = savedAtp.id;
        importedItemCount++;
      }
    }

    if (Array.isArray(rawTp.protas)) {
      for (const prota of rawTp.protas) {
        const savedProta = await apiService.savePROTA({
          subject: subject,
          tpId: savedTp.id!,
          jamPertemuan: prota.jamPertemuan || 2,
          content: prota.content || [],
          creatorName: prota.creatorName || rawTp.creatorName || 'Guru',
        });
        if (prota.id) protaIdMap[prota.id] = savedProta.id;
        importedItemCount++;
      }
    }

    if (Array.isArray(rawTp.rpms)) {
      for (const rpm of rawTp.rpms) {
        await apiService.saveRPM({
          subject: subject,
          tpId: savedTp.id!,
          grade: grade,
          semester: rpm.semester || 'Ganjil',
          inputData: rpm.inputData || {},
          htmlContent: rpm.htmlContent || '',
          creatorName: rpm.creatorName || rawTp.creatorName || 'Guru',
        });
        importedItemCount++;
      }
    }
  }

  // 2. Import top-level ATPs (if from package or separated list)
  for (const atp of atps) {
    const targetTpId = tpIdMap[atp.tpId] || atp.tpId;
    if (targetTpId) {
      const savedAtp = await apiService.saveATP({
        subject: subjectOverride || atp.subject || 'Umum',
        tpId: targetTpId,
        content: atp.content || [],
        creatorEmail: atp.creatorEmail || '',
        creatorName: atp.creatorName || 'Guru',
      });
      if (atp.id) atpIdMap[atp.id] = savedAtp.id;
      importedItemCount++;
    }
  }

  // 3. Import top-level PROTAs
  for (const prota of protas) {
    const targetTpId = tpIdMap[prota.tpId] || prota.tpId;
    if (targetTpId) {
      const savedProta = await apiService.savePROTA({
        subject: subjectOverride || prota.subject || 'Umum',
        tpId: targetTpId,
        jamPertemuan: prota.jamPertemuan || 2,
        content: prota.content || [],
        creatorName: prota.creatorName || 'Guru',
      });
      if (prota.id) protaIdMap[prota.id] = savedProta.id;
      importedItemCount++;
    }
  }

  // 4. Import top-level KKTPs
  for (const kktp of kktps) {
    const targetAtpId = atpIdMap[kktp.atpId] || kktp.atpId;
    if (targetAtpId) {
      await apiService.saveKKTP({
        subject: subjectOverride || kktp.subject || 'Umum',
        atpId: targetAtpId,
        grade: kktp.grade || '7',
        semester: kktp.semester || 'Ganjil',
        content: kktp.content || [],
      });
      importedItemCount++;
    }
  }

  // 5. Import top-level PROSEMs
  for (const prosem of prosems) {
    const targetProtaId = protaIdMap[prosem.protaId] || prosem.protaId;
    if (targetProtaId) {
      await apiService.savePROSEM({
        subject: subjectOverride || prosem.subject || 'Umum',
        protaId: targetProtaId,
        grade: prosem.grade || '7',
        semester: prosem.semester || 'Ganjil',
        headers: prosem.headers || [],
        content: prosem.content || [],
      });
      importedItemCount++;
    }
  }

  // 6. Import top-level RPMs
  for (const rpm of rpms) {
    const targetTpId = tpIdMap[rpm.tpId] || rpm.tpId;
    if (targetTpId) {
      await apiService.saveRPM({
        subject: subjectOverride || rpm.subject || 'Umum',
        tpId: targetTpId,
        grade: rpm.grade || '7',
        semester: rpm.semester || 'Ganjil',
        inputData: rpm.inputData || {},
        htmlContent: rpm.htmlContent || '',
        creatorName: rpm.creatorName || 'Guru',
      });
      importedItemCount++;
    }
  }

  const importedParts: string[] = [];
  if (importedTPCount > 0) importedParts.push(`${importedTPCount} Tujuan Pembelajaran (TP)`);
  if (importedItemCount > importedTPCount) importedParts.push(`${importedItemCount - importedTPCount} perangkat ajar (ATP/Prota/KKTP/Prosem/RPM)`);
  if (settingsImported) importedParts.push('Pengaturan Admin');

  const summaryMsg = importedParts.length > 0
    ? `Berhasil mengimpor: ${importedParts.join(', ')}.`
    : `Pengimporan selesai (${importedItemCount} item).`;

  return {
    success: true,
    importedCount: importedItemCount,
    message: summaryMsg,
  };
};

/**
 * Export single TP with optional attached devices to JSON file
 */
export const exportTPBundleAsJSON = (
  tp: TPData,
  atps?: ATPData[],
  protas?: PROTAData[],
  kktps?: KKTPData[],
  prosems?: PROSEMData[],
  rpms?: RPMData[],
  settings?: AdminSettings | null
) => {
  const exportPayload = {
    appName: 'Asisten Guru (AGRU)',
    version: '1.0',
    type: 'SINGLE_TP_BUNDLE',
    exportedAt: new Date().toISOString(),
    settings: settings || null,
    tp: {
      ...tp,
      atps: atps || [],
      protas: protas || [],
      kktps: kktps || [],
      prosems: prosems || [],
      rpms: rpms || [],
    },
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeSubject = (tp.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const safeGrade = (tp.grade || '7').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `TP_${safeSubject}_Kelas_${safeGrade}_${Date.now()}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export full backup as JSON file
 */
export const exportFullBackupAsJSON = (
  tps: TPData[],
  atps: ATPData[] = [],
  protas: PROTAData[] = [],
  kktps: KKTPData[] = [],
  prosems: PROSEMData[] = [],
  rpms: RPMData[] = [],
  settings?: AdminSettings | null
) => {
  const exportPayload = {
    appName: 'Asisten Guru (AGRU)',
    version: '1.0',
    type: 'AGRU_BACKUP',
    exportedAt: new Date().toISOString(),
    settings: settings || null,
    tps,
    atps,
    protas,
    kktps,
    prosems,
    rpms,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `AGRU_Backup_Data_${new Date().toISOString().slice(0, 10)}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- Helpers ---

const isTPObject = (obj: any): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  return (
    typeof obj.subject === 'string' &&
    (Array.isArray(obj.tpGroups) || Array.isArray(obj.cpElements))
  );
};

const createEmptySummary = (): ImportSummary => ({
  tpCount: 0,
  atpCount: 0,
  protaCount: 0,
  kktpCount: 0,
  prosemCount: 0,
  rpmCount: 0,
  subjects: [],
  grades: [],
});

const extractSummaryFromTPs = (tps: TPData[]): ImportSummary => {
  const subjectsSet = new Set<string>();
  const gradesSet = new Set<string>();
  let creatorName: string | undefined;

  tps.forEach(tp => {
    if (tp.subject) subjectsSet.add(tp.subject);
    if (tp.grade) gradesSet.add(tp.grade);
    if (tp.creatorName && !creatorName) creatorName = tp.creatorName;
  });

  return {
    tpCount: tps.length,
    atpCount: 0,
    protaCount: 0,
    kktpCount: 0,
    prosemCount: 0,
    rpmCount: 0,
    subjects: Array.from(subjectsSet),
    grades: Array.from(gradesSet),
    creatorName,
  };
};
