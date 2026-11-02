import { expect, test } from '@playwright/test';
import {
  serializeCandidate,
  deserializeCandidate,
  getStorageKey,
  saveAtsDraft,
  loadAtsDraft,
  clearAtsDraft,
  clearAllAtsDrafts,
} from '../../client/src/lib/ats-storage';
import { DATAPATTERN_LOGO_DATA_URI } from '../../client/src/components/DataPatternLogo';

test.describe('ATS Production Improvements - Unit Tests', () => {
  test('Issue 3: DataPatternLogo component exports valid, non-empty base64 PNG data URI', () => {
    expect(DATAPATTERN_LOGO_DATA_URI).toBeTruthy();
    expect(DATAPATTERN_LOGO_DATA_URI.startsWith('data:image/png;base64,')).toBe(true);
    expect(DATAPATTERN_LOGO_DATA_URI.length).toBeGreaterThan(90000);
  });

  test('Issue 4: Storage key normalizes user identifier correctly', () => {
    expect(getStorageKey('recruiter@datapattern.ai')).toBe('dp_ats_draft_recruiter@datapattern.ai');
    expect(getStorageKey('00000000-0000-0000-0000-000000000001')).toBe('dp_ats_draft_00000000-0000-0000-0000-000000000001');
    expect(getStorageKey('User-123_ABC')).toBe('dp_ats_draft_user-123_abc');
    expect(getStorageKey('')).toBe('dp_ats_draft_anonymous');
    expect(getStorageKey(null)).toBe('dp_ats_draft_anonymous');
    expect(getStorageKey(undefined)).toBe('dp_ats_draft_anonymous');
  });

  test('Issue 4: Candidate in "screening" status is safely reset to "uploaded" with error note', () => {
    const screeningCandidate = {
      id: 'cand-001',
      file: { name: 'John_Doe.pdf', type: 'application/pdf', size: 1024 },
      resumeText: 'Python Developer with 5 years experience',
      status: 'screening',
      result: null,
      candidateName: 'John Doe',
      originalFilename: 'John_Doe.pdf',
    };

    const serialized = serializeCandidate(screeningCandidate);
    expect(serialized.status).toBe('uploaded');
    expect(serialized.fileName).toBe('John_Doe.pdf');
    expect(serialized.resumeText).toBe('Python Developer with 5 years experience');
    expect(serialized.error).toContain('Screening was interrupted');

    const deserialized = deserializeCandidate(serialized);
    expect(deserialized.status).toBe('uploaded');
    expect(deserialized.id).toBe('cand-001');
    expect(deserialized.file.name).toBe('John_Doe.pdf');
    expect(deserialized.resumeText).toBe('Python Developer with 5 years experience');
  });

  test('Issue 4: Completed screening candidate preserves results and status', () => {
    const completedCandidate = {
      id: 'cand-002',
      file: { name: 'Alice_Smith.docx', type: 'application/docx', size: 2048 },
      resumeText: 'Senior Full Stack Engineer',
      status: 'completed',
      result: {
        candidateName: 'Alice Smith',
        atsScore: 92,
        fit: 'Fit',
        recommendation: 'Shortlisted',
        recommendationReason: 'Exceptional match',
        summary: 'Strong candidate',
        matchedSkills: ['React', 'Node.js', 'PostgreSQL'],
        relevantExperience: ['Lead Developer at Corp'],
        education: ['B.S. in Computer Science'],
        skillGaps: [],
        strengths: ['Architecture'],
        concerns: [],
        email: 'alice@example.com',
        phone: '123-456-7890',
        currentRole: 'Senior Engineer',
        experience: '8 years',
        skills: ['React', 'Node.js'],
        educationDetails: 'B.S. CS',
        interviewQuestions: null,
        raw: '{"atsScore":92}',
      },
      candidateName: 'Alice Smith',
    };

    const serialized = serializeCandidate(completedCandidate);
    expect(serialized.status).toBe('completed');
    expect(serialized.result.atsScore).toBe(92);

    const deserialized = deserializeCandidate(serialized);
    expect(deserialized.status).toBe('completed');
    expect(deserialized.result.atsScore).toBe(92);
    expect(deserialized.result.recommendation).toBe('Shortlisted');
  });

  test('Issue 4: User-scoped storage isolation and migration from legacy email to UUID', () => {
    // Mock window and localStorage
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] || null,
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    };

    (global as any).window = { localStorage: mockLocalStorage };

    const user1Uuid = '11111111-1111-1111-1111-111111111111';
    const user2Uuid = '22222222-2222-2222-2222-222222222222';
    const user1Email = 'user1@datapattern.ai';

    // 1. Save draft for User 1
    saveAtsDraft(user1Uuid, {
      jobTitle: 'Frontend Engineer',
      jobDescription: 'Build React UI',
      jdFileName: 'frontend_jd.pdf',
      activeView: 'screening',
      candidates: [{ id: 'c1', resumeText: 'React dev', status: 'completed', result: { atsScore: 85 } }],
    });

    // 2. User 2 should NOT see User 1 draft
    const draftUser2 = loadAtsDraft(user2Uuid);
    expect(draftUser2).toBeNull();

    // 3. User 1 should see their draft
    const draftUser1 = loadAtsDraft(user1Uuid);
    expect(draftUser1).not.toBeNull();
    expect(draftUser1?.jobTitle).toBe('Frontend Engineer');
    expect(draftUser1?.candidates.length).toBe(1);

    // 4. Test migration from legacy email key to UUID key
    // Save under legacy email key
    mockLocalStorage.setItem('dp_ats_draft_user1@datapattern.ai', JSON.stringify({
      version: 1,
      jobTitle: 'Migrated Legacy Job',
      jobDescription: 'From old email key',
      jdFileName: null,
      activeView: 'screening',
      candidates: [],
      updatedAt: Date.now(),
    }));

    const user3Uuid = '33333333-3333-3333-3333-333333333333';
    const migratedDraft = loadAtsDraft(user3Uuid, user1Email);
    expect(migratedDraft).not.toBeNull();
    expect(migratedDraft?.jobTitle).toBe('Migrated Legacy Job');
    // Ensure migrated into user3's key and deleted from legacy
    expect(store[`dp_ats_draft_${user3Uuid}`]).toBeDefined();
    expect(store['dp_ats_draft_user1@datapattern.ai']).toBeUndefined();

    // 5. Test clearAllAtsDrafts
    clearAllAtsDrafts();
    expect(loadAtsDraft(user1Uuid)).toBeNull();
    expect(loadAtsDraft(user3Uuid)).toBeNull();

    delete (global as any).window;
  });
});
