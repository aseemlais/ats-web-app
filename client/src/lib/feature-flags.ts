/**
 * feature-flags.ts
 * =================
 * Feature flag toggles for the ATS client.
 *
 * Precedence:
 *   1. URL query param: ?asyncExtraction=true / ?asyncExtraction=false
 *   2. localStorage: ats_use_async_extraction === 'true' / 'false'
 *   3. Env var: VITE_USE_ASYNC_EXTRACTION === 'true'
 *   4. Default: true (activates modern extraction with async queue & SLM cutover)
 */

export function isAsyncExtractionEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryVal = params.get('asyncExtraction');
      if (queryVal === 'true') return true;
      if (queryVal === 'false') return false;

      const storedVal = localStorage.getItem('ats_use_async_extraction');
      if (storedVal === 'true') return true;
      if (storedVal === 'false') return false;
    } catch {
      // In restricted environments, fall through to env var
    }
  }

  return true;
}

export function setAsyncExtractionFlag(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ats_use_async_extraction', enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Could not set localStorage flag:', e);
    }
  }
}
