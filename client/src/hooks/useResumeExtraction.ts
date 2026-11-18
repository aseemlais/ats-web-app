import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';

// ---------------------------------------------------------------------------
// Types & Contracts
// ---------------------------------------------------------------------------

export interface EducationEntry {
  degree: string;
  tier?: 'doctorate' | 'master' | 'bachelor' | 'associate' | 'diploma' | 'none';
  institution?: string | null;
  fieldOfStudy?: string | null;
  year?: string | null;
}

export interface WorkExperienceEntry {
  title: string;
  company?: string | null;
  dates?: string | null;
  durationYears?: number;
  isCurrent?: boolean;
  isInternship?: boolean;
  description?: string | null;
}

export interface ExtractedResumeData {
  candidateName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  jobTitle: string | null;
  jobRole?: string | null;
  totalExperienceYears: number;
  workExperienceYears: number;
  internshipYears: number;
  skills: string[];
  education: EducationEntry[];
  degrees: string[];
  workExperience: WorkExperienceEntry[];
  certifications: string[];
  projects: string[];
  source?: string;
  extractionSource?: string;
  resumeText?: string;
  candidateId?: string | null;
  isDuplicate?: boolean;
}

export type ExtractionJobStatus =
  | 'idle'
  | 'uploading'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface UseResumeExtractionOptions {
  /** Initial backoff interval in ms (default: 1500) */
  initialPollIntervalMs?: number;
  /** Exponential multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Max ceiling for backoff polling interval in ms (default: 10000 = 10s) */
  maxPollIntervalMs?: number;
  /** Total timeout in ms before giving up (default: 600000 = 10 minutes) */
  overallTimeoutMs?: number;
  /** Number of consecutive 5xx/network errors tolerated before failing (default: 5) */
  maxConsecutiveErrors?: number;
  /** Base URL for extraction endpoints (default: /api/extract) */
  apiBaseUrl?: string;
  /** sessionStorage key for persistent job recovery across tab reloads */
  sessionStorageKey?: string;
  /** Whether to automatically re-attach to an in-flight job from sessionStorage on mount (default: true) */
  autoResumeFromSession?: boolean;
  onSuccess?: (data: ExtractedResumeData) => void;
  onError?: (err: Error) => void;
  onStatusChange?: (status: ExtractionJobStatus, message: string) => void;
}

export interface StoredJobSession {
  jobId: string;
  filename?: string;
  submittedAt: number;
}

export const DEFAULT_SESSION_KEY = 'ats_active_extraction_job';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates exponential backoff with +/- 20% jitter, capped at maxPollIntervalMs.
 */
export function calculateBackoffWithJitter(
  attempt: number,
  initialMs = 1500,
  multiplier = 1.5,
  maxMs = 10000,
): number {
  const rawInterval = Math.min(maxMs, initialMs * Math.pow(multiplier, attempt));
  // Jitter factor in [0.8, 1.2]
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(rawInterval * jitterFactor);
}

function saveJobSession(key: string, jobId: string, filename?: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const payload: StoredJobSession = {
      jobId,
      filename,
      submittedAt: Date.now(),
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn('[useResumeExtraction] Failed to write to sessionStorage:', err);
  }
}

function clearJobSession(key: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.removeItem(key);
  } catch (err) {
    console.warn('[useResumeExtraction] Failed to clear sessionStorage:', err);
  }
}

function loadJobSession(key: string, maxAgeMs: number): StoredJobSession | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredJobSession;
    if (!data || !data.jobId) return null;
    if (Date.now() - (data.submittedAt || 0) > maxAgeMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main Hook
// ---------------------------------------------------------------------------

export function useResumeExtraction(options: UseResumeExtractionOptions = {}) {
  const {
    initialPollIntervalMs = 1500,
    backoffMultiplier = 1.5,
    maxPollIntervalMs = 10000,
    overallTimeoutMs = 600000, // 10 minutes
    maxConsecutiveErrors = 5,
    apiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EXTRACTION_API_URL) || '/api/extract',
    sessionStorageKey = DEFAULT_SESSION_KEY,
    autoResumeFromSession = true,
    onSuccess,
    onError,
    onStatusChange,
  } = options;

  const [status, setStatusState] = useState<ExtractionJobStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [displayMessage, setDisplayMessage] = useState<string>('');

  const activeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const consecutiveErrorsRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Helper to sync status + distinct human UI message
  const updateStatus = useCallback(
    (newStatus: ExtractionJobStatus, customMessage?: string) => {
      setStatusState(newStatus);
      let msg = customMessage || '';
      if (!msg) {
        switch (newStatus) {
          case 'uploading':
            msg = 'Uploading resume...';
            break;
          case 'pending':
            msg = 'Queued for analysis...';
            break;
          case 'processing':
            msg = 'Analyzing resume with ATS model...';
            break;
          case 'completed':
            msg = 'Extraction completed successfully';
            break;
          case 'failed':
            msg = 'Resume extraction failed';
            break;
          case 'cancelled':
            msg = 'Extraction cancelled';
            break;
          default:
            msg = '';
        }
      }
      setDisplayMessage(msg);
      onStatusChange?.(newStatus, msg);
    },
    [onStatusChange],
  );

  const clearTimer = useCallback(() => {
    if (activeTimerRef.current) {
      clearTimeout(activeTimerRef.current);
      activeTimerRef.current = null;
    }
  }, []);

  const abortInFlight = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cancel button callback
  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    abortInFlight();
    clearTimer();
    clearJobSession(sessionStorageKey);
    updateStatus('cancelled', 'Extraction cancelled.');
    setProgress(0);
  }, [abortInFlight, clearTimer, sessionStorageKey, updateStatus]);

  const reset = useCallback(() => {
    cancel();
    setJobId(null);
    setResult(null);
    setError(null);
    updateStatus('idle', '');
    setProgress(0);
  }, [cancel, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      abortInFlight();
      clearTimer();
    };
  }, [abortInFlight, clearTimer]);

  // Polling loop with exponential backoff, jitter, timeout, error tolerance
  const pollJobStatus = useCallback(
    async (id: string, attempt = 0): Promise<ExtractedResumeData> => {
      if (isCancelledRef.current) {
        throw new Error('Extraction was cancelled.');
      }

      // Check overall 10-minute timeout
      if (Date.now() - startTimeRef.current > overallTimeoutMs) {
        clearJobSession(sessionStorageKey);
        const timeoutErr = new Error('Extraction timed out after 10 minutes.');
        updateStatus('failed', timeoutErr.message);
        setError(timeoutErr.message);
        onError?.(timeoutErr);
        throw timeoutErr;
      }

      // Normalized poll URL: e.g. /api/extract/:id
      const cleanBase = apiBaseUrl.replace(/\/$/, '');
      const pollUrl = `${cleanBase}/${encodeURIComponent(id)}`;

      abortInFlight();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let response: Response;
      try {
        response = await apiFetch(pollUrl, { signal: controller.signal });
      } catch (fetchErr: any) {
        if (isCancelledRef.current || fetchErr?.name === 'AbortError') {
          throw new Error('Extraction was cancelled.');
        }

        // Transient network failure
        consecutiveErrorsRef.current += 1;
        console.warn(
          `[useResumeExtraction] Network error during poll (count=${consecutiveErrorsRef.current}/${maxConsecutiveErrors}):`,
          fetchErr,
        );

        if (consecutiveErrorsRef.current > maxConsecutiveErrors) {
          clearJobSession(sessionStorageKey);
          const networkErr = new Error(
            `Extraction failed: ${consecutiveErrorsRef.current} consecutive network errors encountered.`,
          );
          updateStatus('failed', networkErr.message);
          setError(networkErr.message);
          onError?.(networkErr);
          throw networkErr;
        }

        // Wait with backoff and retry
        const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
        await new Promise((resolve) => {
          activeTimerRef.current = setTimeout(resolve, delay);
        });
        return pollJobStatus(id, attempt + 1);
      }

      // Handle 5xx Server Errors (transient tolerance)
      if (response.status >= 500) {
        consecutiveErrorsRef.current += 1;
        console.warn(
          `[useResumeExtraction] Server ${response.status} during poll (count=${consecutiveErrorsRef.current}/${maxConsecutiveErrors})`,
        );

        if (consecutiveErrorsRef.current > maxConsecutiveErrors) {
          clearJobSession(sessionStorageKey);
          const serverErr = new Error(
            `Extraction failed after ${consecutiveErrorsRef.current} consecutive server (${response.status}) errors.`,
          );
          updateStatus('failed', serverErr.message);
          setError(serverErr.message);
          onError?.(serverErr);
          throw serverErr;
        }

        const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
        await new Promise((resolve) => {
          activeTimerRef.current = setTimeout(resolve, delay);
        });
        return pollJobStatus(id, attempt + 1);
      }

      // If we received a successful or valid response, reset consecutive errors
      consecutiveErrorsRef.current = 0;

      if (!response.ok) {
        // Handle 404 propagation race in first 5 attempts
        if (response.status === 404 && attempt < 5) {
          const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
          await new Promise((resolve) => {
            activeTimerRef.current = setTimeout(resolve, delay);
          });
          return pollJobStatus(id, attempt + 1);
        }

        clearJobSession(sessionStorageKey);
        const errData = await response.json().catch(() => ({}));
        const pollErr = new Error(errData.error || errData.detail || `Failed to query job status (${response.status})`);
        updateStatus('failed', pollErr.message);
        setError(pollErr.message);
        onError?.(pollErr);
        throw pollErr;
      }

      const jobData = await response.json();
      const currentStatus: ExtractionJobStatus = jobData.status;

      // 1. Terminal Completed State
      if (currentStatus === 'completed' && jobData.result) {
        clearJobSession(sessionStorageKey);
        updateStatus('completed', 'Extraction completed successfully');
        setProgress(100);
        setResult(jobData.result);
        onSuccess?.(jobData.result);
        return jobData.result;
      }

      // 2. Terminal Failed State
      if (currentStatus === 'failed') {
        clearJobSession(sessionStorageKey);
        const errorMsg = jobData.error || 'Resume extraction failed on server.';
        updateStatus('failed', errorMsg);
        setError(errorMsg);
        const terminalErr = new Error(errorMsg);
        onError?.(terminalErr);
        throw terminalErr;
      }

      // 3. In-Flight States: 'pending' (Queued) vs 'processing' (Analyzing)
      if (currentStatus === 'processing') {
        updateStatus('processing', 'Analyzing resume with ATS model...');
        setProgress(Math.min(90, 35 + attempt * 3));
      } else {
        updateStatus('pending', 'Queued for analysis...');
        setProgress(25);
      }

      const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
      await new Promise((resolve) => {
        activeTimerRef.current = setTimeout(resolve, delay);
      });

      return pollJobStatus(id, attempt + 1);
    },
    [
      apiBaseUrl,
      overallTimeoutMs,
      sessionStorageKey,
      abortInFlight,
      initialPollIntervalMs,
      backoffMultiplier,
      maxPollIntervalMs,
      maxConsecutiveErrors,
      updateStatus,
      onError,
      onSuccess,
    ],
  );

  // Resume submission entrypoint
  const extractResume = useCallback(
    async (file: File): Promise<ExtractedResumeData> => {
      isCancelledRef.current = false;
      consecutiveErrorsRef.current = 0;
      startTimeRef.current = Date.now();
      abortInFlight();
      clearTimer();

      updateStatus('uploading', 'Uploading resume...');
      setError(null);
      setResult(null);
      setProgress(10);

      const formData = new FormData();
      formData.append('file', file);

      const cleanBase = apiBaseUrl.replace(/\/$/, '');
      const submitUrl = cleanBase;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await apiFetch(submitUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        // Handle Queue Saturation / Rate Limit (429)
        if (response.status === 429) {
          clearJobSession(sessionStorageKey);
          const queueFullErr = new Error(
            'The extraction service is currently at maximum capacity. Please wait a moment and try again.',
          );
          updateStatus('failed', queueFullErr.message);
          setError(queueFullErr.message);
          onError?.(queueFullErr);
          throw queueFullErr;
        }

        if (!response.ok && response.status !== 202) {
          clearJobSession(sessionStorageKey);
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error || errData.detail || `Upload failed with status ${response.status}`;
          const uploadErr = new Error(errMsg);
          updateStatus('failed', errMsg);
          setError(errMsg);
          onError?.(uploadErr);
          throw uploadErr;
        }

        const data = await response.json();

        // Immediate Cache Hit (200 OK)
        if (response.status === 200 && data.status === 'completed' && data.result) {
          clearJobSession(sessionStorageKey);
          updateStatus('completed', 'Extraction completed (served from cache)');
          setProgress(100);
          setJobId(data.job_id);
          setResult(data.result);
          onSuccess?.(data.result);
          return data.result;
        }

        // Asynchronous Job Enqueued (202 Accepted)
        if (response.status === 202 && data.job_id) {
          setJobId(data.job_id);
          saveJobSession(sessionStorageKey, data.job_id, file.name);
          updateStatus('pending', 'Queued for analysis...');
          setProgress(25);
          return await pollJobStatus(data.job_id);
        }

        throw new Error('Unexpected response format from extraction backend.');
      } catch (err: any) {
        if (!isCancelledRef.current) {
          const errMsg = err?.message || 'Failed to submit resume for extraction.';
          updateStatus('failed', errMsg);
          setError(errMsg);
          onError?.(err);
        }
        throw err;
      }
    },
    [abortInFlight, clearTimer, updateStatus, apiBaseUrl, sessionStorageKey, onError, onSuccess, pollJobStatus],
  );

  // Auto-resume from sessionStorage on mount if an active job was saved
  useEffect(() => {
    if (!autoResumeFromSession || status !== 'idle') return;

    const saved = loadJobSession(sessionStorageKey, overallTimeoutMs);
    if (saved && saved.jobId) {
      console.log(`[useResumeExtraction] Re-attaching to existing extraction job from sessionStorage: ${saved.jobId}`);
      startTimeRef.current = saved.submittedAt || Date.now();
      setJobId(saved.jobId);
      updateStatus('pending', 'Resuming extraction status check...');
      setProgress(25);
      pollJobStatus(saved.jobId).catch((err) => {
        console.warn('[useResumeExtraction] Auto-resume poll ended with:', err?.message);
      });
    }
  }, [autoResumeFromSession, overallTimeoutMs, pollJobStatus, sessionStorageKey, status, updateStatus]);

  const isLoading = useMemo(
    () => status === 'uploading' || status === 'pending' || status === 'processing',
    [status],
  );

  return {
    extractResume,
    pollJobStatus,
    cancel,
    reset,
    status,
    jobId,
    result,
    error,
    progress,
    displayMessage,
    isLoading,
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    isCancelled: status === 'cancelled',
  };
}

// ---------------------------------------------------------------------------
// Standalone Extraction Helper (for batch/sequential loops outside component state)
// ---------------------------------------------------------------------------

export async function extractResumeAsync(
  file: File,
  options: {
    apiBaseUrl?: string;
    onStatus?: (status: ExtractionJobStatus, message: string) => void;
    signal?: AbortSignal;
    initialPollIntervalMs?: number;
    backoffMultiplier?: number;
    maxPollIntervalMs?: number;
    overallTimeoutMs?: number;
    maxConsecutiveErrors?: number;
    sessionStorageKey?: string;
  } = {},
): Promise<ExtractedResumeData> {
  const {
    apiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EXTRACTION_API_URL) || '/api/extract',
    onStatus,
    signal,
    initialPollIntervalMs = 1500,
    backoffMultiplier = 1.5,
    maxPollIntervalMs = 10000,
    overallTimeoutMs = 600000,
    maxConsecutiveErrors = 5,
    sessionStorageKey = DEFAULT_SESSION_KEY,
  } = options;

  const startTime = Date.now();
  onStatus?.('uploading', 'Uploading resume...');

  const cleanBase = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(cleanBase, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (response.status === 429) {
    clearJobSession(sessionStorageKey);
    throw new Error('The extraction service is currently at maximum capacity. Please retry shortly.');
  }

  if (!response.ok && response.status !== 202) {
    clearJobSession(sessionStorageKey);
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.detail || `Upload failed with status ${response.status}`);
  }

  const data = await response.json();

  if (response.status === 200 && data.status === 'completed' && data.result) {
    clearJobSession(sessionStorageKey);
    onStatus?.('completed', 'Extraction completed (served from cache)');
    return data.result;
  }

  if (response.status === 202 && data.job_id) {
    const jobId = data.job_id;
    saveJobSession(sessionStorageKey, jobId, file.name);
    onStatus?.('pending', 'Queued for analysis...');

    let attempt = 0;
    let consecutiveErrors = 0;

    while (true) {
      if (signal?.aborted) {
        clearJobSession(sessionStorageKey);
        throw new Error('Extraction was cancelled.');
      }
      if (Date.now() - startTime > overallTimeoutMs) {
        clearJobSession(sessionStorageKey);
        throw new Error('Extraction timed out after 10 minutes.');
      }

      const pollUrl = `${cleanBase}/${encodeURIComponent(jobId)}`;
      let pollRes: Response;
      try {
        pollRes = await apiFetch(pollUrl, { signal });
      } catch (err: any) {
        if (signal?.aborted) {
          clearJobSession(sessionStorageKey);
          throw new Error('Extraction was cancelled.');
        }
        consecutiveErrors += 1;
        if (consecutiveErrors > maxConsecutiveErrors) {
          clearJobSession(sessionStorageKey);
          throw new Error(`Extraction failed: ${consecutiveErrors} consecutive network errors encountered.`);
        }
        const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
        continue;
      }

      if (pollRes.status >= 500) {
        consecutiveErrors += 1;
        if (consecutiveErrors > maxConsecutiveErrors) {
          clearJobSession(sessionStorageKey);
          throw new Error(`Extraction failed after ${consecutiveErrors} consecutive server (${pollRes.status}) errors.`);
        }
        const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
        continue;
      }

      consecutiveErrors = 0;

      if (!pollRes.ok) {
        if (pollRes.status === 404 && attempt < 5) {
          const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
          await new Promise((r) => setTimeout(r, delay));
          attempt += 1;
          continue;
        }
        clearJobSession(sessionStorageKey);
        const errJson = await pollRes.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || `Job query failed (${pollRes.status})`);
      }

      const pollData = await pollRes.json();
      if (pollData.status === 'completed' && pollData.result) {
        clearJobSession(sessionStorageKey);
        onStatus?.('completed', 'Extraction completed successfully');
        return pollData.result;
      }
      if (pollData.status === 'failed') {
        clearJobSession(sessionStorageKey);
        throw new Error(pollData.error || 'Resume extraction failed on server.');
      }

      if (pollData.status === 'processing') {
        onStatus?.('processing', 'Analyzing resume with ATS model...');
      } else {
        onStatus?.('pending', 'Queued for analysis...');
      }

      const delay = calculateBackoffWithJitter(attempt, initialPollIntervalMs, backoffMultiplier, maxPollIntervalMs);
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
    }
  }

  clearJobSession(sessionStorageKey);
  throw new Error('Unexpected response format from extraction backend.');
}

