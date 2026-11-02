import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  BriefcaseBusiness,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Users,
  Target,
  Download,
  ChevronRight,
  ChevronDown,
  Sparkles,
  UserRound,
  Mail,
  Phone,
  MessageSquare,
  Award,
  Search,
  Settings,
  LogOut,
  ChevronUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/api';
import { DataPatternLogo } from '@/components/DataPatternLogo';
import {
  loadAtsDraft,
  saveAtsDraft,
  clearAllAtsDrafts,
} from '@/lib/ats-storage';
import { supabase } from '@/lib/supabase';
import {
  CandidateRepositoryView,
  fetchCandidateDetail,
  type StoredCandidate,
} from '../components/candidate-repository';

type CandidateStatus =
  | 'uploaded'
  | 'screening'
  | 'completed'
  | 'failed';

type InterviewQuestion = {
  question: string;
  expectedAnswer: string;
  evaluationCriteria: string;
};

type InterviewQuestions = {
  technical: InterviewQuestion[];
  behavioral: InterviewQuestion[];
  domain: InterviewQuestion[];
};

type ScreeningResult = {
  candidateName: string;
  atsScore: number | null;
  fit: 'Fit' | 'Not Fit' | 'Review';
  recommendation:
    | 'Shortlisted'
    | 'Not Shortlisted'
    | 'Review';
  recommendationReason: string;
  summary: string;
  matchedSkills: string[];
  relevantExperience: string[];
  education: string[];
  skillGaps: string[];
  strengths: string[];
  concerns: string[];
  email: string;
  phone: string;
  currentRole: string;
  jobRole?: string;
  experience: string;
  skills: string[];
  educationDetails: string;
  interviewQuestions: InterviewQuestions | null;
  interviewLoading?: boolean;
  raw: string;
};

type Candidate = {
  id: string;
  file: File;
  resumeText: string;
  status: CandidateStatus;
  result: ScreeningResult | null;
  error?: string;
  candidateName?: string;
  originalFilename?: string;
  fromRepository?: boolean;
};

type ScreeningResponse = {
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  response?: unknown;
  output_text?: string;
  text?: string;
  content?: unknown;
};

function extractResponseText(
  data: ScreeningResponse,
): string {
  if (
    typeof data.output_text === 'string' &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  if (
    typeof data.response === 'string' &&
    data.response.trim()
  ) {
    return data.response.trim();
  }

  if (
    typeof data.text === 'string' &&
    data.text.trim()
  ) {
    return data.text.trim();
  }

  if (Array.isArray(data.output)) {
    const text = data.output
      .flatMap((item) => item.content ?? [])
      .map((part) =>
        typeof part.text === 'string'
          ? part.text
          : '',
      )
      .filter(Boolean)
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  if (
    data.response &&
    typeof data.response === 'object'
  ) {
    const responseObject =
      data.response as Record<string, unknown>;

    if (
      typeof responseObject.output_text ===
        'string' &&
      responseObject.output_text.trim()
    ) {
      return responseObject.output_text.trim();
    }

    if (
      typeof responseObject.text === 'string' &&
      responseObject.text.trim()
    ) {
      return responseObject.text.trim();
    }

    if (Array.isArray(responseObject.output)) {
      const outputText = (
        responseObject.output as Array<{
          content?: Array<{
            text?: string;
          }>;
        }>
      )
        .flatMap((item) => item.content ?? [])
        .map((part) => part.text ?? '')
        .filter(Boolean)
        .join('\n')
        .trim();

      if (outputText) {
        return outputText;
      }
    }

    if (Array.isArray(responseObject.content)) {
      const contentText = (
        responseObject.content as Array<{
          text?: string;
          content?: string;
        }>
      )
        .map(
          (item) =>
            item.text ??
            item.content ??
            '',
        )
        .filter(Boolean)
        .join('\n')
        .trim();

      if (contentText) {
        return contentText;
      }
    }
  }

  return JSON.stringify(data);
}

function cleanJsonText(text: string): string {
  let cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    cleaned = cleaned.slice(
      firstBrace,
      lastBrace + 1,
    );
  }

  return cleaned.trim();
}

function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|•|;/)
      .map((item) =>
        item
          .replace(/^[-*]\s*/, '')
          .trim(),
      )
      .filter(Boolean);
  }

  return [];
}

function safeString(
  value: unknown,
  fallback = 'Not available',
): string {
  return typeof value === 'string' &&
    value.trim()
    ? value.trim()
    : fallback;
}

// ---------------------------------------------------------------------------
// Client-side role sanitization
// Fixes stale Supabase records that contain tool names, date strings,
// company fragments or other bad values instead of a proper job role.
// ---------------------------------------------------------------------------

const KNOWN_TOOLS_LC = new Set([
  'jupyter notebook', 'jupyter', 'vs code', 'visual studio code', 'visual studio',
  'git', 'github', 'gitlab', 'bitbucket', 'docker', 'kubernetes', 'linux', 'ubuntu',
  'windows', 'postman', 'figma', 'jira', 'jenkins', 'aws', 'amazon web services',
  'azure', 'gcp', 'google cloud platform', 'google cloud', 'react', 'react.js', 'reactjs',
  'angular', 'vue', 'node', 'node.js', 'nodejs', 'express', 'django', 'flask', 'fastapi',
  'spring boot', 'spring', 'mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'oracle',
  'pandas', 'numpy', 'scipy', 'scikit-learn', 'sklearn', 'tensorflow', 'pytorch', 'keras',
  'opencv', 'tableau', 'power bi', 'powerbi', 'excel', 'ms excel', 'word', 'powerpoint',
  'c', 'c++', 'c#', 'java', 'python', 'javascript', 'typescript', 'html', 'css', 'sql',
  'r', 'php', 'ruby', 'rust', 'go', 'golang', 'matlab', 'hadoop', 'spark', 'pyspark',
  'rest api', 'graphql', 'tailwind', 'bootstrap',
]);

const ROLE_KEYWORDS_LC = [
  'developer', 'engineer', 'analyst', 'scientist', 'architect', 'consultant',
  'specialist', 'manager', 'lead', 'administrator', 'associate', 'director',
  'coordinator', 'officer', 'executive', 'programmer', 'technician', 'researcher',
  'designer', 'instructor', 'assistant', 'intern', 'trainee', 'fellow', 'expert',
  'founder', 'head', 'cto', 'ceo', 'vp',
];

const COMPANY_SUFFIX_RE =
  /\b(pvt\.?\s*ltd\.?|private\s+limited|limited|technologies|solutions|services|labs|academy|inc\.?|corp\.?|llc|llp|pvt|consultancy|consulting|enterprises|holdings|agency)\b/i;

const DATE_STRING_RE =
  /^[\s\d\/\.\-–—,]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|present|current|now)?[\s\d\/\.\-–—,]*$/i;

const DATE_PREFIX_RE =
  /^[\d]{1,2}[\/\.\-][\d]{4}/;

const BRACKET_DURATION_RE =
  /\[\s*\d+\s*month/i;

/**
 * Returns true if the value looks like a date interval, e.g.
 *  "06/2025 - 06/2025"   "/2025 - 06/2025"   "July 2024 - Aug 2024"
 */
function looksLikeDate(value: string): boolean {
  const v = value.trim();
  if (DATE_PREFIX_RE.test(v)) return true;
  if (DATE_STRING_RE.test(v) && v.length < 40) return true;
  if (/\b\d{4}\s*[-–—]\s*\d{4}\b/.test(v)) return true;
  if (/\b\d{4}\s*[-–—]\s*(present|current|now)\b/i.test(v)) return true;
  return false;
}

/** Returns true if the value is a known tool/skill name. */
function looksLikeTool(value: string): boolean {
  return KNOWN_TOOLS_LC.has(value.toLowerCase().trim());
}

/** Returns true if the value is a company entity with no role word. */
function looksLikeCompany(value: string): boolean {
  const v = value.toLowerCase();
  const hasRoleWord = ROLE_KEYWORDS_LC.some((kw) => v.includes(kw));
  if (hasRoleWord) return false;
  return COMPANY_SUFFIX_RE.test(value);
}

/** Returns true if the value contains a '[1Month' / 'InternBoot' style garbage fragment. */
function looksLikeGarbage(value: string): boolean {
  if (BRACKET_DURATION_RE.test(value)) return true;
  // Flagged: extremely long strings or strings that have no role keyword at all
  if (value.length > 80) return true;
  return false;
}

/**
 * Attempt to recover a clean role label from experience / summary text fragments.
 * Returns the first line that contains a role keyword or null if nothing suitable found.
 */
function recoverRoleFromContext(
  relevantExperience: string[],
  summary: string,
): string | null {
  const candidates = [...relevantExperience, summary].filter(Boolean);
  for (const text of candidates) {
    for (const line of text.split(/[\n,;]/)) {
      const l = line.trim();
      if (!l || l.length > 70) continue;
      const lc = l.toLowerCase();
      if (ROLE_KEYWORDS_LC.some((kw) => lc.includes(kw))) {
        // Quick cleanse: strip leading bullets / dashes
        const clean = l.replace(/^[-*•]\s*/, '').trim();
        if (clean.length >= 3 && clean.length <= 70) return clean;
      }
    }
  }
  return null;
}

/**
 * Sanitizes a raw candidate role string loaded from Supabase.
 * Rejects bad values (dates, tools, company names, garbage) and attempts
 * recovery from context before falling back to 'Role not identified'.
 */
function sanitizeCandidateRole(
  rawRole: string | undefined | null,
  relevantExperience: string[],
  summary: string,
): string {
  const FALLBACK = 'Role not identified';

  if (!rawRole || rawRole === FALLBACK || rawRole === 'Not available') {
    const recovered = recoverRoleFromContext(relevantExperience, summary);
    return recovered ?? FALLBACK;
  }

  const v = rawRole.trim();

  // Reject clearly bad values
  if (
    looksLikeDate(v) ||
    looksLikeTool(v) ||
    looksLikeGarbage(v) ||
    (looksLikeCompany(v) && !ROLE_KEYWORDS_LC.some((kw) => v.toLowerCase().includes(kw)))
  ) {
    const recovered = recoverRoleFromContext(relevantExperience, summary);
    return recovered ?? FALLBACK;
  }

  return v;
}

// ---------------------------------------------------------------------------

function normalizeResult(
  parsed: Record<string, unknown>,
  raw: string,
): ScreeningResult {
  const atsScoreValue = Number(
    parsed.atsScore ??
      parsed.ats_score ??
      parsed.atsCompatibilityScore,
  );

  const atsScore = Number.isFinite(atsScoreValue)
    ? Math.min(100, Math.max(0, atsScoreValue))
    : null;

  const fitRaw = safeString(
    parsed.fit ??
      parsed.fitStatus,
    'Review',
  ).toLowerCase();

  const recommendationRaw =
    safeString(
      parsed.recommendation ??
        parsed.shortlistStatus ??
        parsed.shortlistRecommendation,
      'Review',
    ).toLowerCase();

  let fit: ScreeningResult['fit'] =
    'Review';

  if (
    fitRaw === 'fit' ||
    fitRaw === 'yes'
  ) {
    fit = 'Fit';
  } else if (
    fitRaw.includes('not fit') ||
    fitRaw.includes('not-fit')
  ) {
    fit = 'Not Fit';
  }

  let recommendation:
    ScreeningResult['recommendation'] =
    'Review';

  if (
    recommendationRaw === 'shortlisted' ||
    recommendationRaw === 'shortlist'
  ) {
    recommendation = 'Shortlisted';
  } else if (
    recommendationRaw.includes(
      'not shortlisted',
    ) ||
    recommendationRaw.includes(
      'not-shortlisted',
    )
  ) {
    recommendation = 'Not Shortlisted';
  }

  const questions =
    parsed.interviewQuestions &&
    typeof parsed.interviewQuestions ===
      'object'
      ? (parsed.interviewQuestions as Record<
          string,
          unknown
        >)
      : null;

  const educationArray = safeArray(
    parsed.education,
  );

  const educationDetails =
    safeString(
      parsed.educationDetails,
      '',
    );

  return {
    candidateName: safeString(
      parsed.candidateName ??
        parsed.name ??
        parsed.fullName,
      'Not available',
    ),

    atsScore,

    fit,

    recommendation,

    recommendationReason:
      safeString(
        parsed.recommendationReason ??
          parsed.reason ??
          parsed.shortlistReason,
        'No recommendation reason provided.',
      ),

    summary:
      safeString(
        parsed.summary ??
          parsed.candidateSummary,
        'No candidate summary available.',
      ),

    matchedSkills:
      safeArray(
        parsed.matchedSkills ??
          parsed.keyMatchedSkills,
      ),

    relevantExperience:
      safeArray(
        parsed.relevantExperience,
      ),

    education: educationArray,

    skillGaps:
      safeArray(parsed.skillGaps),

    strengths:
      safeArray(parsed.strengths),

    concerns:
      safeArray(parsed.concerns),

    email:
      safeString(
        parsed.email,
        'Not available',
      ),

    phone:
      safeString(
        parsed.phone,
        'Not available',
      ),

    currentRole: sanitizeCandidateRole(
      safeString(
        parsed.jobRole ??
          parsed.job_role ??
          parsed.currentRole ??
          parsed.current_role,
        '',
      ) || null,
      safeArray(parsed.relevantExperience),
      safeString(parsed.summary ?? parsed.candidateSummary, ''),
    ),

    jobRole: sanitizeCandidateRole(
      safeString(
        parsed.jobRole ??
          parsed.job_role ??
          parsed.currentRole ??
          parsed.current_role,
        '',
      ) || null,
      safeArray(parsed.relevantExperience),
      safeString(parsed.summary ?? parsed.candidateSummary, ''),
    ),

    experience:
      safeString(
        parsed.experience,
        'Not available',
      ),

    skills:
      safeArray(parsed.skills),

    educationDetails:
      educationDetails ||
      educationArray.join(', ') ||
      'Not available',

    interviewQuestions: questions
      ? {
          technical:
            safeArray(
              questions.technical,
            ),

          behavioral:
            safeArray(
              questions.behavioral,
            ),

          domain:
            safeArray(
              questions.domain,
            ),
        }
      : null,

    raw,
  };
}

function parseScreeningResult(
  raw: string,
): ScreeningResult {
  const cleaned =
    cleanJsonText(raw);

  try {
    const parsed =
      JSON.parse(cleaned) as Record<
        string,
        unknown
      >;

    return normalizeResult(
      parsed,
      raw,
    );
  } catch {
    const atsScoreMatch = raw.match(
      /(?:ats\s+(?:score|compatibility\s+score)|ats_score)[^0-9]{0,50}(\d{1,3})\s*%?/i,
    );
    const atsScore = atsScoreMatch
      ? Math.min(100, Number(atsScoreMatch[1]))
      : null;

    const notFit =
      /not\s+fit|not\s+recommended|not\s+shortlisted/i.test(
        raw,
      );

    const shortlisted =
      /\bshortlisted\b|\bshortlist\b/i.test(
        raw,
      ) &&
      !notFit;

    return {
      candidateName: 'Not available',

        atsScore,

      fit: notFit
        ? 'Not Fit'
        : atsScore !== null && atsScore >= 70
          ? 'Fit'
          : 'Review',

      recommendation: notFit
        ? 'Not Shortlisted'
        : shortlisted
          ? 'Shortlisted'
          : 'Review',

      recommendationReason:
        'See the full AI assessment below.',

      summary:
        raw.slice(0, 500),

      matchedSkills: [],

      relevantExperience: [],

      education: [],

      skillGaps: [],

      strengths: [],

      concerns: [],

      email: 'Not available',

      phone: 'Not available',

      currentRole: 'Role not identified',
      jobRole: 'Role not identified',

      experience: 'Not available',

      skills: [],

      educationDetails:
        'Not available',

      interviewQuestions: null,

      raw,
    };
  }
}

async function callAgent(
  prompt: string,
): Promise<string> {
  const MAX_RETRIES = 4;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt += 1
  ) {
    try {
      const response = await apiFetch(
        '/invocations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            input: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const message =
          await response.text();

        const retryable =
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;

        if (
          retryable &&
          attempt < MAX_RETRIES
        ) {
          const retryAfterHeader =
            response.headers.get(
              'Retry-After',
            );

          const retryAfterMs =
            retryAfterHeader
              ? Math.min(
                  10000,
                  Math.max(
                    500,
                    Number(retryAfterHeader) *
                      1000,
                  ),
                )
              : Math.min(
                  8000,
                  750 *
                    2 ** attempt,
                );

          await new Promise((resolve) =>
            setTimeout(
              resolve,
              retryAfterMs,
            ),
          );

          continue;
        }

        throw new Error(
          message ||
            `AI request failed (${response.status}).`,
        );
      }

      const data =
        (await response.json()) as ScreeningResponse;

      const text =
        extractResponseText(data);

      if (
        !text ||
        text === '{}'
      ) {
        throw new Error(
          'The AI returned an empty response.',
        );
      }

      return text;
    } catch (error) {
      if (
        attempt < MAX_RETRIES &&
        error instanceof TypeError
      ) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(
              8000,
              750 * 2 ** attempt,
            ),
          ),
        );

        continue;
      }

      throw error;
    }
  }

  throw new Error(
    'AI request failed after retries.',
  );
}

type SessionUser = {
  id?: string;
  name?: string;
  preferredUsername?: string;
  email?: string;
};

function getDisplayName(user: SessionUser | null): string {
  if (!user) return 'User';

  const rawName =
    user.name?.trim() ||
    user.preferredUsername?.trim() ||
    '';

  if (rawName && !rawName.includes('@')) {
    return rawName
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return 'User';
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function extractJobTitleFromJd(text: string): string {
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ');

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 20)) {
    const jobDescriptionMatch = line.match(
      /^job\s+description\s*[-–—:]\s*(.+)$/i,
    );
    if (jobDescriptionMatch?.[1]?.trim()) {
      return jobDescriptionMatch[1].trim();
    }

    const labelledMatch = line.match(
      /^(?:job\s+title|title|role|position|designation)\s*[-–—:]\s*(.+)$/i,
    );
    if (labelledMatch?.[1]?.trim()) {
      return labelledMatch[1].trim();
    }
  }

  const positionIndex = lines.findIndex(
    (line) => /^position$/i.test(line),
  );
  if (positionIndex >= 0 && lines[positionIndex + 1]) {
    return lines[positionIndex + 1].trim();
  }

  const titleIndex = lines.findIndex(
    (line) => /^(?:job\s+title|role|designation)$/i.test(line),
  );
  if (titleIndex >= 0 && lines[titleIndex + 1]) {
    return lines[titleIndex + 1].trim();
  }

  return '';
}

export default function NewChatPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const jdFileInputRef =
    useRef<HTMLInputElement>(null);

  const [jdFileName, setJdFileName] =
    useState('');

  const [isUploadingJd, setIsUploadingJd] =
    useState(false);

  const [activeView, setActiveView] =
    useState<
      'screening' | 'results' | 'repository'
    >('screening');

  const [jobTitle, setJobTitle] =
    useState('');

  const [jobDescription, setJobDescription] =
    useState('');

  const [candidates, setCandidates] =
    useState<Candidate[]>([]);

  const [
    selectedCandidateId,
    setSelectedCandidateId,
  ] = useState<string | null>(
    null,
  );

  const [isScreening, setIsScreening] =
    useState(false);

  const [repoRefreshKey, setRepoRefreshKey] =
    useState(0);

  const [error, setError] =
    useState('');

  const [sharePointLink, setSharePointLink] =
    useState('');

  const [isFetchingSharePoint, setIsFetchingSharePoint] =
    useState(false);

  const [sessionUser, setSessionUser] =
    useState<SessionUser | null>(null);

  const [isProfileOpen, setIsProfileOpen] =
    useState(false);

  const [isProfilePageOpen, setIsProfilePageOpen] =
    useState(false);

  const [isSettingsOpen, setIsSettingsOpen] =
    useState(false);

  const [profileName, setProfileName] =
    useState('');


  const [theme, setTheme] =
    useState<'light' | 'dark'>('light');

  const [signOutMessage, setSignOutMessage] =
    useState('');

  const [
    expandedCandidateId,
    setExpandedCandidateId,
  ] = useState<string | null>(
    null,
  );

  const draftRestoredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await apiFetch('/api/session', {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) return;

        const data = (await response.json()) as {
          user?: SessionUser;
        };

        if (!cancelled && data.user) {
          setSessionUser(data.user);
          if (!draftRestoredRef.current) {
            draftRestoredRef.current = true;
            const primaryKey = data.user.id || data.user.email || data.user.preferredUsername;
            const fallbackEmail = data.user.email;
            const draft = loadAtsDraft(primaryKey, fallbackEmail);
            if (draft && !cancelled) {
              if (draft.jobTitle) setJobTitle(draft.jobTitle);
              if (draft.jobDescription) setJobDescription(draft.jobDescription);
              if (draft.jdFileName) setJdFileName(draft.jdFileName);
              if (draft.sharePointLink) setSharePointLink(draft.sharePointLink);
              if (draft.activeView) {
                setActiveView(draft.activeView as any);
              }
              if (Array.isArray(draft.candidates) && draft.candidates.length > 0) {
                setCandidates(draft.candidates);
              }
            }
          }
        } else if (!cancelled && !data?.user && !draftRestoredRef.current) {
          supabase.auth.getSession().then(({ data: { session: supaSession } }) => {
            if (!cancelled && supaSession?.user && !draftRestoredRef.current) {
              draftRestoredRef.current = true;
              const primaryKey = supaSession.user.id || supaSession.user.email;
              const fallbackEmail = supaSession.user.email;
              const draft = loadAtsDraft(primaryKey, fallbackEmail);
              if (draft && !cancelled) {
                if (draft.jobTitle) setJobTitle(draft.jobTitle);
                if (draft.jobDescription) setJobDescription(draft.jobDescription);
                if (draft.jdFileName) setJdFileName(draft.jdFileName);
                if (draft.sharePointLink) setSharePointLink(draft.sharePointLink);
                if (draft.activeView) {
                  setActiveView(draft.activeView as any);
                }
                if (Array.isArray(draft.candidates) && draft.candidates.length > 0) {
                  setCandidates(draft.candidates);
                }
              }
            }
          });
        }

        if (!cancelled) {
          const savedName = window.localStorage.getItem('dp_profile_name');
          const savedTheme = window.localStorage.getItem('dp_theme');

          if (savedName?.trim()) {
            setProfileName(savedName.trim());
          }

          if (savedTheme === 'dark') {
            setTheme('dark');
          }
        }
      } catch (sessionError) {
        console.warn('[Session] Unable to load current user:', sessionError);
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save draft changes to localStorage whenever recruiter inputs change
  useEffect(() => {
    if (!draftRestoredRef.current) return;

    const userKey =
      sessionUser?.id ||
      sessionUser?.email ||
      sessionUser?.preferredUsername;

    saveAtsDraft(userKey, {
      jobTitle,
      jobDescription,
      jdFileName,
      activeView: activeView === 'repository' ? 'repository' : 'screening',
      sharePointLink,
      candidates,
    });
  }, [
    sessionUser,
    jobTitle,
    jobDescription,
    jdFileName,
    activeView,
    sharePointLink,
    candidates,
  ]);

  const displayName =
    profileName.trim() || getDisplayName(sessionUser);
  const userInitials = getInitials(displayName);
  const userEmail = sessionUser?.email || '';

  const readiness = Boolean(
    jobTitle.trim() &&
      jobDescription.trim() &&
      candidates.length > 0 &&
      candidates.every(
        (candidate) =>
          candidate.resumeText &&
          candidate.status === 'uploaded',
      ),
  );

  const completedCandidates =
    candidates
      .filter(
        (candidate) =>
          candidate.status ===
            'completed' &&
          candidate.result,
      )
      .sort((a, b) => {
        const scoreDifference =
          (b.result?.atsScore ?? -1) -
          (a.result?.atsScore ?? -1);

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const recommendationPriority = {
          Shortlisted: 0,
          Review: 1,
          'Not Shortlisted': 2,
        } as const;

        const aPriority =
          recommendationPriority[
            a.result?.recommendation ?? 'Review'
          ];
        const bPriority =
          recommendationPriority[
            b.result?.recommendation ?? 'Review'
          ];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        const fitPriority = {
          Fit: 0,
          Review: 1,
          'Not Fit': 2,
        } as const;

        const aFitPriority =
          fitPriority[a.result?.fit ?? 'Review'];
        const bFitPriority =
          fitPriority[b.result?.fit ?? 'Review'];

        if (aFitPriority !== bFitPriority) {
          return aFitPriority - bFitPriority;
        }

        return (
          (a.result?.candidateName ?? '').localeCompare(
            b.result?.candidateName ?? '',
          )
        );
      });

  const shortlistedCandidates =
    completedCandidates.filter(
      (candidate) =>
        candidate.result
          ?.recommendation ===
        'Shortlisted',
    );

  const averageScore =
    completedCandidates.length > 0
      ? Math.round(
          completedCandidates.reduce(
            (sum, candidate) =>
              sum +
              (candidate.result
                ?.atsScore ?? 0),
            0,
          ) /
            completedCandidates.length,
        )
      : 0;

  const selectedCandidate =
    candidates.find(
      (candidate) =>
        candidate.id ===
        selectedCandidateId,
    ) ??
    null;

  const handleJdSelect =
    async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setError('');

      const allowedExtensions = [
        '.pdf',
        '.docx',
        '.txt',
      ];

      const isAllowed = allowedExtensions.some((extension) =>
        file.name.toLowerCase().endsWith(extension),
      );

      if (!isAllowed || file.size > 10 * 1024 * 1024) {
        setError(
          'Please upload a PDF, DOCX, or TXT job description up to 10 MB.',
        );
        event.target.value = '';
        return;
      }

      setIsUploadingJd(true);
      setJdFileName(file.name);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', 'job_description');

        const response = await apiFetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.error || 'Unable to process the job description.',
          );
        }

        const data = await response.json();

        if (typeof data.resumeText !== 'string' || !data.resumeText.trim()) {
          throw new Error(
            'Job description text could not be extracted.',
          );
        }

        const extractedJdText = data.resumeText.trim();
        setJobDescription(extractedJdText);

        const extractedJobTitle = extractJobTitleFromJd(extractedJdText);
        if (extractedJobTitle) {
          setJobTitle(extractedJobTitle);
        }
      } catch (uploadError) {
        console.error('[JD Upload] Failed:', uploadError);
        setJdFileName('');
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : 'Unable to process the job description.',
        );
      } finally {
        setIsUploadingJd(false);
        event.target.value = '';
      }
    };

  const handleResumeSelect =
    async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const files = Array.from(
        event.target.files ?? [],
      );

      if (!files.length) {
        return;
      }

      setError('');

      const allowedExtensions = [
        '.pdf',
        '.docx',
        '.txt',
      ];

      const validFiles =
        files.filter((file) => {
          const name =
            file.name.toLowerCase();

          return (
            allowedExtensions.some(
              (extension) =>
                name.endsWith(
                  extension,
                ),
            ) &&
            file.size <=
              10 * 1024 * 1024
          );
        });

      if (
        validFiles.length !==
        files.length
      ) {
        setError(
          'Some files were skipped. Only PDF, DOCX, and TXT files up to 10 MB are supported.',
        );
      }

      for (const file of validFiles) {
        const duplicate =
          candidates.some(
            (candidate) =>
              candidate.file.name ===
                file.name &&
              candidate.file.size ===
                file.size,
          );

        if (duplicate) {
          continue;
        }

        const id =
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

        setCandidates(
          (current) => [
            ...current,
            {
              id,
              file,
              resumeText: '',
              status:
                'screening',
              result: null,
            },
          ],
        );

        try {
          const formData =
            new FormData();

          formData.append(
            'file',
            file,
          );
          formData.append(
            'fileType',
            'resume',
          );

          const response =
            await apiFetch(
              '/api/files/upload',
              {
                method: 'POST',
                body: formData,
              },
            );

          if (!response.ok) {
            const data =
              await response
                .json()
                .catch(
                  () => ({}),
                );

            throw new Error(
              data.error ||
                'Unable to process the resume.',
            );
          }

          const data =
            await response.json();

          if (
            typeof data.resumeText !==
            'string'
          ) {
            throw new Error(
              'Resume text could not be extracted.',
            );
          }

          setCandidates(
            (current) =>
              current.map(
                (candidate) =>
                  candidate.id ===
                  id
                    ? {
                        ...candidate,
                        resumeText:
                          data.resumeText,
                        status:
                          'uploaded',
                        error:
                          undefined,
                        candidateName:
                          data.candidateName || candidate.candidateName,
                        originalFilename:
                          file.name,
                      }
                    : candidate,
              ),
          );
        } catch (
          uploadError
        ) {
          setCandidates(
            (current) =>
              current.map(
                (candidate) =>
                  candidate.id ===
                  id
                    ? {
                        ...candidate,
                        status:
                          'failed',
                        error:
                          uploadError instanceof
                          Error
                            ? uploadError.message
                            : 'Resume upload failed.',
                      }
                    : candidate,
              ),
          );
        }
      }

      event.target.value = '';
      setRepoRefreshKey((prev) => prev + 1);
    };

  const removeCandidate = (
    id: string,
  ) => {
    setCandidates(
      (current) =>
        current.filter(
          (candidate) =>
            candidate.id !== id,
        ),
    );

    if (
      selectedCandidateId === id
    ) {
      setSelectedCandidateId(
        null,
      );
    }

    if (
      expandedCandidateId === id
    ) {
      setExpandedCandidateId(
        null,
      );
    }
  };


  const handleSharePointFetch = async () => {
    setError('');

    const link = sharePointLink.trim();

    if (!link) {
      setError('Please paste a SharePoint folder link.');
      return;
    }

    try {
      const parsedUrl = new URL(link);
      if (!parsedUrl.protocol.startsWith('http')) {
        throw new Error('Invalid SharePoint link.');
      }
    } catch {
      setError('Please enter a valid SharePoint folder link.');
      return;
    }

    setIsFetchingSharePoint(true);

    try {
      const response = await apiFetch('/api/sharepoint/fetch-resumes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ sharePointLink: link }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? 'SharePoint fetch service is not configured yet.'
            : data.error ||
                'Unable to fetch resumes from SharePoint.',
        );
      }

      const fetchedResumes = Array.isArray(data.resumes)
        ? data.resumes
        : Array.isArray(data.files)
          ? data.files
          : [];

      if (!fetchedResumes.length) {
        throw new Error(
          'No resumes were returned from the SharePoint location.',
        );
      }

      const newCandidates: Candidate[] = [];

      for (const item of fetchedResumes) {
        if (!item || typeof item !== 'object') continue;

        const resume = item as Record<string, unknown>;
        const resumeText =
          typeof resume.resumeText === 'string'
            ? resume.resumeText.trim()
            : typeof resume.text === 'string'
              ? resume.text.trim()
              : typeof resume.content === 'string'
                ? resume.content.trim()
                : '';

        if (!resumeText) continue;

        const fileName =
          typeof resume.fileName === 'string' && resume.fileName.trim()
            ? resume.fileName.trim()
            : typeof resume.name === 'string' && resume.name.trim()
              ? resume.name.trim()
              : `SharePoint Resume ${newCandidates.length + 1}.txt`;

        const file = new File([resumeText], fileName, {
          type: 'text/plain',
        });

        const duplicate = candidates.some(
          (candidate) =>
            candidate.file.name === file.name &&
            candidate.file.size === file.size,
        );

        if (duplicate) continue;

        newCandidates.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${newCandidates.length}`,
          file,
          resumeText,
          status: 'uploaded',
          result: null,
        });
      }

      if (!newCandidates.length) {
        throw new Error(
          'SharePoint returned files, but no readable resume text was available.',
        );
      }

      setCandidates((current) => [...current, ...newCandidates]);
      setSharePointLink('');
    } catch (fetchError) {
      console.error('[SharePoint] Fetch failed:', fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to fetch resumes from SharePoint.',
      );
    } finally {
      setIsFetchingSharePoint(false);
    }
  };

  const clearAllCandidates = () => {
    if (isScreening) return;

    setCandidates([]);
    setSelectedCandidateId(null);
    setExpandedCandidateId(null);
    setError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddStoredCandidatesToScreening = async (
    storedList: StoredCandidate[],
  ) => {
    if (!storedList.length) return;
    setError('');

    const addedCandidates: Candidate[] = [];

    for (const stored of storedList) {
      if (candidates.some((c) => c.id === stored.id)) {
        continue;
      }

      try {
        const detail = await fetchCandidateDetail(stored.id);
        if (!detail || !detail.resumeText || !detail.resumeText.trim()) {
          console.warn('Candidate has no extracted resume text:', stored.id);
          continue;
        }

        const fallbackFilename =
          detail.originalFilename?.trim() ||
          (detail.candidateName
            ? `${detail.candidateName.replace(/[^\w\s.-]/g, '_')}.txt`
            : 'candidate.txt');

        const dummyFile = new File(
          [detail.resumeText],
          fallbackFilename,
          { type: 'text/plain' },
        );

        addedCandidates.push({
          id: detail.id,
          file: dummyFile,
          resumeText: detail.resumeText,
          status: 'uploaded',
          result: null,
          candidateName: detail.candidateName ?? undefined,
          originalFilename: detail.originalFilename ?? undefined,
          fromRepository: true,
        });
      } catch (err) {
        console.error('Failed to fetch detail for candidate:', stored.id, err);
      }
    }

    const storedIds = new Set(storedList.map((s) => s.id));
    const allSelectedCandidates = [
      ...candidates.filter((c) => storedIds.has(c.id)),
      ...addedCandidates,
    ];

    if (addedCandidates.length > 0) {
      setCandidates((current) => {
        const existingIds = new Set(current.map((c) => c.id));
        const trulyNew = addedCandidates.filter((c) => !existingIds.has(c.id));
        return [...current, ...trulyNew];
      });
    }

    if (!jobTitle.trim() || !jobDescription.trim()) {
      setActiveView('screening');
      setError(
        'Selected candidate(s) added to screening session. Please enter or upload a Job Description and click "Screen Candidates" to start screening.',
      );
      return;
    }

    const candidatesToScreen = allSelectedCandidates.filter(
      (c) => c.resumeText && c.status !== 'completed' && c.status !== 'screening',
    );

    if (candidatesToScreen.length === 0) {
      setActiveView(completedCandidates.length > 0 ? 'results' : 'screening');
      return;
    }

    setActiveView('screening');
    setIsScreening(true);

    try {
      const SCREENING_BATCH_SIZE = 5;
      for (
        let index = 0;
        index < candidatesToScreen.length;
        index += SCREENING_BATCH_SIZE
      ) {
        const batch = candidatesToScreen.slice(
          index,
          index + SCREENING_BATCH_SIZE,
        );

        await Promise.all(
          batch.map((candidate) => screenCandidate(candidate)),
        );
      }

      setActiveView('results');
      setSelectedCandidateId(null);
    } catch (screenError) {
      console.error('[Screening] Batch screening error:', screenError);
      setError(
        screenError instanceof Error
          ? screenError.message
          : 'Candidate screening encountered an error.',
      );
    } finally {
      setIsScreening(false);
    }
  };

  const screenCandidate =
    async (
      candidate: Candidate,
    ) => {
      if (!candidate.resumeText) {
        return;
      }

      setCandidates(
        (current) =>
          current.map((item) =>
            item.id ===
            candidate.id
              ? {
                  ...item,
                  status:
                    'screening',
                  error:
                    undefined,
                }
              : item,
          ),
      );

      const prompt = `
You are an enterprise Resume Screening and Shortlisting Agent.

Evaluate the candidate strictly against the job requirements.

JOB TITLE:
${jobTitle}

JOB DESCRIPTION AND REQUIREMENTS:
${jobDescription}

CANDIDATE RESUME:
${candidate.resumeText}

Your task:
1. Extract the candidate's full name exactly as written in the resume. Do not use the resume filename as the candidate name.
2. Extract the candidate's personal and professional information.
3. Compare the candidate against the job requirements.
4. Calculate an ATS Score from 0 to 100 based on explicit keyword and required-skill alignment with the job description.
5. Decide whether the candidate is Fit, Not Fit, or Review.
6. Decide whether the candidate should be Shortlisted, Not Shortlisted, or Review.
7. Explain the recommendation using factual evidence.
8. Identify matched skills.
9. Identify relevant experience.
10. Identify education.
11. Identify skill gaps.
12. Identify strengths.
13. Identify concerns.

Return ONLY valid JSON.
Do not use markdown.
Do not add any text before or after the JSON.

Use exactly this structure:

{
  "candidateName": "candidate's full name exactly as written in the resume or Not available",
  "email": "candidate email or Not available",
  "phone": "candidate phone or Not available",
  "currentRole": "current role or Not available",
  "experience": "experience duration or Not available",
  "skills": ["skill 1", "skill 2"],
  "educationDetails": "education information or Not available",
  "atsScore": 0,
  "fit": "Fit",
  "recommendation": "Shortlisted",
  "recommendationReason": "brief factual reason",
  "summary": "brief candidate summary",
  "matchedSkills": ["skill"],
  "relevantExperience": ["experience"],
  "education": ["education"],
  "skillGaps": ["gap"],
  "strengths": ["strength"],
  "concerns": ["concern"]
}

Rules:
- Do not invent information.
- Use only information available in the resume.
- Do not assume missing experience.
- Do not assume missing skills.
- atsScore must be between 0 and 100.
- ATS Score reflects explicit keyword and required-skill alignment with the job description. Use evidence from the resume and do not invent matches.
- fit must be exactly one of:
  "Fit", "Not Fit", "Review".
- recommendation must be exactly one of:
  "Shortlisted", "Not Shortlisted", "Review".
- Use "Not available" when information is not present.
`;

      try {
        const raw =
          await callAgent(
            prompt,
          );

        console.log(
          '[Screening] Raw AI response:',
          raw,
        );

        const parsed =
          parseScreeningResult(
            raw,
          );

        console.log(
          '[Screening] Parsed result:',
          parsed,
        );

        setCandidates(
          (current) =>
            current.map((item) =>
              item.id ===
              candidate.id
                ? {
                    ...item,
                    status:
                      'completed',
                    result:
                      parsed,
                    error:
                      undefined,
                  }
                : item,
            ),
        );
      } catch (
        screeningError
      ) {
        console.error(
          '[Screening] Error:',
          screeningError,
        );

        setCandidates(
          (current) =>
            current.map((item) =>
              item.id ===
              candidate.id
                ? {
                    ...item,
                    status:
                      'failed',
                    error:
                      screeningError instanceof
                      Error
                        ? screeningError.message
                        : 'Resume screening failed.',
                  }
                : item,
            ),
        );
      }
    };

  const screenAllCandidates =
    async () => {
      setError('');

      if (!jobTitle.trim()) {
        setError(
          'Please enter the job title.',
        );
        return;
      }

      if (
        !jobDescription.trim()
      ) {
        setError(
          'Please enter the job description and requirements.',
        );
        return;
      }

      const readyCandidates =
        candidates.filter(
          (candidate) =>
            candidate.resumeText &&
            candidate.status !==
              'completed' &&
            candidate.status !==
              'screening',
        );

      const uploadedCandidates =
        candidates.filter(
          (candidate) =>
            candidate.resumeText &&
            candidate.status ===
              'uploaded',
        );

      if (
        uploadedCandidates.length ===
        0
      ) {
        if (
          completedCandidates.length
        ) {
          setActiveView(
            'results',
          );
          return;
        }

        setError(
          'Please upload at least one readable resume.',
        );
        return;
      }

      setIsScreening(true);

      // Process resumes in controlled parallel batches.
      // Five concurrent requests improves throughput while callAgent
      // automatically retries temporary rate-limit/server errors.
      const SCREENING_BATCH_SIZE = 5;

      for (
        let index = 0;
        index < readyCandidates.length;
        index += SCREENING_BATCH_SIZE
      ) {
        const batch =
          readyCandidates.slice(
            index,
            index + SCREENING_BATCH_SIZE,
          );

        await Promise.all(
          batch.map((candidate) =>
            screenCandidate(candidate),
          ),
        );
      }

      setIsScreening(false);

      setActiveView('results');

      setSelectedCandidateId(
        null,
      );
    };

  const generateInterviewQuestions =
    async (
      candidate: Candidate,
    ) => {
      if (!candidate.result) {
        return;
      }

      const previousQuestions =
        candidate.result.interviewQuestions
          ? JSON.stringify(
              candidate.result.interviewQuestions,
            )
          : 'None. This is the first question generation.';

      const generationId =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

      setCandidates(
        (current) =>
          current.map((item) =>
            item.id ===
            candidate.id
              ? {
                  ...item,
                  result:
                    item.result
                      ? {
                          ...item.result,
                          interviewQuestions:
                            null,
                          interviewLoading:
                            true,
                        }
                      : null,
                }
              : item,
          ),
      );

      const prompt = `
You are an expert interviewer.

Generate a NEW set of interview questions specifically for this shortlisted candidate.

GENERATION ID:
${generationId}

JOB TITLE:
${jobTitle}

JOB REQUIREMENTS:
${jobDescription}

CANDIDATE SCREENING CONTEXT:
${JSON.stringify({
  recommendation: candidate.result.recommendation,
  recommendationReason: candidate.result.recommendationReason,
  matchedSkills: candidate.result.matchedSkills,
  relevantExperience: candidate.result.relevantExperience,
  skillGaps: candidate.result.skillGaps,
  strengths: candidate.result.strengths,
  concerns: candidate.result.concerns,
})}

CANDIDATE RESUME:
${candidate.resumeText}

Create interview questions by using BOTH:
1. The job description and its requirements.
2. The candidate's resume and demonstrated experience.

The questions must evaluate how the candidate's actual experience and skills align with the requirements of the role.

For every question, provide:
- The question.
- An expected answer or answer points describing what a strong response should demonstrate.
- Concise evaluation criteria for the interviewer.

IMPORTANT REGENERATION RULE:
If previous questions are provided below, you are regenerating the interview questions.
The new questions MUST be materially different from the previous questions.
Do not repeat, copy, lightly reword, or paraphrase any previous question.
Change the question angle, skill, project, scenario, requirement, or evidence being evaluated where appropriate.

PREVIOUS QUESTIONS:
${previousQuestions}

Return ONLY valid JSON.
Do not use markdown.
Do not add any explanation before or after the JSON.

{
  "technical": [
    {
      "question": "question 1",
      "expectedAnswer": "What a strong answer should contain",
      "evaluationCriteria": "How the interviewer should evaluate the response"
    }
  ],
  "behavioral": [
    {
      "question": "question 1",
      "expectedAnswer": "What a strong answer should contain",
      "evaluationCriteria": "How the interviewer should evaluate the response"
    }
  ],
  "domain": [
    {
      "question": "question 1",
      "expectedAnswer": "What a strong answer should contain",
      "evaluationCriteria": "How the interviewer should evaluate the response"
    }
  ]
}

Rules:
- Questions must be relevant to this candidate.
- Use the resume to identify candidate-specific skills, projects, responsibilities and experience that can be questioned.
- Use the job description to identify the skills, responsibilities and requirements that must be evaluated.
- Ask candidate-specific questions whenever the resume provides relevant evidence.
- Test important job requirements even when they are not sufficiently demonstrated in the resume.
- Do not assume the candidate has a skill or experience that is not present in the resume.
- Do not invent candidate experience.
- Avoid generic questions when a resume-specific question can be asked.
- Every generated question must add a meaningful new evaluation point.
`;

      try {
        const raw =
          await callAgent(
            prompt,
          );

        const cleaned =
          cleanJsonText(raw);

        let questions:
          InterviewQuestions;

        try {
          const parsed =
            JSON.parse(
              cleaned,
            ) as Record<
              string,
              unknown
            >;

          const normalizeQuestions = (value: unknown): InterviewQuestion[] => {
            if (!Array.isArray(value)) return [];

            return value
              .map((item) => {
                if (typeof item === 'string') {
                  return {
                    question: item,
                    expectedAnswer: 'Evaluate the response against the job requirements and the candidate’s demonstrated experience.',
                    evaluationCriteria: 'Look for accuracy, relevance, depth, clarity and evidence from the candidate’s experience.',
                  };
                }

                if (item && typeof item === 'object') {
                  const record = item as Record<string, unknown>;
                  return {
                    question: typeof record.question === 'string' ? record.question : '',
                    expectedAnswer: typeof record.expectedAnswer === 'string' ? record.expectedAnswer : 'Evaluate the response against the job requirements.',
                    evaluationCriteria: typeof record.evaluationCriteria === 'string' ? record.evaluationCriteria : 'Assess accuracy, relevance, depth and clarity.',
                  };
                }

                return null;
              })
              .filter((item): item is InterviewQuestion => Boolean(item?.question));
          };

          questions = {
            technical: normalizeQuestions(parsed.technical),
            behavioral: normalizeQuestions(parsed.behavioral),
            domain: normalizeQuestions(parsed.domain),
          };
        } catch {
          questions = {
            technical: [
              {
                question: 'Explain the most relevant technical experience from your resume for this role.',
                expectedAnswer: 'A strong answer should connect a specific technical project or responsibility from the resume to the role requirements.',
                evaluationCriteria: 'Assess technical depth, ownership, relevance and ability to explain the implementation clearly.',
              },
            ],
            behavioral: [
              {
                question: 'Describe a challenging situation you handled in your recent experience.',
                expectedAnswer: 'A strong answer should clearly describe the situation, the candidate’s actions, the reasoning behind those actions and the outcome.',
                evaluationCriteria: 'Look for ownership, structured thinking, communication and measurable outcome.',
              },
            ],
            domain: [
              {
                question: 'How would you apply your experience to the requirements of this role?',
                expectedAnswer: 'A strong answer should map relevant past experience and skills directly to the role requirements.',
                evaluationCriteria: 'Assess role alignment, practical understanding and evidence from prior work.',
              },
            ],
          };
        }

        setCandidates(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                candidate.id
                  ? {
                      ...item,
                      result:
                        item.result
                          ? {
                              ...item.result,
                              interviewQuestions:
                                questions,
                              interviewLoading:
                                false,
                            }
                          : null,
                    }
                  : item,
            ),
        );
      } catch (
        questionError
      ) {
        setCandidates(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                candidate.id
                  ? {
                      ...item,
                      result:
                        item.result
                          ? {
                              ...item.result,
                              interviewLoading:
                                false,
                            }
                          : null,
                      error:
                        questionError instanceof
                        Error
                          ? questionError.message
                          : 'Interview question generation failed.',
                    }
                  : item,
            ),
        );
      }
    };

  const exportToExcel = () => {
    try {
      setError('');

      if (!completedCandidates.length) {
        setError(
          'No completed screening results are available to export.',
        );
        return;
      }

      const rows = completedCandidates.map(
        (candidate, index) => {
          const result = candidate.result;

          const skills =
            result?.skills?.length
              ? result.skills.join(', ')
              : result?.matchedSkills?.length
                ? result.matchedSkills.join(', ')
                : 'Not available';

          const education =
            result?.educationDetails?.trim()
              ? result.educationDetails
              : result?.education?.length
                ? result.education.join(', ')
                : 'Not available';

          return {
            Rank: index + 1,
            'Candidate Name':
              result?.candidateName || candidate?.candidateName || candidate.file.name.replace(/\.[^/.]+$/, '') || 'Not available',
            Email: result?.email || 'Not available',
            Phone: result?.phone || 'Not available',
            'Job Role':
              result?.jobRole || result?.currentRole || 'Role not identified',
            Experience:
              result?.experience || 'Not available',
            Skills: skills,
            Education: education,
            'ATS Score':
              result?.atsScore !== null &&
              result?.atsScore !== undefined
                ? result.atsScore
                : 'Not available',
            'Shortlist Recommendation':
              result?.recommendation || 'Review',
            'Recommendation Reason':
              result?.recommendationReason || 'Not available',
            'Matched Skills':
              result?.matchedSkills?.length
                ? result.matchedSkills.join(', ')
                : 'Not available',
            'Relevant Experience':
              result?.relevantExperience?.length
                ? result.relevantExperience.join(', ')
                : 'Not available',
            'Skill Gaps':
              result?.skillGaps?.length
                ? result.skillGaps.join(', ')
                : 'None identified',
            Concerns:
              result?.concerns?.length
                ? result.concerns.join(', ')
                : 'None identified',
          };
        },
      );

      const worksheet = XLSX.utils.json_to_sheet(rows);

      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 32 },
        { wch: 20 },
        { wch: 28 },
        { wch: 20 },
        { wch: 48 },
        { wch: 35 },
        { wch: 14 },
        { wch: 24 },
        { wch: 55 },
        { wch: 50 },
        { wch: 55 },
        { wch: 45 },
        { wch: 45 },
      ];

      const lastColumn = 'O';
      const lastRow = rows.length + 1;

      worksheet['!autofilter'] = {
        ref: `A1:${lastColumn}${lastRow}`,
      };

      // HR-friendly header formatting.
      for (let column = 0; column < 15; column += 1) {
        const cellAddress = XLSX.utils.encode_cell({
          r: 0,
          c: column,
        });

        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
            font: {
              bold: true,
              color: { rgb: 'FFFFFF' },
            },
            fill: {
              fgColor: { rgb: '033C67' },
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center',
              wrapText: true,
            },
            border: {
              top: { style: 'thin', color: { rgb: 'D9E2EA' } },
              bottom: { style: 'thin', color: { rgb: 'D9E2EA' } },
              left: { style: 'thin', color: { rgb: 'D9E2EA' } },
              right: { style: 'thin', color: { rgb: 'D9E2EA' } },
            },
          };
        }
      }

      // Alternating rows + shortlist status highlighting.
      for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
        const recommendation =
          rows[rowIndex - 1]['Shortlist Recommendation'];

        for (let column = 0; column < 15; column += 1) {
          const cellAddress = XLSX.utils.encode_cell({
            r: rowIndex,
            c: column,
          });

          const cell = worksheet[cellAddress];
          if (!cell) continue;

          const baseFill =
            rowIndex % 2 === 0 ? 'F7FAFC' : 'FFFFFF';

          cell.s = {
            fill: {
              fgColor: { rgb: baseFill },
            },
            alignment: {
              vertical: 'top',
              wrapText: true,
            },
            border: {
              top: { style: 'thin', color: { rgb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
              left: { style: 'thin', color: { rgb: 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: 'E2E8F0' } },
            },
          };
        }

        const shortlistCell =
          worksheet[
            XLSX.utils.encode_cell({
              r: rowIndex,
              c: 10,
            })
          ];

        if (shortlistCell) {
          if (recommendation === 'Shortlisted') {
            shortlistCell.s = {
              ...shortlistCell.s,
              font: {
                bold: true,
                color: { rgb: '047857' },
              },
              fill: {
                fgColor: { rgb: 'DCFCE7' },
              },
              alignment: {
                horizontal: 'center',
                vertical: 'center',
                wrapText: true,
              },
            };
          } else if (recommendation === 'Not Shortlisted') {
            shortlistCell.s = {
              ...shortlistCell.s,
              font: {
                bold: true,
                color: { rgb: 'B91C1C' },
              },
              fill: {
                fgColor: { rgb: 'FEE2E2' },
              },
              alignment: {
                horizontal: 'center',
                vertical: 'center',
                wrapText: true,
              },
            };
          } else {
            shortlistCell.s = {
              ...shortlistCell.s,
              font: {
                bold: true,
                color: { rgb: 'A16207' },
              },
              fill: {
                fgColor: { rgb: 'FEF3C7' },
              },
              alignment: {
                horizontal: 'center',
                vertical: 'center',
                wrapText: true,
              },
            };
          }
        }
      }

      worksheet['!rows'] = [
        { hpt: 24 },
        ...rows.map(() => ({ hpt: 42 })),
      ];

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Screening Results',
      );

      const fileName =
        `Resume_Screening_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;

      XLSX.writeFile(
        workbook,
        fileName,
        {
          bookType: 'xlsx',
          compression: true,
        },
      );

      console.log(
        `[Excel] Exported ${rows.length} candidates to ${fileName}`,
      );
    } catch (exportError) {
      console.error(
        '[Excel] Export failed:',
        exportError,
      );

      setError(
        exportError instanceof Error
          ? `Excel export failed: ${exportError.message}`
          : 'Excel export failed.',
      );
    }
  };

  return (
    <>
      <style>{`
        :root {
          --dp-blue: #033c67;
          --dp-orange: #f46902;
          --dp-icon-orange: #f18a31;
        }

        .dp-dark {
          background: #0b1821 !important;
          color: #e8f1f6 !important;
        }

        .dp-dark main {
          background: #0b1821 !important;
        }

        .dp-dark header {
          background: #102531 !important;
          border-color: #315466 !important;
        }

        .dp-dark header .text-[#033c67] {
          color: #e8f1f6 !important;
        }

        .dp-dark header .text-[#5b7890],
        .dp-dark header .text-[#7b94a7] {
          color: #a7becb !important;
        }

        .dp-dark .bg-white {
          background-color: #142c39 !important;
          color: #e8f1f6 !important;
          border-color: #2e4c5b !important;
        }

        .dp-dark input,
        .dp-dark select,
        .dp-dark textarea {
          background-color: #102531 !important;
          color: #e8f1f6 !important;
          border-color: #3b6071 !important;
        }

        .dp-dark input::placeholder,
        .dp-dark textarea::placeholder {
          color: #87a2b2 !important;
        }

        .dp-dark .text-[#033c67],
        .dp-dark .text-[#164f75] {
          color: #e6f1f6 !important;
        }

        .dp-dark .text-[#5b7890],
        .dp-dark .text-[#7b94a7] {
          color: #a7becb !important;
        }

        .dp-dark .bg-[#f7fafc],
        .dp-dark .bg-[#edf6fb],
        .dp-dark .bg-[#eef6fa],
        .dp-dark .bg-[#f4f8fb],
        .dp-dark .bg-[#f7fbfd] {
          background-color: #193442 !important;
        }

        .dp-dark .bg-gradient-to-r {
          background: linear-gradient(90deg, #173747 0%, #1b3b4b 55%, #17313e 100%) !important;
          border-color: #35586a !important;
        }

        .dp-dark .border-slate-200,
        .dp-dark .border-slate-300,
        .dp-dark .border-[#cfe2ed],
        .dp-dark .border-[#cfe3ef],
        .dp-dark .border-[#c7dce9],
        .dp-dark .border-[#b9d5e6] {
          border-color: #315466 !important;
        }

        .dp-dark .divide-slate-100 > :not([hidden]) ~ :not([hidden]) {
          border-color: #294958 !important;
        }

        .dp-dark .bg-slate-100,
        .dp-dark .bg-slate-50 {
          background-color: #193442 !important;
        }

        .dp-dark .text-slate-900,
        .dp-dark .text-slate-800,
        .dp-dark .text-slate-700 {
          color: #e8f1f6 !important;
        }

        .dp-dark .hover\:bg-\[\#f5f9fb\]:hover,
        .dp-dark .hover\:bg-\[\#eef6fa\]:hover {
          background-color: #1d3b4b !important;
        }

        .dp-dark .shadow-sm,
        .dp-dark .shadow-xl,
        .dp-dark .shadow-2xl {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24) !important;
        }

        .dp-dark .text-white {
          color: #f3f8fb !important;
        }

        .dp-dark .bg-[#e8f2f8] {
          background-color: #0b1821 !important;
        }

        .dp-dark .bg-[#f7fbfd],
        .dp-dark .bg-[#f7fafc],
        .dp-dark .bg-[#f5f9fc] {
          background-color: #173442 !important;
        }

        .dp-dark .bg-[#fff8f2],
        .dp-dark .bg-[#fff4ec] {
          background-color: #3a2b20 !important;
        }

        .dp-dark .text-[#f46902],
        .dp-dark .text-[#f18a31] {
          color: #ffad6a !important;
        }

        .dp-dark .border-[#f18a31] {
          border-color: #d88945 !important;
        }

        .dp-dark .dp-scrollbar::-webkit-scrollbar-track {
          background: #142c39;
        }

        .dp-scrollbar::-webkit-scrollbar {
          width: 7px;
        }

        .dp-scrollbar::-webkit-scrollbar-track {
          background: #eef6fa;
          border-radius: 9999px;
        }

        .dp-scrollbar::-webkit-scrollbar-thumb {
          background: #f18a31;
          border-radius: 9999px;
        }

        .dp-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #033c67;
        }
      `}</style>

      <div className={`dp-app flex h-screen flex-col overflow-hidden bg-[#e8f2f8] text-[#033c67] ${theme === 'dark' ? 'dp-dark' : ''}`}>
      <header className="shrink-0 border-t-[3px] border-[#f18a31] border-b border-[#c7dce9] bg-[#edf6fb] shadow-[0_2px_12px_rgba(3,60,103,0.06)]">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Go to Resume Screening setup"
              onClick={() => {
                if (isScreening) return;

                setActiveView('screening');
                setJobTitle('');
                setJobDescription('');
                setJdFileName('');
                setCandidates([]);
                setSelectedCandidateId(null);
                setExpandedCandidateId(null);
                setError('');

                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }

                if (jdFileInputRef.current) {
                  jdFileInputRef.current.value = '';
                }
              }}
              disabled={isScreening}
              className="group flex cursor-pointer items-center rounded-md p-0 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100"
            >
              <DataPatternLogo />
            </button>

            <div className="hidden h-7 w-px bg-[#d7e3ea] sm:block" />

            <div className="hidden min-w-0 flex-col justify-center md:flex">
              <span className="text-base font-bold tracking-tight text-[#033c67]">AI Recruitment Platform</span>
              <span className="text-[11px] font-medium text-[#5b7890]">Resume Screening &amp; Shortlisting</span>
            </div>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              disabled={isScreening}
              onClick={() => {
                if (!isScreening) {
                  setActiveView('screening');
                }
              }}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeView === 'screening'
                  ? 'bg-[#033c67] text-white'
                  : 'text-[#5b7890] hover:bg-[#eef6fa] hover:text-[#033c67]'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Job Setup
            </button>

            <button
              type="button"
              disabled={!isScreening}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isScreening
                  ? 'bg-[#eef6fa] text-[#033c67]'
                  : 'text-[#7b94a7]'
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              Evaluation
            </button>

            <button
              type="button"
              disabled={!completedCandidates.length || isScreening}
              onClick={() => setActiveView('results')}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeView === 'results'
                  ? 'bg-[#033c67] text-white'
                  : 'text-[#7b94a7] hover:bg-[#eef6fa] hover:text-[#033c67]'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Results
            </button>

            <button
              type="button"
              disabled={isScreening}
              onClick={() => setActiveView('repository')}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeView === 'repository'
                  ? 'bg-[#033c67] text-white'
                  : 'text-[#7b94a7] hover:bg-[#eef6fa] hover:text-[#033c67]'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Repository
            </button>
          </div>

          <div className="relative flex items-center">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isProfileOpen}
              onClick={() => setIsProfileOpen((open) => !open)}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-[#f5f9fb]"
            >
              <div className="hidden text-right sm:block">
                <div className="max-w-[180px] truncate text-sm font-semibold text-[#033c67]">
                  {displayName}
                </div>
              </div>

              <div className="flex size-9 items-center justify-center rounded-full bg-[#033c67] text-xs font-bold text-white ring-2 ring-blue-50">
                {userInitials}
              </div>

              {isProfileOpen ? (
                <ChevronUp className="size-4 text-[#7b94a7]" />
              ) : (
                <ChevronDown className="size-4 text-[#7b94a7]" />
              )}
            </button>

            {isProfileOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close profile menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsProfileOpen(false)}
                />

                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#033c67] text-sm font-bold text-white">
                        {userInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#033c67]">
                          {displayName}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        setIsProfilePageOpen(true);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#164f75] transition hover:bg-[#eef6fa] hover:text-[#033c67]"
                    >
                      <UserRound className="size-4" />
                      Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        setIsSettingsOpen(true);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#164f75] transition hover:bg-[#eef6fa] hover:text-[#033c67]"
                    >
                      <Settings className="size-4" />
                      Settings
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={async () => {
                        setIsProfileOpen(false);
                        try {
                          await supabase.auth.signOut();
                        } catch (e) {
                          console.warn('Supabase sign out error:', e);
                        }
                        try {
                          await apiFetch('/api/auth/logout', { method: 'POST' });
                        } catch (e) {
                          console.warn('Server logout error:', e);
                        }
                        clearAllAtsDrafts();
                        window.localStorage.removeItem('dp_profile_name');
                        window.localStorage.removeItem('dp_theme');
                        setSignOutMessage('Signed out successfully.');
                        window.location.href = '/login';
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#164f75] transition hover:bg-red-50 hover:text-red-600"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {isProfilePageOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#033c67]/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-lg font-semibold text-[#033c67]">Profile</div>
                <div className="mt-1 text-sm text-[#5b7890]">View your account and workspace information.</div>
              </div>
              <button type="button" onClick={() => setIsProfilePageOpen(false)} className="cursor-pointer rounded-lg p-2 text-[#7b94a7] hover:bg-[#eef6fa] hover:text-[#164f75]">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-6">
              <div className="flex items-center gap-4 rounded-2xl bg-[#f7fafc] p-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#033c67] text-lg font-bold text-white">{userInitials}</div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">Signed-in profile</div>
                  <div className="mt-1 text-lg font-semibold text-[#033c67]">{displayName}</div>
                  <div className="mt-1 text-sm text-[#5b7890]">{userEmail || 'Email not available'}</div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-[#f7fafc] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">Account name</div>
                  <div className="mt-1 text-sm font-semibold text-[#033c67]">{displayName}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f7fafc] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">Email</div>
                  <div className="mt-1 break-all text-sm font-semibold text-[#033c67]">{userEmail || 'Email not available'}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f7fafc] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">Application</div>
                  <div className="mt-1 text-sm font-semibold text-[#033c67]">AI Recruitment Platform</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f7fafc] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">Workspace</div>
                  <div className="mt-1 text-sm font-semibold text-[#033c67]">Resume Screening &amp; Shortlisting</div>
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfe3ef] bg-[#eef6fa]/60 p-4 text-sm leading-6 text-[#5b7890]">
                This profile reflects the signed-in account used to access the platform.
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setIsProfilePageOpen(false)} className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#164f75] hover:bg-[#f5f9fb]">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#033c67]/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-lg font-semibold text-[#033c67]">Settings</div>
                <div className="mt-1 text-sm text-[#5b7890]">Application appearance and display preferences.</div>
              </div>
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="cursor-pointer rounded-lg p-2 text-[#7b94a7] hover:bg-[#eef6fa] hover:text-[#164f75]">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div>
                  <div className="text-sm font-semibold text-[#033c67]">Appearance</div>
                  <div className="mt-1 text-xs text-[#7b94a7]">Choose light or dark mode.</div>
                </div>
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button type="button" onClick={() => { setTheme('light'); window.localStorage.setItem('dp_theme', 'light'); }} className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold ${theme === 'light' ? 'bg-white text-[#033c67] shadow-sm' : 'text-[#7b94a7]'}`}>Light</button>
                  <button type="button" onClick={() => { setTheme('dark'); window.localStorage.setItem('dp_theme', 'dark'); }} className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'bg-[#033c67] text-white shadow-sm' : 'text-[#7b94a7]'}`}>Dark</button>
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfe3ef] bg-[#eef6fa]/60 p-4 text-sm leading-6 text-[#5b7890]">
                Use the platform to screen candidates, review assessments, manage interview questions, and export results.
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setIsSettingsOpen(false)} className="cursor-pointer rounded-xl bg-[#033c67] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#022f50]">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {signOutMessage && (
        <div className="fixed bottom-5 right-5 z-[100] rounded-xl bg-[#033c67] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {signOutMessage}
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] px-6 py-7">
          <div className="mb-6 flex items-end justify-between rounded-2xl border border-[#cfe2ed] bg-gradient-to-r from-[#d9ebf5] via-[#edf6fb] to-[#f5f9fc] px-6 py-5 shadow-sm">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-[#5b7890]">
                <Target className="size-4" />
                Recruitment Workspace · Candidate Screening
              </div>

              <h1 className="text-3xl font-bold tracking-tight">
                Resume Screening
              </h1>

              <p className="mt-1 text-sm text-[#5b7890]">
                Screen candidates against the defined role requirements and review the results in one workspace.
              </p>
            </div>

            <div className="hidden rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm sm:block">
              <div className="text-xs text-[#5b7890]">
                Candidates
              </div>

              <div className="text-2xl font-bold">
                {candidates.length}
              </div>
            </div>
          </div>

          <Workflow
            activeView={activeView}
            candidates={candidates}
            completedCandidates={completedCandidates}
            isScreening={isScreening}
          />

          {activeView === 'repository' ? (
            <CandidateRepositoryView onSelectForScreening={handleAddStoredCandidatesToScreening} refreshKey={repoRefreshKey} />
          ) : activeView === 'screening' ? (
            isScreening ? (
              <ScreeningProgressView
                jobTitle={jobTitle}
                candidates={candidates}
              />
            ) : (
              <ScreeningView
                onOpenRepository={() => setActiveView('repository')}
                jobTitle={jobTitle}
                jobDescription={jobDescription}
                candidates={candidates}
                readiness={readiness}
                error={error}
                fileInputRef={fileInputRef}
                onJobTitleChange={setJobTitle}
                onJobDescriptionChange={(value) => {
                  setJobDescription(value);
                  if (!value.trim()) {
                    setJdFileName('');
                  }
                }}
                jdFileInputRef={jdFileInputRef}
                jdFileName={jdFileName}
                isUploadingJd={isUploadingJd}
                onJdSelect={handleJdSelect}
                onFileSelect={handleResumeSelect}
                sharePointLink={sharePointLink}
                isFetchingSharePoint={isFetchingSharePoint}
                onSharePointLinkChange={setSharePointLink}
                onSharePointFetch={handleSharePointFetch}
                onRemove={removeCandidate}
                onClearAll={clearAllCandidates}
                isScreening={isScreening}
                onScreen={screenAllCandidates}
              />
            )
          ) : (
            <ResultsView
              jobTitle={jobTitle}
              candidates={completedCandidates}
              shortlistedCandidates={shortlistedCandidates}
              averageScore={averageScore}
              selectedCandidate={selectedCandidate}
              expandedCandidateId={expandedCandidateId}
              onSelectCandidate={(id) =>
                setSelectedCandidateId((current) =>
                  current === id ? null : id,
                )
              }
              onExpandCandidate={(id) =>
                setExpandedCandidateId(
                  expandedCandidateId === id ? null : id,
                )
              }
              onGenerateQuestions={generateInterviewQuestions}
              onExport={exportToExcel}
              onBackToSetup={() => setActiveView('screening')}
            />
          )}
        </div>
      </main>
    </div>
    </>
  );
}

function Workflow({
  activeView,
  candidates,
  completedCandidates,
  isScreening,
}: {
  activeView: 'screening' | 'results';
  candidates: Candidate[];
  completedCandidates: Candidate[];
  isScreening: boolean;
}) {
  const setupReady = Boolean(
    candidates.some(
      (candidate) =>
        candidate.resumeText &&
        candidate.status !== 'failed',
    ) &&
      completedCandidates.length === 0,
  );

  const resultsReady =
    activeView === 'results' && completedCandidates.length > 0;

  const currentStep = isScreening
    ? 1
    : resultsReady
      ? 2
      : 0;

  const steps = [
    {
      label: 'Job Setup',
      description: 'Set role criteria & upload resumes',
      done: setupReady || resultsReady,
    },
    {
      label: 'Screening',
      description: 'Evaluate & rank candidates',
      done: resultsReady,
    },
    {
      label: 'Results',
      description: 'Review candidate assessment & interview',
      done: resultsReady,
    },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {steps.map((step, index) => (
          <div key={step.label} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                  step.done
                    ? 'border-slate-900 bg-[#033c67] text-white'
                    : index === currentStep
                      ? 'border-slate-900 bg-white text-[#033c67] ring-4 ring-slate-100'
                      : 'border-slate-200 bg-white text-[#7b94a7]'
                }`}
              >
                {step.done ? <CheckCircle2 className="size-4" /> : index + 1}
              </div>

              <div className="min-w-0">
                <div
                  className={`truncate text-xs font-semibold ${
                    index === currentStep || step.done
                      ? 'text-[#033c67]'
                      : 'text-[#7b94a7]'
                  }`}
                >
                  {step.label}
                </div>
                <div className="hidden text-[11px] text-[#7b94a7] sm:block">
                  {step.description}
                </div>
              </div>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`mx-3 h-px flex-1 ${
                  step.done ? 'bg-[#033c67]' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreeningView({
  jobTitle,
  jobDescription,
  candidates,
  readiness,
  error,
  fileInputRef,
  jdFileInputRef,
  jdFileName,
  isUploadingJd,
  onJdSelect,
  onJobTitleChange,
  onJobDescriptionChange,
  onFileSelect,
  sharePointLink,
  isFetchingSharePoint,
  onSharePointLinkChange,
  onSharePointFetch,
  onOpenRepository,
  onRemove,
  onClearAll,
  isScreening,
  onScreen,
}: {
  jobTitle: string;
  jobDescription: string;
  candidates: Candidate[];
  readiness: boolean;
  error: string;
  fileInputRef: React.RefObject<
    HTMLInputElement | null
  >;
  jdFileInputRef: React.RefObject<
    HTMLInputElement | null
  >;
  jdFileName: string;
  isUploadingJd: boolean;
  onJdSelect: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  onJobTitleChange: (
    value: string,
  ) => void;
  onJobDescriptionChange: (
    value: string,
  ) => void;
  onFileSelect: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  sharePointLink: string;
  isFetchingSharePoint: boolean;
  onSharePointLinkChange: (value: string) => void;
  onSharePointFetch: () => void;
  onOpenRepository?: () => void;
  onRemove: (
    id: string,
  ) => void;
  onClearAll: () => void;
  isScreening: boolean;
  onScreen: () => void;
}) {
  return (
    <>
      <div className="grid items-stretch gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex h-[680px] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#eef6fa] text-[#033c67]">
                <BriefcaseBusiness className="size-5" />
              </div>

              <div>
                <h2 className="font-semibold">
                  Role Requirements
                </h2>

                <p className="text-xs text-[#5b7890]">
                  Set the role criteria used for candidate screening.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Job Title
              </label>

              <input
                value={
                  jobTitle
                }
                onChange={(
                  event,
                ) =>
                  onJobTitleChange(
                    event.target
                      .value,
                  )
                }
                placeholder="e.g. Senior Data Analyst"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="block text-sm font-semibold">
                  Job Description & Requirements
                </label>

                <input
                  ref={jdFileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={onJdSelect}
                />

                <button
                  type="button"
                  onClick={() => jdFileInputRef.current?.click()}
                  disabled={isUploadingJd}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#b9d5e6] bg-white px-3 py-2 text-xs font-semibold text-[#033c67] transition hover:border-[#f18a31] hover:bg-[#fff8f2] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingJd ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {isUploadingJd ? 'Reading JD...' : 'Upload Job Description'}
                </button>
              </div>

              {jdFileName && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-[#eef6fa] px-3 py-2 text-xs text-[#033c67]">
                  <FileText className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    JD file: {jdFileName}
                  </span>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                </div>
              )}

              <textarea
                value={jobDescription}
                onChange={(event) =>
                  onJobDescriptionChange(event.target.value)
                }
                placeholder="Paste the job description here, or upload a PDF, DOCX or TXT job description."
                className="h-[260px] min-h-0 w-full shrink-0 resize-none overflow-y-auto rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-100"
              />

              <p className="mt-2 text-[11px] text-[#7b94a7]">
                Add the job description in the text area or upload a PDF, DOCX, or TXT file using the button above.
              </p>
            </div>

            <div className="rounded-xl bg-[#f7fafc] p-4 text-xs leading-5 text-[#5b7890]">
              <div className="flex gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-[#164f75]" />

                <span>
                  The AI will compare every candidate against these requirements and calculate an ATS Score, fit status and shortlist recommendation.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex h-[680px] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#fff4ec] text-[#f18a31]">
                  <Users className="size-5" />
                </div>

                <div>
                  <h2 className="font-semibold">
                    Candidate Resumes
                  </h2>

                  <p className="text-xs text-[#5b7890]">
                    Add one or multiple resumes for screening.
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-[#fff4ec] px-3 py-1 text-xs font-semibold text-[#033c67]">
                {
                  candidates.length
                }{' '}
                uploaded
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
            <div className="shrink-0 mb-5 rounded-2xl border border-[#b9d5e6] bg-[#f7fbfd] p-4">
              <div className="mb-3 text-sm font-semibold text-[#033c67]">
                SharePoint Resume Source
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="url"
                  value={sharePointLink}
                  onChange={(event) =>
                    onSharePointLinkChange(event.target.value)
                  }
                  placeholder="Paste SharePoint folder link"
                  disabled={isFetchingSharePoint || isScreening}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <button
                  type="button"
                  onClick={onSharePointFetch}
                  disabled={isFetchingSharePoint || isScreening}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#033c67] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#022f50] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingSharePoint && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {isFetchingSharePoint ? 'Fetching...' : 'Fetch Resumes'}
                </button>
              </div>

              <div className="mt-3 text-[11px] text-[#7b94a7]">
                Paste the SharePoint folder link that contains the resumes.
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="mb-5 flex shrink-0 items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">
              <div className="h-px flex-1 bg-slate-200" />
              <span>OR</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <input
              ref={
                fileInputRef
              }
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={
                onFileSelect
              }
            />

            {onOpenRepository && (
              <div className="mb-4 flex shrink-0 justify-center">
                <button
                  type="button"
                  onClick={onOpenRepository}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#033c67] shadow-sm transition hover:bg-[#eef6fa] hover:border-[#b9d5e6]"
                >
                  <Users className="size-4 text-[#f18a31]" />
                  Select from Candidate Repository
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="group flex min-h-[150px] shrink-0 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#b9d5e6] bg-[#f7fbfd] transition hover:border-[#f18a31] hover:bg-[#fff8f2]"
            >
              <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#dcecf5] transition group-hover:scale-105">
                <Upload className="size-7 text-[#5b7890]" />
              </div>

              <div className="text-sm font-semibold">
                Drop resumes here or browse
              </div>

              <div className="mt-1 text-xs text-[#5b7890]">
                PDF, DOCX or TXT
              </div>

              <div className="mt-2 text-[11px] text-[#7b94a7]">
                Maximum 10 MB per file
              </div>
            </button>

            {candidates.length >
              0 && (
              <div className="mt-5 flex min-h-0 flex-1 flex-col">
                <div className="mb-2 flex shrink-0 items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">
                  <span>Uploaded candidates</span>
                  <div className="flex items-center gap-3">
                    <span className="normal-case font-medium tracking-normal text-[#7b94a7]">
                    </span>
                    <button
                      type="button"
                      onClick={onClearAll}
                      disabled={isScreening}
                      className="normal-case tracking-normal rounded-md border border-[#f18a31] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#f46902] transition hover:bg-[#fff4ec] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                <div className="dp-scrollbar max-h-[420px] min-h-0 flex-1 space-y-2 overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:#9bb8ca_#eef6fa]">
                {candidates.map(
                  (
                    candidate,
                  ) => (
                    <div
                      key={
                        candidate.id
                      }
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef6fa]">
                          <FileText className="size-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {candidate.candidateName || candidate.file.name}
                            </span>
                            {candidate.fromRepository && (
                              <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                Repository
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs text-[#5b7890]">
                            <span>
                              {(
                                candidate.file
                                  .size /
                                1024
                              ).toFixed(
                                0,
                              )}{' '}
                              KB
                            </span>

                            <span>
                              •
                            </span>

                            {candidate.status ===
                              'uploaded' && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="size-3" />
                                Ready
                              </span>
                            )}

                            {candidate.status ===
                              'screening' && (
                              <span className="flex items-center gap-1">
                                <Loader2 className="size-3 animate-spin" />
                                Processing
                              </span>
                            )}

                            {candidate.status ===
                              'completed' && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="size-3" />
                                Screened
                              </span>
                            )}

                            {candidate.status ===
                              'failed' && (
                              <span className="text-red-600">
                                Failed
                              </span>
                            )}
                          </div>

                          {candidate.error && (
                            <div className="mt-1 text-xs text-red-600">
                              {
                                candidate.error
                              }
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onRemove(
                            candidate.id,
                          )
                        }
                        className="ml-3 rounded-lg p-2 text-[#7b94a7] hover:bg-[#eef6fa] hover:text-[#164f75]"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ),
                )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-sm font-semibold">
            Ready to evaluate candidates?
          </div>

          <div className="mt-1 text-xs text-[#5b7890]">
            {candidates.length === 0
              ? 'Upload candidate resumes to begin'
              : candidates.some((candidate) => candidate.status === 'screening')
                ? 'Processing uploaded resumes. The screening button will be available when all resumes are ready.'
                : `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} ready for AI evaluation`}
          </div>
        </div>

        <button
          type="button"
          onClick={
            onScreen
          }
          disabled={
            !readiness
          }
          className="inline-flex items-center gap-2 rounded-xl bg-[#033c67] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#022f50] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <><span>Start Screening</span><ChevronRight className="size-4" /></>
        </button>
      </div>

    </>
  );
}

function ScreeningProgressView({
  jobTitle,
  candidates,
}: {
  jobTitle: string;
  candidates: Candidate[];
}) {
  const completedCount = candidates.filter(
    (candidate) => candidate.status === 'completed',
  ).length;
  const failedCount = candidates.filter(
    (candidate) => candidate.status === 'failed',
  ).length;
  const totalCount = candidates.length;
  const processedCount = completedCount + failedCount;
  const progress = totalCount
    ? Math.round((processedCount / totalCount) * 100)
    : 0;
  const currentCandidate = candidates.find(
    (candidate) => candidate.status === 'screening',
  );

  return (
    <div className="mx-auto max-w-4xl">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#033c67] text-white shadow-sm">
              <Sparkles className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">
                Candidate Screening
              </div>
              <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                Evaluating candidates against the job requirements
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5b7890]">
                {jobTitle ? (
                  <>
                    Evaluating candidates for <strong className="text-[#164f75]">{jobTitle}</strong>.
                  </>
                ) : (
                  'The AI is evaluating each candidate and preparing the shortlist.'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-7 p-6 sm:p-8">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-[#164f75]">
                {processedCount} of {totalCount} candidates screened
              </span>
              <span className="font-semibold text-[#5b7890]">
                {progress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eef6fa]">
              <div
                className="h-full rounded-full bg-[#033c67] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-[#f7fafc] p-4">
              <div className="text-xs text-[#5b7890]">Total resumes</div>
              <div className="mt-1 text-2xl font-bold">{totalCount}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f7fafc] p-4">
              <div className="text-xs text-[#5b7890]">Completed</div>
              <div className="mt-1 text-2xl font-bold">{completedCount}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f7fafc] p-4">
              <div className="text-xs text-[#5b7890]">Needs attention</div>
              <div className="mt-1 text-2xl font-bold">{failedCount}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="mb-4 text-sm font-semibold">Screening progress</div>
            <div className="space-y-3">
              <ProcessingItem
                label="Resume information extracted"
                done={candidates.some((candidate) => candidate.resumeText)}
              />
              <ProcessingItem
                label="AI matching and scoring"
                done={completedCount === totalCount && totalCount > 0}
                active={completedCount < totalCount}
              />
              <ProcessingItem
                label="Candidate ranking and shortlist"
                done={completedCount === totalCount && totalCount > 0}
                active={completedCount > 0 && completedCount < totalCount}
              />
              <ProcessingItem
                label="Preparing results"
                done={false}
                active={false}
              />
            </div>
          </div>

          {currentCandidate && (
            <div className="flex items-center gap-3 rounded-xl bg-[#f7fafc] px-4 py-3 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-[#5b7890]" />
              <div className="min-w-0">
                <div className="font-medium text-[#164f75]">
                  Currently screening
                </div>
                <div className="truncate text-xs text-[#5b7890]">
                  {currentCandidate.file.name}
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-[#7b94a7]">
            Please keep this page open while the AI completes the screening.
          </p>
        </div>
      </section>
    </div>
  );
}

function ResultsView({
  jobTitle,
  candidates,
  shortlistedCandidates,
  averageScore,
  selectedCandidate,
  expandedCandidateId,
  onSelectCandidate,
  onExpandCandidate,
  onGenerateQuestions,
  onExport,
  onBackToSetup,
}: {
  jobTitle: string;
  candidates: Candidate[];
  shortlistedCandidates: Candidate[];
  averageScore: number;
  selectedCandidate: Candidate | null;
  expandedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  onExpandCandidate: (id: string) => void;
  onGenerateQuestions: (candidate: Candidate) => void;
  onExport: () => void;
  onBackToSetup: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<
    'all' | 'shortlisted' | 'not-shortlisted'
  >('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, resultFilter]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredCandidates = candidates.filter((candidate) => {
    const result = candidate.result;
    if (!result) return false;

    const matchesFilter =
      resultFilter === 'all' ||
      (resultFilter === 'shortlisted' && result.recommendation === 'Shortlisted') ||
      (resultFilter === 'not-shortlisted' && result.recommendation === 'Not Shortlisted');

    if (!matchesFilter) return false;
    if (!normalizedSearch) return true;

    const candidateName =
      result.candidateName || 'Not available';
    const searchableText = [
      candidateName,
      result.email,
      result.phone,
      result.currentRole,
      result.jobRole,
      result.experience,
      result.educationDetails,
      ...result.skills,
      ...result.matchedSkills,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCandidates.length / PAGE_SIZE),
  );

  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageCandidates = filteredCandidates.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  const pageEnd = Math.min(
    pageStart + pageCandidates.length,
    filteredCandidates.length,
  );

  useEffect(() => {
    if (!selectedCandidate) return;

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`candidate-assessment-${selectedCandidate.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedCandidate]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">
            Screening complete
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Candidate Results</h2>
          <p className="mt-1 text-sm text-[#5b7890]">
            Search candidates, review screening results, and open interview questions when needed.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToSetup}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#f5f9fb]"
        >
          Back to Setup
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="Candidates Screened"
          value={String(candidates.length)}
          icon={<Users className="size-5" />}
        />
        <SummaryCard
          label="Average Match"
          value={`${averageScore}%`}
          icon={<Target className="size-5" />}
        />
        <SummaryCard
          label="Shortlisted"
          value={String(shortlistedCandidates.length)}
          icon={<Award className="size-5" />}
        />
        <SummaryCard
          label="Role"
          value={jobTitle || 'Not defined'}
          icon={<BriefcaseBusiness className="size-5" />}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Candidate Ranking</h2>
              <p className="mt-1 text-xs text-[#5b7890]">
                Select a candidate to view their assessment directly below the ranking list.
              </p>
            </div>

            <button
              type="button"
              onClick={onExport}
              disabled={!candidates.length}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#f5f9fb] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="size-4" />
              Export Results to Excel
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7b94a7]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search candidate name, email, skills or role..."
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#5b7890] focus:ring-2 focus:ring-[#d9ebf5]"
              />
            </div>

            <select
              value={resultFilter}
              onChange={(event) =>
                setResultFilter(
                  event.target.value as
                    | 'all'
                    | 'shortlisted'
                    | 'not-shortlisted',
                )
              }
              className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-[#164f75] outline-none focus:border-[#5b7890] focus:ring-2 focus:ring-[#d9ebf5]"
            >
              <option value="all">All Candidates</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="not-shortlisted">Not Shortlisted</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#7b94a7]">
            <span>
              {filteredCandidates.length === 0
                ? 'No candidates match the current search/filter.'
                : `Showing ${pageStart + 1}-${pageEnd} of ${filteredCandidates.length} candidates`}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left">
            <thead className="bg-[#f7fafc] text-xs uppercase tracking-wide text-[#5b7890]">
              <tr>
                <th className="px-5 py-4">Rank</th>
                <th className="px-5 py-4">Candidate</th>
                <th className="px-5 py-4">Job Role</th>
                <th className="px-5 py-4">ATS Score</th>
                <th className="px-5 py-4">Shortlist</th>
                <th className="px-5 py-4">Reason</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pageCandidates.map((candidate, pageIndex) => {
                const result = candidate.result;
                if (!result) return null;

                const originalIndex = candidates.findIndex(
                  (item) => item.id === candidate.id,
                );
                const selected = selectedCandidate?.id === candidate.id;

                return (
                  <Fragment key={candidate.id}>
                    <tr
                      className={`transition ${
                        selected
                          ? 'bg-[#edf6fb]'
                          : 'hover:bg-[#f5f9fb]'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex size-8 items-center justify-center rounded-full bg-[#033c67] text-xs font-bold text-white">
                          {originalIndex + 1}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => onSelectCandidate(candidate.id)}
                          className="cursor-pointer text-left"
                        >
                          <div className="max-w-[260px] break-words font-semibold text-[#033c67] hover:underline">
                            {result.candidateName || candidate.candidateName || 'Not available'}
                          </div>
                          <div className="mt-1 text-xs text-[#5b7890]">
                            {result.email}
                          </div>
                        </button>
                      </td>

                      <td className="max-w-[240px] whitespace-normal break-words px-5 py-4 text-sm leading-5 text-[#5b7890]">
                        {result.jobRole || result.currentRole || 'Role not identified'}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold">
                          {result.atsScore !== null
                            ? `${result.atsScore}%`
                            : '—'}
                        </div>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[#f46902]"
                            style={{ width: `${result.atsScore ?? 0}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          label={result.recommendation}
                          type={
                            result.recommendation === 'Shortlisted'
                              ? 'success'
                              : result.recommendation === 'Not Shortlisted'
                                ? 'danger'
                                : 'neutral'
                          }
                        />
                      </td>

                      <td className="max-w-[280px] whitespace-normal px-5 py-4 text-xs leading-5 text-[#5b7890]">
                        {result.recommendationReason}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => onSelectCandidate(candidate.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold text-[#033c67] transition hover:bg-[#d9ebf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f18a31]"
                        >
                          View Assessment
                          <ChevronRight className="size-4" />
                        </button>
                      </td>
                    </tr>

                    {selected && (
                      <tr id={`candidate-assessment-${candidate.id}`}>
                        <td colSpan={8} className="bg-[#f4f8fb] px-4 py-5 sm:px-6">
                          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <CandidateAssessment
                              jobTitle={jobTitle}
                              candidate={candidate}
                              onGenerateQuestions={onGenerateQuestions}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {pageCandidates.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-[#7b94a7]">
                    No candidates found for the current search/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
            <span className="text-xs text-[#7b94a7]">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#164f75] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#164f75] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Candidate assessment opens directly below the selected candidate row. */}
    </>
  );
}

function CandidateAssessment({
  jobTitle,
  candidate,
  onGenerateQuestions,
}: {
  jobTitle: string;
  candidate: Candidate;
  onGenerateQuestions: (
    candidate: Candidate,
  ) => void;
}) {
  const result = candidate.result!;
  const [assessmentTab, setAssessmentTab] = useState<
    'overview' | 'interview'
  >('overview');

  useEffect(() => {
    setAssessmentTab('overview');
  }, [candidate.id]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">
              Candidate Details
            </div>
            <div className="mt-1 break-words text-base font-bold leading-5 text-[#033c67]">
              {candidate.file.name.replace(/\.[^/.]+$/, '')}
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#f7fafc] p-1">
            <button
              type="button"
              onClick={() => setAssessmentTab('overview')}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                assessmentTab === 'overview'
                  ? 'bg-white text-[#033c67] shadow-sm'
                  : 'text-[#5b7890] hover:text-[#033c67]'
              }`}
            >
              Overview
            </button>

            <button
              type="button"
              onClick={() => setAssessmentTab('interview')}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                assessmentTab === 'interview'
                  ? 'bg-white text-[#033c67] shadow-sm'
                  : 'text-[#5b7890] hover:text-[#033c67]'
              }`}
            >
              <MessageSquare className="size-4" />
              Interview
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-[#f7fafc]">
            <UserRound className="size-5 text-[#5b7890]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">
              Role & Experience
            </div>
            <div className="mt-0.5 break-words text-sm font-semibold leading-5 text-[#033c67]">
              {result.jobRole || result.currentRole || 'Role not identified'} · {result.experience || 'Not available'}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-[#f46902]">
                {result.atsScore ?? '—'}
                {result.atsScore !== null && '%'}
              </div>
              <div className="text-[11px] text-[#7b94a7]">ATS Score</div>
            </div>

            <StatusBadge
              label={result.recommendation}
              type={
                result.recommendation === 'Shortlisted'
                  ? 'success'
                  : result.recommendation === 'Not Shortlisted'
                    ? 'danger'
                    : 'neutral'
              }
            />
          </div>
        </div>
      </div>

      {assessmentTab === 'overview' ? (
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <MiniDetail label="Email" value={result.email} />
            <MiniDetail label="Phone" value={result.phone} />
            <MiniDetail label="Education" value={result.educationDetails} />
          </div>

          <div className="grid items-stretch gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#f7fafc] to-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-white text-[#164f75] shadow-sm ring-1 ring-slate-200">
                  <UserRound className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#033c67]">Candidate Overview</h3>
              </div>
              <ResultSection
                title="Candidate Summary"
                content={result.summary}
              />
              <div className="my-5 border-t border-slate-200" />
              <ResultSection
                title="Recommendation Reason"
                content={result.recommendationReason}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-[#eef6fa] text-[#164f75]">
                  <Target className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#033c67]">Qualifications & Projects</h3>
              </div>
              <div className="space-y-5">
                <ResultList
                  title="Key Matched Skills"
                  items={result.matchedSkills}
                />
                <ResultList
                  title={
                    result.relevantExperience.some((item) => /project|built|developed|created|capstone/i.test(item))
                      ? 'Relevant Experience & Projects'
                      : 'Relevant Experience'
                  }
                  items={result.relevantExperience}
                />
                <ResultList
                  title="Education"
                  items={result.education}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <ResultList title="Strengths" items={result.strengths} />
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
              <ResultList title="Skill Gaps" items={result.skillGaps} />
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
              <ResultList title="Concerns" items={result.concerns} />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="rounded-xl bg-[#f7fafc] p-4 text-xs leading-5 text-[#5b7890]">
            Interview questions are based on the candidate's resume, screening result and the
            <strong className="text-[#164f75]"> {jobTitle}</strong> requirements.
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-[#eef6fa] text-[#033c67]">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Interview Questions</h3>
                  <p className="text-xs text-[#5b7890]">
                    Questions generated from the resume and job requirements.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              {!result.interviewQuestions ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-[#eef6fa]">
                    <MessageSquare className="size-6 text-[#5b7890]" />
                  </div>

                  <div className="text-sm font-semibold">Interview Questions</div>

                  <p className="mt-2 max-w-sm text-xs leading-5 text-[#5b7890]">
                    Generate technical, behavioral and domain-specific questions based on this candidate.
                  </p>

                  <button
                    type="button"
                    onClick={() => onGenerateQuestions(candidate)}
                    disabled={result.interviewLoading}
                    className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#033c67] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {result.interviewLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Generate Interview Questions
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <QuestionGroup
                    title="Technical"
                    questions={result.interviewQuestions.technical}
                  />

                  <QuestionGroup
                    title="Behavioral"
                    questions={result.interviewQuestions.behavioral}
                  />

                  <QuestionGroup
                    title="Domain"
                    questions={result.interviewQuestions.domain}
                  />

                  <button
                    type="button"
                    onClick={() => onGenerateQuestions(candidate)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-[#f5f9fb]"
                  >
                    <Sparkles className="size-4" />
                    Regenerate Questions
                  </button>
                </div>
              )}
            </div>
          </div>

          <InterviewReview />
        </div>
      )}
    </div>
  );
}

function InterviewReview() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleVideoSelect = (file: File | undefined) => {
    setError('');
    if (!file) return;

    const extensionAllowed = /\.(mp4|mov|webm)$/i.test(file.name);
    if (!extensionAllowed) {
      setError('Please upload an MP4, MOV or WEBM interview recording.');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setError('Interview recordings must be 500 MB or smaller.');
      return;
    }

    setVideoFile(file);
  };

  return (
    <section className="col-span-full rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 text-left transition hover:bg-[#f7fafc]"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Upload className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-[#033c67]">
              Interview Review & Recording
            </h2>
            <p className="text-xs text-[#5b7890]">
              Upload the interview recording to review candidate responses.
            </p>
          </div>
        </div>

        {isOpen ? (
          <ChevronUp className="size-5 shrink-0 text-[#5b7890]" />
        ) : (
          <ChevronDown className="size-5 shrink-0 text-[#5b7890]" />
        )}
      </button>

      {isOpen && (
        <div className="p-6">
          <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-xs leading-5 text-[#5b7890]">
            Upload the candidate's interview recording after the interview. The recording will be transcribed and each response can then be compared with the expected answer and evaluation criteria.
          </div>

          <label className="mt-5 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-[#f7fafc]/70 px-6 text-center transition hover:border-violet-300 hover:bg-violet-50/40">
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              className="hidden"
              onChange={(event) =>
                handleVideoSelect(
                  event.target.files?.[0],
                )
              }
            />

            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
              <Upload className="size-5 text-violet-600" />
            </div>

            <div className="text-sm font-semibold text-[#033c67]">
              {videoFile
                ? videoFile.name
                : 'Upload interview recording'}
            </div>

            <div className="mt-1 text-xs text-[#5b7890]">
              {videoFile
                ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB selected`
                : 'MP4, MOV or WEBM · Maximum 500 MB'}
            </div>
          </label>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#7b94a7]">
              Interview analysis will compare transcript answers with the generated expected answers.
            </p>

            <button
              type="button"
              disabled={!videoFile}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#033c67] px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="size-4" />
              Analyze Interview
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CandidateExpanded({
  candidate,
  onSelect,
}: {
  candidate: Candidate;
  onSelect: () => void;
}) {
  const result =
    candidate.result!;

  const skills =
    result.skills.length
      ? result.skills
      : result.matchedSkills;

  return (
    <div className="grid gap-5 lg:grid-cols-4">
      <MiniDetail
        label="Email"
        value={
          result.email
        }
      />

      <MiniDetail
        label="Phone"
        value={
          result.phone
        }
      />

      <MiniDetail
        label="Experience"
        value={
          result.experience
        }
      />

      <MiniDetail
        label="Education"
        value={
          result.educationDetails
        }
      />

      <div className="lg:col-span-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#7b94a7]">
          Skills
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {skills.map(
            (skill) => (
              <span
                key={
                  skill
                }
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#5b7890]"
              >
                {
                  skill
                }
              </span>
            ),
          )}
        </div>
      </div>

      <div className="lg:col-span-4">
        <button
          type="button"
          onClick={
            onSelect
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#033c67] hover:underline"
        >
          View full candidate assessment
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ProcessingItem({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-7 items-center justify-center rounded-full bg-[#eef6fa]">
        {done ? (
          <CheckCircle2 className="size-4" />
        ) : active ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <div className="size-2 rounded-full bg-[#b9d5e6]" />
        )}
      </div>

      <span
        className={
          done || active
            ? 'font-medium'
            : 'text-[#7b94a7]'
        }
      >
        {
          label
        }
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-[#5b7890]">
          {
            label
          }
        </div>

        <div className="text-[#7b94a7]">
          {
            icon
          }
        </div>
      </div>

      <div
        className={`mt-3 whitespace-normal break-words font-bold leading-tight ${
          label === 'Role' ? 'text-xl leading-6' : 'text-2xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  type,
}: {
  label: string;
  type:
    | 'success'
    | 'danger'
    | 'neutral';
}) {
  const classes =
    type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : type === 'danger'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-[#f7fafc] text-[#5b7890]';

  return (
    <span
      className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${classes}`}
    >
      <span className="size-1.5 rounded-full bg-current" />

      {
        label
      }
    </span>
  );
}

function MiniDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const normalizedValue = value?.trim() || '';
  const isEmail = label.toLowerCase() === 'email';
  const isPhone = label.toLowerCase() === 'phone';
  const hasContactValue = normalizedValue && normalizedValue !== 'Not available';
  const phoneHref = normalizedValue.replace(/[^+\d]/g, '');
  const contactHref = isEmail
    ? `mailto:${normalizedValue}`
    : `tel:${phoneHref}`;
  const contactTitle = isEmail ? 'Compose email' : 'Call candidate';

  return (
    <div className="group min-w-0 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b8d1e2] hover:shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b94a7]">
        {isEmail ? <Mail className="size-3.5" aria-hidden="true" /> : null}
        {isPhone ? <Phone className="size-3.5" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 min-w-0 break-words text-sm leading-6 text-[#164f75]">
        {(isEmail || isPhone) && hasContactValue ? (
          <a
            href={contactHref}
            className="inline-flex max-w-full items-center gap-2 rounded-md font-medium text-[#1769aa] transition-colors hover:text-[#033c67] focus:outline-none focus:ring-2 focus:ring-[#9cc7e2] focus:ring-offset-2"
            aria-label={`${contactTitle}: ${normalizedValue}`}
          >
            <span className="group/contact relative inline-flex max-w-full items-center">
              <span className="break-all underline decoration-transparent underline-offset-4 transition group-hover:decoration-current">
                {normalizedValue}
              </span>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#033c67] px-2.5 py-1.5 text-[11px] font-medium normal-case tracking-normal text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/contact:opacity-100">
                {contactTitle}
              </span>
            </span>
          </a>
        ) : (
          normalizedValue || 'Not available'
        )}
      </div>
    </div>
  );
}

function ResultSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">
        {
          title
        }
      </div>

      <p className="text-sm leading-6 text-[#5b7890]">
        {
          content
        }
      </p>
    </div>
  );
}

function ResultList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  const SectionIcon =
    title === 'Strengths' ? CheckCircle2 :
    title === 'Skill Gaps' ? Target :
    title === 'Concerns' ? AlertCircle :
    title === 'Key Matched Skills' ? Sparkles :
    title === 'Relevant Experience' ? BriefcaseBusiness :
    title === 'Education' ? Award : null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#033c67]">
        {SectionIcon ? <SectionIcon className="size-4 text-[#47799a]" aria-hidden="true" /> : null}
        <span>{title}</span>
      </div>

      {items.length ? (
        <div className="space-y-2">
          {items.map(
            (
              item,
              index,
            ) => (
              <div
                key={`${item}-${index}`}
                className="flex gap-2 text-sm leading-6 text-[#5b7890]"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#9bb8ca]" />

                <span>
                  {
                    item
                  }
                </span>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="text-sm text-[#7b94a7]">
          No information detected.
        </div>
      )}
    </div>
  );
}

function QuestionGroup({
  title,
  questions,
}: {
  title: string;
  questions: InterviewQuestion[];
}) {
  const [openQuestions, setOpenQuestions] = useState<Set<number>>(
    () => new Set(),
  );

  const toggleQuestion = (index: number) => {
    setOpenQuestions((current) => {
      const next = new Set(current);

      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }

      return next;
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[#033c67]">{title}</div>
        <div className="rounded-full bg-[#eef6fa] px-2.5 py-1 text-[11px] font-semibold text-[#033c67]">
          {questions.length} questions
        </div>
      </div>

      {questions.length ? (
        <div className="space-y-3">
          {questions.map((item, index) => {
            const isOpen = openQuestions.has(index);

            return (
              <div
                key={`${item.question}-${index}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleQuestion(index)}
                  className="flex w-full cursor-pointer items-center gap-3 bg-[#f7fafc]/70 p-4 text-left transition hover:bg-[#eef6fa]"
                  aria-expanded={isOpen}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#dcecf5] text-xs font-bold text-[#033c67]">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 text-sm font-semibold leading-6 text-[#033c67]">
                    {item.question}
                  </div>

                  {isOpen ? (
                    <ChevronUp className="size-4 shrink-0 text-[#5b7890]" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-[#5b7890]" />
                  )}
                </button>

                {isOpen && (
                  <div className="grid gap-4 border-t border-slate-100 p-4 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                        Expected Answer
                      </div>
                      <div className="text-xs leading-5 text-[#164f75]">
                        {item.expectedAnswer}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                        Evaluation Criteria
                      </div>
                      <div className="text-xs leading-5 text-[#164f75]">
                        {item.evaluationCriteria}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-xs text-[#7b94a7]">
          No questions generated.
        </div>
      )}
    </div>
  );
}
