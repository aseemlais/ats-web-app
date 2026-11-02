/**
 * User-scoped client-side draft persistence for DataPattern ATS.
 * Preserves recruiter workspace state (job details, screening queue, results,
 * active view, and SharePoint links) across browser tab switches, re-focus,
 * and accidental page refreshes without duplicating screening jobs or leaking
 * data between accounts.
 */

export interface SerializableCandidate {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  resumeText: string;
  status: 'uploaded' | 'screening' | 'completed' | 'failed';
  result: any | null;
  error?: string;
  candidateName?: string;
  originalFilename?: string;
  fromRepository?: boolean;
}

export interface AtsDraftPayload {
  jobTitle: string;
  jobDescription: string;
  jdFileName: string | null;
  activeView: 'screening' | 'repository';
  sharePointLink?: string;
  candidates: any[];
}

export interface StoredAtsDraft {
  version: number;
  userId?: string;
  jobTitle: string;
  jobDescription: string;
  jdFileName: string | null;
  activeView: 'screening' | 'repository';
  sharePointLink?: string;
  candidates: SerializableCandidate[];
  updatedAt: number;
}

const STORAGE_PREFIX = 'dp_ats_draft_';
const STORAGE_VERSION = 1;

/**
 * Normalizes user identifier (preferably Supabase User UUID) to a consistent storage key.
 * Pattern: dp_ats_draft_<user_id>
 */
export function getStorageKey(userIdentifier?: string | null): string {
  if (!userIdentifier || !userIdentifier.trim()) {
    return `${STORAGE_PREFIX}anonymous`;
  }
  const clean = userIdentifier.trim().toLowerCase().replace(/[^a-z0-9_@.-]/g, '_');
  return `${STORAGE_PREFIX}${clean}`;
}

/**
 * Convert a Candidate into a JSON-safe serializable object.
 * Safety Rule: Any candidate interrupted mid-screening is serialized with status 'uploaded'
 * and an informative note, so restoring will NEVER trigger automatic re-screening.
 */
export function serializeCandidate(c: any): SerializableCandidate {
  const fileName =
    c.file?.name ||
    c.originalFilename ||
    (c.candidateName ? `${c.candidateName}.txt` : 'resume.txt');
  const fileType = c.file?.type || 'text/plain';
  const fileSize = typeof c.file?.size === 'number' ? c.file.size : 0;

  const isInterrupted = c.status === 'screening';
  const safeStatus = isInterrupted ? 'uploaded' : c.status;
  const safeError = isInterrupted
    ? 'Screening was interrupted by reload or tab switch. Click Screen to run again.'
    : c.error;

  return {
    id: String(c.id),
    fileName,
    fileType,
    fileSize,
    resumeText: c.resumeText || '',
    status: safeStatus,
    result: c.result || null,
    error: safeError,
    candidateName: c.candidateName,
    originalFilename: c.originalFilename || fileName,
    fromRepository: Boolean(c.fromRepository),
  };
}

/**
 * Reconstitutes a runtime Candidate from its serialized representation,
 * synthesizing an in-memory File object from the saved resumeText.
 */
export function deserializeCandidate(s: SerializableCandidate): any {
  let fileObj: File;
  try {
    const blob = new Blob([s.resumeText || ''], { type: s.fileType || 'text/plain' });
    fileObj = new File([blob], s.fileName || 'resume.txt', {
      type: s.fileType || 'text/plain',
      lastModified: Date.now(),
    });
  } catch {
    fileObj = {
      name: s.fileName || 'resume.txt',
      size: s.fileSize || (s.resumeText ? s.resumeText.length : 0),
      type: s.fileType || 'text/plain',
    } as any;
  }

  const isInterrupted = s.status === 'screening';
  const safeStatus = isInterrupted ? 'uploaded' : s.status;
  const safeError = isInterrupted
    ? 'Screening was interrupted before completion. Click Screen to run again.'
    : s.error;

  return {
    id: s.id,
    file: fileObj,
    resumeText: s.resumeText || '',
    status: safeStatus,
    result: s.result || null,
    error: safeError,
    candidateName: s.candidateName,
    originalFilename: s.originalFilename || s.fileName,
    fromRepository: Boolean(s.fromRepository),
  };
}

/**
 * Save user ATS draft into localStorage.
 * Always user-scoped. Never stores auth tokens or passwords.
 */
export function saveAtsDraft(userIdentifier: string | undefined | null, data: AtsDraftPayload): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!userIdentifier || !userIdentifier.trim()) return; // Never save draft without a user identity

  try {
    const key = getStorageKey(userIdentifier);
    const serializedCandidates: SerializableCandidate[] = (data.candidates || []).map(serializeCandidate);

    const stored: StoredAtsDraft = {
      version: STORAGE_VERSION,
      userId: userIdentifier,
      jobTitle: data.jobTitle || '',
      jobDescription: data.jobDescription || '',
      jdFileName: data.jdFileName || null,
      activeView: data.activeView === 'repository' ? 'repository' : 'screening',
      sharePointLink: data.sharePointLink || '',
      candidates: serializedCandidates,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(key, JSON.stringify(stored));
  } catch (err) {
    console.warn('[ats-storage] Unable to save draft to localStorage:', err);
  }
}

/**
 * Load user ATS draft from localStorage.
 * Supports transparent migration from legacy email-based keys to Supabase User UUID keys.
 */
export function loadAtsDraft(userIdentifier: string | undefined | null, fallbackEmail?: string | null): AtsDraftPayload | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  if (!userIdentifier || !userIdentifier.trim()) return null;

  try {
    const primaryKey = getStorageKey(userIdentifier);
    let raw = window.localStorage.getItem(primaryKey);

    // Legacy migration check: if primary key not found and fallback email exists
    if (!raw && fallbackEmail && fallbackEmail !== userIdentifier) {
      const legacyKey = getStorageKey(fallbackEmail);
      raw = window.localStorage.getItem(legacyKey);
      if (raw) {
        // Migrate legacy draft to primary UUID key
        window.localStorage.setItem(primaryKey, raw);
        window.localStorage.removeItem(legacyKey);
      }
    }

    if (!raw) return null;

    const parsed: StoredAtsDraft = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.map(deserializeCandidate)
      : [];

    return {
      jobTitle: parsed.jobTitle || '',
      jobDescription: parsed.jobDescription || '',
      jdFileName: parsed.jdFileName || null,
      activeView: parsed.activeView === 'repository' ? 'repository' : 'screening',
      sharePointLink: parsed.sharePointLink || '',
      candidates,
    };
  } catch (err) {
    console.warn('[ats-storage] Unable to load draft from localStorage:', err);
    return null;
  }
}

/**
 * Clear specific user's ATS draft (e.g. when user clicks "Start New Screening").
 */
export function clearAtsDraft(userIdentifier: string | undefined | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!userIdentifier || !userIdentifier.trim()) return;
  try {
    const key = getStorageKey(userIdentifier);
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn('[ats-storage] Unable to remove draft:', err);
  }
}

/**
 * Clear all ATS drafts from localStorage (e.g. on recruiter sign-out or session reset).
 */
export function clearAllAtsDrafts(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[ats-storage] Unable to clear ATS drafts:', err);
  }
}
