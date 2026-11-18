/**
 * useResumeExtraction.msw.test.ts
 * ===============================
 * Comprehensive test suite verifying the async resume extraction engine using MSW (Mock Service Worker).
 *
 * Test Scenarios:
 *   1. pending -> processing -> completed transition
 *   2. Terminal failed state
 *   3. Immediate cache hit (HTTP 200)
 *   4. Queue saturation / rate limit (HTTP 429)
 *   5. Transient 5xx server errors then recovery vs exceeding max errors
 *   6. Cold-start / slow response backoff progression
 *   7. Tab reload / sessionStorage re-attachment and terminal cleanup
 *   8. Cancellation via AbortController / cancel button
 */

import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import { setupServer } from 'msw/node';
import { http, HttpResponse, delay } from 'msw';
import {
  extractResumeAsync,
  calculateBackoffWithJitter,
  DEFAULT_SESSION_KEY,
} from '../../client/src/hooks/useResumeExtraction';

// In-memory Storage mock for sessionStorage in Node environment
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

// Setup Node browser environment shims
if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new MemoryStorage();
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

// Create dummy File
function createDummyFile(name = 'sample_cv.pdf', content = '%PDF-1.4\nTest Resume'): File {
  const blob = new Blob([content], { type: 'application/pdf' });
  return new File([blob], name, { type: 'application/pdf' });
}

describe('Async Resume Extraction - MSW Tests', () => {
  const server = setupServer();

  before(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    sessionStorage.clear();
  });

  after(() => {
    server.close();
  });

  // -------------------------------------------------------------------------
  // 1. pending -> processing -> completed
  // -------------------------------------------------------------------------
  it('handles full lifecycle: pending -> processing -> completed', async () => {
    let pollCount = 0;
    const reportedStatuses: string[] = [];

    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json({ job_id: 'job-lifecycle-1', status: 'pending' }, { status: 202 });
      }),
      http.get('*/api/extract/:id', () => {
        pollCount += 1;
        if (pollCount === 1) {
          return HttpResponse.json({ job_id: 'job-lifecycle-1', status: 'pending' });
        }
        if (pollCount === 2) {
          return HttpResponse.json({ job_id: 'job-lifecycle-1', status: 'processing' });
        }
        return HttpResponse.json({
          job_id: 'job-lifecycle-1',
          status: 'completed',
          result: {
            candidateName: 'Sarah Connor',
            jobTitle: 'Security Specialist',
            skills: ['Defense', 'Python'],
            totalExperienceYears: 8,
          },
        });
      }),
    );

    const file = createDummyFile('sarah.pdf');
    const result = await extractResumeAsync(file, {
      initialPollIntervalMs: 20, // Fast intervals for testing
      maxPollIntervalMs: 50,
      onStatus: (st) => reportedStatuses.push(st),
    });

    assert.equal(result.candidateName, 'Sarah Connor');
    assert.equal(result.jobTitle, 'Security Specialist');
    assert.ok(pollCount >= 3, `Expected at least 3 poll calls, got ${pollCount}`);
    assert.ok(reportedStatuses.includes('uploading'));
    assert.ok(reportedStatuses.includes('pending'));
    assert.ok(reportedStatuses.includes('processing'));
    assert.ok(reportedStatuses.includes('completed'));
  });

  // -------------------------------------------------------------------------
  // 2. Terminal failed state
  // -------------------------------------------------------------------------
  it('handles terminal failed state with server error message', async () => {
    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json({ job_id: 'job-fail-1', status: 'pending' }, { status: 202 });
      }),
      http.get('*/api/extract/:id', () => {
        return HttpResponse.json({
          job_id: 'job-fail-1',
          status: 'failed',
          error: 'Corrupted document: unable to parse text stream.',
        });
      }),
    );

    const file = createDummyFile('corrupted.pdf');
    await assert.rejects(
      async () => {
        await extractResumeAsync(file, {
          initialPollIntervalMs: 10,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('Corrupted document'));
        return true;
      },
    );
  });

  // -------------------------------------------------------------------------
  // 3. Cache hit (200 OK)
  // -------------------------------------------------------------------------
  it('handles immediate cache hit (HTTP 200) without polling', async () => {
    let getCalled = false;

    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json({
          job_id: 'job-cached-1',
          status: 'completed',
          cached: true,
          result: {
            candidateName: 'Cached Alex',
            jobTitle: 'Cloud Architect',
            skills: ['Kubernetes'],
          },
        }, { status: 200 });
      }),
      http.get('*/api/extract/:id', () => {
        getCalled = true;
        return HttpResponse.json({ status: 'completed' });
      }),
    );

    const file = createDummyFile('alex_cached.pdf');
    const result = await extractResumeAsync(file);

    assert.equal(result.candidateName, 'Cached Alex');
    assert.equal(getCalled, false, 'Polling should not be invoked on cache hit');
  });

  // -------------------------------------------------------------------------
  // 4. HTTP 429 Queue full / Rate limit
  // -------------------------------------------------------------------------
  it('handles 429 queue capacity with user-friendly error', async () => {
    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json(
          { error: 'Extraction queue is at capacity.' },
          { status: 429 },
        );
      }),
    );

    const file = createDummyFile('busy.pdf');
    await assert.rejects(
      async () => {
        await extractResumeAsync(file);
      },
      (err: Error) => {
        assert.ok(err.message.includes('maximum capacity'));
        return true;
      },
    );
  });

  // -------------------------------------------------------------------------
  // 5. Transient 5xx errors then recovery
  // -------------------------------------------------------------------------
  it('tolerates up to 5 consecutive 5xx errors and resumes successfully on recovery', async () => {
    let attempts = 0;

    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json({ job_id: 'job-transient-1', status: 'pending' }, { status: 202 });
      }),
      http.get('*/api/extract/:id', () => {
        attempts += 1;
        // First 3 polls fail with 502 / 503
        if (attempts <= 3) {
          return new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' });
        }
        // 4th poll succeeds
        return HttpResponse.json({
          job_id: 'job-transient-1',
          status: 'completed',
          result: { candidateName: 'Resilient Candidate' },
        });
      }),
    );

    const file = createDummyFile('resilient.pdf');
    const result = await extractResumeAsync(file, {
      initialPollIntervalMs: 10,
      maxPollIntervalMs: 30,
      maxConsecutiveErrors: 5,
    });

    assert.equal(result.candidateName, 'Resilient Candidate');
    assert.equal(attempts, 4);
  });

  it('fails if consecutive 5xx errors exceed maxConsecutiveErrors (5)', async () => {
    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json({ job_id: 'job-down-1', status: 'pending' }, { status: 202 });
      }),
      http.get('*/api/extract/:id', () => {
        return new HttpResponse(null, { status: 500, statusText: 'Internal Error' });
      }),
    );

    const file = createDummyFile('fail_down.pdf');
    await assert.rejects(
      async () => {
        await extractResumeAsync(file, {
          initialPollIntervalMs: 10,
          maxPollIntervalMs: 20,
          maxConsecutiveErrors: 5,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('consecutive server'));
        return true;
      },
    );
  });

  // -------------------------------------------------------------------------
  // 6. Cold-start / Slow response backoff progression
  // -------------------------------------------------------------------------
  it('calculates exponential backoff with jitter and respects 10s ceiling', () => {
    // Attempt 0: 1500 * (1.5^0) = 1500; with +/- 20% jitter = [1200, 1800]
    const b0 = calculateBackoffWithJitter(0, 1500, 1.5, 10000);
    assert.ok(b0 >= 1199 && b0 <= 1801, `b0 was ${b0}`);

    // Attempt 1: 1500 * (1.5^1) = 2250; with +/- 20% jitter = [1800, 2700]
    const b1 = calculateBackoffWithJitter(1, 1500, 1.5, 10000);
    assert.ok(b1 >= 1799 && b1 <= 2701, `b1 was ${b1}`);

    // High attempt (e.g. 10): 1500 * (1.5^10) = ~86,497 -> capped at 10000; with jitter = [8000, 12000]
    const bHigh = calculateBackoffWithJitter(10, 1500, 1.5, 10000);
    assert.ok(bHigh <= 12000, `Expected ceiling ~10000 (+ jitter), got ${bHigh}`);
  });

  // -------------------------------------------------------------------------
  // 7. Tab reload / sessionStorage re-attachment and terminal cleanup
  // -------------------------------------------------------------------------
  it('persists active jobId in sessionStorage and cleans up on terminal state', async () => {
    sessionStorage.clear();

    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json({ job_id: 'job-session-test', status: 'pending' }, { status: 202 });
      }),
      http.get('*/api/extract/:id', () => {
        // Verify sessionStorage currently holds active job while in-flight
        const stored = sessionStorage.getItem(DEFAULT_SESSION_KEY);
        assert.ok(stored, 'Active job must be in sessionStorage while pending');
        assert.ok(stored.includes('job-session-test'));

        return HttpResponse.json({
          job_id: 'job-session-test',
          status: 'completed',
          result: { candidateName: 'Session Candidate' },
        });
      }),
    );

    const file = createDummyFile('session.pdf');
    await extractResumeAsync(file, {
      initialPollIntervalMs: 10,
    });

    // Upon completion, sessionStorage must be clean
    const afterCompletion = sessionStorage.getItem(DEFAULT_SESSION_KEY);
    assert.equal(afterCompletion, null, 'sessionStorage must be cleaned up on terminal completion');
  });

  // -------------------------------------------------------------------------
  // 8. Cancellation via AbortController
  // -------------------------------------------------------------------------
  it('immediately cancels polling when AbortSignal fires', async () => {
    const controller = new AbortController();

    server.use(
      http.post('*/api/extract', () => {
        return HttpResponse.json({ job_id: 'job-cancel-test', status: 'pending' }, { status: 202 });
      }),
      http.get('*/api/extract/:id', async () => {
        // Trigger abort while server is waiting
        controller.abort();
        return HttpResponse.json({ status: 'pending' });
      }),
    );

    const file = createDummyFile('cancel.pdf');
    await assert.rejects(
      async () => {
        await extractResumeAsync(file, {
          signal: controller.signal,
          initialPollIntervalMs: 10,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('cancelled'));
        return true;
      },
    );
  });
});
