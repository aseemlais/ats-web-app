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
import * as XLSX from 'xlsx-js-style';

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
      const response = await fetch(
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
      'screening' | 'results'
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

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/session', {
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

        const response = await fetch('/api/files/upload', {
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

          const response =
            await fetch(
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
      const response = await fetch('/api/sharepoint/fetch-resumes', {
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
              result?.candidateName || 'Not available',
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
              <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcwAAABpCAYAAAC3fRNvAAEAAElEQVR42uy9eZycV3nn+z3nvGstvVVradlYwouMsQ3GYrNZbAK4A7gdQmcSaCZBzNwRs6DcCcq9d6Lc+SBmBmUyFzEZRGZihQSFxG22ZnHbkDKbzWIbxzJeZBvJm2RLam3VW23vcpb7x1utxYZAcIjJROfzqU9VV1XX+77nPedZfs/z/B7R7XY5M86MM+PMODPOjDPjbx/yzBScGWfGmXFmnBlnxhmFeWacGWfGmXFmnBlnFOaZcWacGWfGmXFmnFGYZ8aZcWacGWfGmfELNLyfx486wAlwuFEBdYFD4EaFA4ELAIRb+rbIes/13nPxbQEO8TxNi0NgATcKol6ch8BB74zciTM99T9OviNO++zHjx//rdM/+elnYun4/3uNZ8yTOO1iT3nL/cKc8TPv2N9+fs++v+6nXEE/erb+Lmd3yopxFGteiLrtrefnb/5OnqNAnDZ1TogTMua063a97xafPqd75xAgBMLZJYn0o79zYvbcL9waPDN+DpLo55ElawVo6SascBWJa0lnU+VMTTlbVc6F0rlAOBeAyHCyCbIJsgUiBdmySLSUdfuzOsDiuS1bgcFz2QTYihWqYZEtJ2Td9RShwCGcHZPYqnDFsayQTSvUtEWOgkA5W3+2QuVHK1jxjJ3v3Mnj9Da/6AmzJYPjR2zyDES9ECLieTQ2/p6gD7e0lk6ZBSFGHQSnKkwBmXCuvjSb0rkTa/D5VJZOSBxiVODqxf08XZgK7GlK69T764TIDKruhPhZl39P0P8tZ1gYr6MCWwEX9uYvwLnACdkywpu0zxMA5XA4UcyZdCCdQDhxYm6NEBjJqBWiYoWo9tZLUzpa0om6cA6E+ZmVl0WihT+BECinG9KZunIGgR1b2mtWqLpF4oQcdYhAYDPpXL24r+4f/f47M/4BPcxiocumdDSLhQSFogThXFYIfReCSJ2QTYdsOVTDUSglJ56jwHfPzTjuiefeOboQQasntEcLT9j1POXiIU54yVBsHrK/04k692M9BLdkYS9p5n8KVtwpr4Q71QByS6+Dnp2RLc2JOIFanLT2n8/pcohRhwiAUSGoO+dO8X5+lLdXKEuBC5wT2YkL/5k3wE9Y4SfWk8h6xw9/oRaAAOcKhEc4kMVrrKB+ir0ULq0FByHQKgyB53jvReFdOgh697BnXDzDWC3kVHBSajwXXODM+CerMJWVhMZHWlFFuLTng6VOuKYDtCCzwtWtFBjBqBWyYoRcbRGbnCCUjmZo8+3K2udJ2IEVqgGyaVFTFolDFt4NblQg6+BahbwpFP8StFwoy5+s8Jc8jB8HoZ6EfMQJgEoIV3fP8Eh6G7fungEW/2MeJ2Htk3Mli/frz7AtTsyQOA34LITX8yvzXR0Y/dFX5jgp1k8X7+7EOnLg7M947B+BYvyI7zjh6qcYiD0dfSok+7yugVEhRN05espdnHJFIKAucWMnEAloSkddnjBA3bMg2596/pxDYpogkM5M98IzwTONauFsYbQVyFNdnPErzyjMvw/B5xBYITMnyKygbgRYwZiR1Kyg2ntUHIRWUPEsM+CQmJ/dwXT8zBumgGXU9Cne7qhDBqcARjhcvSd2RnvCqY4TCKj/JPv2VAEllpTeqecvRN2hTomKiBP269I7BWS1FPf93y12eaqgdwVELRw4N1qglEvCS2SF01nM/bMNlefb2nc/5t5z2n095dPslO+N/qzeikPU+REGlDt9jT3jn9zS1+rilDX6fGIMBaJD/RlozKgQri6L/Z0VKBaZdK4uWYLyBeY57QXXU5Q9Y825Hz3LRQig7k4Ln5w602fU5xmF+VMMIxyZn+OESB0idEL0oA2Bg40OEThBeOriU47G0sb1nJnxnEY5M/4zi6lnI51/B2UpW1Z4dSvUkjIMTvt1504I80Jx8iPFkvsRyT8nlaUb7X0/OOWzAl5yYswKNX1qbNM964JOzXxxP/LY/9i9THH6vI4KbEU4F56qMF0R9+4lZ/1iqMlniP76T1qIDii8qWJN/Lg49d/hmKP2FGPq2TAioz3jIlha30K47BT4MVPOTD+f8OKz9tyJvSQQziEESNczHB2BdG5cOfDciRjj9M+6BwQWRc9AW0pSXNqbRa5AdnK/mdPSo4SzRdhGnEn/OaMwf9rFLhxW2qoVVHqpGGFRwSLpeWGZtCcsw6Z0rlVYiK7YDFgQAiNk6znZ9j+jzrCouhXeqEVWBK7nxbjshABEUHiA7jQQsPCK3TNU2I9SmifO8rTN2HsdulM8jVMs7SWheiIW5k6DJIsN3vuV3ob9x6w0l8SjW4LJgiI5xVZEL97WU5aAy9yzDIXnWVw5hxC9BJSfJqZYPNVP3kOeBQP+XWfv1JUiTtfO9aU1dVJpysBB6IQIpHNN9xx9tOdqLDkIBGSOUyH2U+HrnjJzLhC4UOICeSKeLTKB/JkFQOE56gmJC1zPKOs9Z725O3Eu8tTQyJlxRmH+LEM6R2BsA2icWi5CEZBAOkalI+g9QpyrYu1GnAtwNkSJ41kQ7EiVqPzsSpvnkMQgJpbwXOFEJrHTAotwrgdlnchhHe0pxDpY5Ckp6PZE4pJ7ltI86VFQZEU+Q0GeEHg9z0ScIuA4DWhzp2XtnmIFjznU9P9ui7WXFBOeNDQ4TVn+AnmVJ2HOn5AI4k5LcQJXJLWMFtcosp/xDLLT0IzTjiRwTuB65VJLWZ7FmpK/WHe7l9DDacbET0rpeS7ztuQlulHlTE3ggl6WfHPJYz1lFnuGqh091bBxiMyd8S7PKMy/q8JUJ+AzOeZwGbi6c3IUJKJn+cqeP1dkP9oULAiXIWTmhMIJ+TMrvdM228+wWQvvl6bETitnkM6csNotEiM8QC5l0o1J3PTStTvxbK/i1DjkaR7Fjyg4OS0WJ8SpAmS0eFvUxakJIe5EhmUoXFGWUPi6/5g9TPdM8yAD2XTPimHKZmH984vhWT7jHP4usOYpqq3+XK5EPBvJODUEsFTKVChM54oEHyFwuFHrJAKX/aKsHLdkZ5/i1fVMkLqFUYTIXC/zXggoZI5In1tZmQsEtgoucHgzVqhpIzwMarz3eSadmVYYwAUSW11CPHqQLWfil2cU5t9pwyohMpyp4WwFIVtO2HErRSY8NS09nyRLR08qlt5DOMBWhZOBcG40dGryxx7jJ9SouedUlSLwvIC0k455wo4GytWdyTYIJVsofzLLsjHpqWkNgRMEzhEKJ06UnKjeFXmBT5qm5NpMlMvlSSEEs3PzW/oHBrZICUmqR5MkWYcQBEGwRylvyhgzrrVeFfhqrxDUlfKWSinq1oIxdtxZM5Fn2ZrBvupWKRxZt0Oe52si35sRwgXdJL00rAxMdtJsLAiCac/z6Ha7o8aYWhiGk1JKjDG/0AvTWTsaBEG9myTjURxOdbudihBQrlR3NluLGwC01quGBoa2giBNM6xxWKPHhRCZ9OTz6mEXmZX8WMGZJMmG/v7+HVpr5ubmtvX3928Kw5DFZmtCel7TC6JpISHP9Xie52sAgiDYK6WcttaOSVlcnxAC5xzOuVHnXGCtrQpHGnhySliLcxZnDdYUHpOSIlNSpNa6Cd/zJq0z5NqOIeW054d1bQxpmq73Av8XwugQQhRVHj2EyvZmNoxinpo5+MGVIyNX4hx5ko6FcTzdnl/cEIXBpDtFTpwqK5ZQG/eTEhyiaJfrdq9odZN1lVrfZKYZn2+lGyqV8GadmpFqFEyn7cWJahxMCqfHkiRZ5/nhg0KIupASY8/4mP87jp8LcYF0II0dk5ysn3PCoa0e0c4MG2dqXhjssQUbUGhFoeCscFUHgXKiEWqRKvszS6vn6GeIzFfhTp0mGzyXr1GYGia7EM87hBfu1jnYsLo1wx+zQlRdkXTQ9NFTvstGpXBBom01iONJAG0sygvIjaHd6W4pVapbWu3utqgU7wp8JpdMBu2YUIKGgLrOmRCO1Imi1kwIsp4jkEpByxPUFxc6W9Nu69JKFEyXQn+/cKYmsRXl+fsT7QJtQSk1LWXhy/u+j3OOdrs9EQTB5C/ywpSuuFgL+GFAJ8nG5xebG8rVyq3lUrgNIM3MRNpNLvGkmOm0WlevWDY87imJ1YbM5M+rsBenZEr+KE/fGDMahmHdOUeWZaNBENS1sXS7yaao0rdtttWdDuLS3jjiDgktB4GFqoBUQivVXHLSeDxZ9ytE8blO9EgceNsEjqTT3iCxrXIUTioFNs/G8zy7UErZBJHm2gw7RKq8YK/y/WkpJbl+/gwqJ8AIxgCUZdpDIKxjqRhLC5BBQCfPNjkpwlLgb3UO8kSvL4feTglkWVZkVp+iOE9Vkn+bwpTOjObt+Q1RXLotFdH2VEYbiQQCUoBOh6trJSaSVmd9SE4UejNIWXfGjiaZqSFVQ0hVP6NezniYP9UwwicVKpCClpLUFeBJ8HrhB2dyhJQ9LqtiE1ghenG/wib3ZYpwz2HTPgelKZwbxeXjKnRh4SXna7CmhrAVnK160t9n0AhU5lCBFVRPJCgUSQCBwNSczlF+YalrY8hyvT4qVXYJD6r98ab5Djv3HVm8QVtAeuTGAILI9yj5NLAaY13NIRFKoTy/4XlqxlMcGihTiftLd1b7S5sloIBOqz1utR6JpagjJVHgY60lSZIJACnlpJQSpVTjF9qKA/IsWR/FpZ0OyexCe2t1oLx5KK61ji2aD+99/PBHjDEM9vWxcrj6u7HHdm3cSJJmY75w01L0BOTzeP5LdbLulEL7U2HXIAjqWmusgyCM6tZa8lxPBFG0V/mC6mBparbLpn1PNT/gnCOKInpeNcYY4jg+XchLSXFvaSlBY1nV25w51vtC7Iz7KjsUYHJDlnbHPCGyMIx2FeiPyDzPm8m1qWmTr3HOTgRhOPmc2T+eo3MphMuEoy4K2PgEx5YVCivl2NHGwgeHl/d/aCFx648eazoshF6wN4i9nZ2W21zy1VaB/qkU5I+Ar+rC869Rpep2X3gklmDfjP7IbLNDuRSz9mz/93MYC+LSTt1ZWO+sC4Qnwbi6dW69FPKMsjzjYf70w6Iwwh9XginlQOpkVOjOJTLvXiltthZnavjeoSVvDiGboBoI1Sie9Qh0roYCivrRB7HBz29aZIYVGZ53CJesBV1IQG3A+hAN3Oq8vhu7It6Zy2C9cdSUo+GT7wxcOqawVaFkM9e2KqQ3mWgzLlTQyqxYWyoH2xe6bLvplls/8P177+e+3Y+QGij3DYD0SNIMq1NClyOcRlsKigMhUZ6P7wcoJVmxrMZll17Mq1/+Ms495+z9A1V/R+SzSznqVhu6rcXNlXJpqxCCPM9HnSviflLK6SAI0Fr/4i5K5/CFQHoeqZXMNBbuGR4Z/NDeg62bdt7wab531900m01eesmLGf2lq3jn2OuvszlVkSap53LiMJxKjeFnpZZ77grTIZwdPZGeckpm5ZLCVEqhtSbL9Xo/CHdaa8eU500HgUejbbb9yadv+sB9Dz/Go48+ijGGUqmElPLEfTPGLEGxJxSmUqp4SEF/pczLLr2Y1175Ki48d3Wjr+Tf6GP3RcptizyJzROcySeUUg3p+3UcpEkykWtTk0o1pOdPPl8K81RqPGFBOIFEFZXZyiMXTMiA5qMH5m766PY/5lu3fxvfC7ns0st4z7t/ize+9oJfUzlTnsueBcEuwbN/mwIVOEyWbIz7BrcfmEvrn//qt6655bbv8+i+A8ShzxuufAX/dv07WTsSC5nn6G5zUxxH27Q24xo1Jb0Aa/QZ7XLGw/wp1Y3oTniqcZUi+T1lswvJ5ioLB59k9unHsIuzxFg8Z0eUdYDCoTD4WHys8BBoPNoofjys9rct+Odaj5fKOFj0hgPnxWtl3iaSlsiTdDKNLA8xvObF1/S98NI7ZS+vaAk27Z1XgHABUk5bk24WiHGcCz3fn8pzt9oC997/8Af++/+8nmPzbRYTgwpLuCNNupkBIQl9RSg0wmqckPSYhkBKEBIpQD55mK9++24i9UlevPa81W+95o0fvuaXruLc1X2/GwZqN8rHGIO1dszzvOkoikiShCRJNniet+MX3cOUwrE4P78lGhjesmJk8OXHEm7b/qd/wae/ME3uBCZNeeLAUR7Z+zjDteGb3nTFi68r+dG06zqw+qemv/+HuBbn3KgQJ+tElzzFnlfYdM6NGmtrceCR5YZv3v6dD3zsT/6c2bRQiGEY4twsWZIglKJSqWCtxTl34lkIccLLlELSbnX47g/2sGPyC5x71srab/zq294/8c/e+oUoYNvR+c71pUDe7nIXiDxfHVhGfT+oSz+cVEKP2oLn+XmdM7BjOFsVqIagqFF1ouBKdpJgtsOmP/qff0r99jvIjUcclPj6nT/g0GzC8pEtn3/p6vIv9/7vWVDsT8x/QBCW+7ZrYNfuH17zib/8LI8caBBVB0mOzPLkvs+xariff/Nb79hSC/0tadtW81xPWAfS97HuR5eTnRlnFObf4gDqVUrka/AB35G3jnHo8d2Y+SMsq0TYbqdHj6qw+GgRokWAwUdgCFwX5X42hbkEx/6syzWTMd1wnhwP15mn5AtCJWgstIiHz6Z/xVng9IgQdtSxJFzcKVmsLkDn650xtSBUUwY75nuSrnE0E7Z9/bbvsO/gEWTUR2lgCBlW6BqH8CzS8/HDAJO2TsvKdUJiHdge7iuFQ5VLOGl58PFD3P3fPsYnPnUj737nP/vI+nf+6v5z+itrfKDdbmftdnuz53lbex5Iw/M8siz7BV6WjrTb2bKU+Whh9ODR9lX37t6DDasM1ZZTLpc5fGA/e548wN/c9yBvvvLFmbXgjB53Tq/CC7c//5mKp2TznuK9OARa6/G4VJ7yEVNSeWhr1wMcPXrsji9+6Sa6VkJYIgpDyuUyQgiSJMFai/R9TJ4Xe8CdJNIwFGT1CEVYG8IaQzfv8uC+w+z96P9i+qu3vuNf/da73K/+8quuUzAtbYTO89Esz2va6jHf96alF9Td854Q5jiRpWpNDRgVvT3gYNRJgkcefeqqr37jNo7Nt+irLcf4JVq6y91/8wC7dv+Ql567jlMQ2Wd5mD/p6AvNziYXVsKv334HDz++H2/gLOL+YfACurOH+eL0V3j76NUfHDpnaIuUquF53mSm7ZhDoI0ZU4LpM+rljML86Za7CyctKxrGZB8vKyDsv9aqQ+/PxHIqtT5eeMEaorA4tBYeuQzIZEQmQnJZlISFVuNZ87eEGX5+WbKip8aVSRBpkzDyoNPigYf3YGJJbXgA0KsEttJL3guccKFzpxC2OxdKAcJTuFRXe7WXWZaz9qE9j1IZqGG9Eik+3SRHCx8ZVTB4tNIcJUsILA6JFRLnZFFislTbpyRZc54ulr7qIOWwxJHFJp+YnOJb3/zG6v/2H/6te/nF54s4juvdbveKJEnG/CKhoyXEL37KexiGD4axN9XRjsVUvOvpQ0d5+nAD55c5dmSW4+UUnI/LHY/vO4CGkayVbKwqDnl+sDezz+/5nyBSP60m8GTxvZAqs9ZijB31fHmijKTTTa7Y89jjRNUBujogyTKSvI3wfYSQ2NxAu40ql39s9YJF4YwPzQRRqbJy+SpmD+3jO9/+Pp1uwvz8/E3jY6M3DpWZ8EO/blHjeZ6tUUIhhEDnesJXcvL59JAKu7OoqXTWVZwgc4gl7pPwqUOHSQz0LxtBC5+OFgyuOJu5Y3M8eeAIFiqnwq8/jWd56tH7BqrbujDeWOxQHlxGVFtJ49gsCEtcHeCpQ4fppFmRCy1kU/g+6BRtzCl1rWfGGYX504GyeMqvd1O5IZfs8HV6ic4sEklt2VlEL7kCSn0gPDyp8ETQimX4INLfh5RNnMgwLsCe2kFBpD1NWQggIZvPtN5P/H2SpyrAFTVSJwjST/zfUkKPHgFbLX5HpAhvBqdHSOffhUvAZeAZmD1M9ORTHG8tkC/O4i+z1R7zTCZQmXSmKbHTDjFuUQ3lyaayIkUI8jxbKzONlF4ziNjbSXPm2ylBtQp+2PMYIVQghCUzOV5voxss0slCCAqBkEUlq9UpQbWCwpHoDJ0DqkyaStr7j/Mf/vNH+f3f+dfuDa97uagODW/BOHAarfVIt9MeU0pNu78F0D4Z/1vivIWCXYWlpiHPFDL1002OU7s3LJHEnygWqJ9OLn9KIbhzSOwYEtJua6vx2NVXiW+sDQ28p9VcIBpahQxLZFlGbWiQtmnTabfwYMZKmp4Qmc2ytcIL639bibs43cJ7xvuux/HbE9jFuqv/aL5etyTcT6NREyytu2K9nX6tgsD3prXWFOUIQb1I7gIvKjXw49rs0Q6yr0rc34fRGXmWogREcYxXKdPtdnrboFc2ISSnVn36cUwiFS5LmDk2RxhWqKxeyxMzs3z4o3/M+WvXvmvt6rOuHKkFa5CyR48nkFJgERUtvPFiJ9uWcK4uTxBzwFKf2NPCHmLp/aW2fQWfrRWnc/wukZZL7OjJjj8is8hpK4rQgxMSAZMCPSGxFYWpCWeazjmMi+pGUDPGkhuBcB4qKJGmGm0ypCfJsy5S0CoYeyzC6XHnXCgQqTilVd/S4+Qri3R2zAo53Wq7DV45nFlcbNKencOVlwOCqFLFtGcplat4fkiWgzG9OkyTrxGSfVEQTi3FME/WXYvTdgc/psfmEgWgdK7Hh73EVX26E3AyB7u4D+IZ1GZOnGqgnV4ZfPr/n/6LJ9a/O9lqbomb+Jlx+NPW/7N6BJ9Ol3Fi7btn8e6e4OJ2QvBMucCz2NSeffbP7EXMz7FrzM+pDtPi8oxS7O1ITT7mK1Orei285DCYAJwCN3wnonJzYaLJpnbeIWsBoVdJ5wLPiAwn0pP3puiXWRSpy8wJUU/SbKMfRHu9IKh303TMWldVnj+pnZ1QYdAAi09WF84VCQPCIxdqwkFgkqQWke0qhaaGzdbS6V7hvGiXCfs2JVk+XvErN2OSdehkHZ6pYRcvyYWPkhlKWFCqIaRqCOdqPmZfiJ6Uzo5aEUzlzqGNRUh/1HTT8XK5siW3BuV5U3nGhPQjgvIAQXmA2dl50Jog9pDNeXR7gVCCH5fJcovRBiEVoR+glCriVkZTKpVIOhkqiBAyIMNDVgaxQYnm8RnuO9jhPb/zX7hx5w73ikuWX2cyUYuUt7NaKu/UeTKGM2NCiOx0ztGCr9UJ8MNwqt3pbDA6XxN63kygVANragqQfrAXB2TZWqytFmtTrsUBSjXww0mUR5Z0x7K0c7WvIAz9fXjeIWNMLc3tJhlE29I03xCXKjuKOrpkLFByWjk7qrBVsu4V0tlqteRt7gK6M89g2aeTLhL4Mb5ySN3BdBbxXY4HdelJsHZC4gIhBN1cjwdhOCWEIE2zMSnltFIKYwx5nq0Pw3CnpyRa55hcT0gpUiWL+uEsaY3F1co0UjWydvcK7bgqiku3I2S90+1urFSr29Nud1zn6aWBrxq+7x0CW8XoVThbydNknReEu/GiXdqKzCEQ0gMnsKYgwRDWjVbKpa15rsfCUml3CmMtI2taxUDGUP8yjj/1JChBoBzZ4iwqDkhNRuSr4rytxSmFH0QIz8dYsAaypE253I+JPJJ2hvVDjAhwQqFzwb/b9Pt89lM7Vg/2B5tCxe7A9/Z2262NURhsD4JgR9PJ7ZlmbSjE7mog677LMd1kg9P5Gt9TDaG8mjW2YgVIpRrO2SrO1KQE4Qd7s3ay2fPjrU76pMaRG9aDI5DsDCTYpH2NF6gGAsj0SC78tV5Y3Zbij3az/Iq+amlL1u02Y5Ka0u1rCFUDla017SbxwLLN0tkbgrDEYiYIPA/PkwidUpIpsUjxoW6ydMzlybow8g7hqQZ5vsYZFzoZkTpZD+II3eNNmT9+ZPuK5YMb6SxcQVjKcmNnJEz7whHGIdJkBHGAzVJCzyNJ2uTaoo2bsMbUcJZA2Kq12VrSfGMYeIesE1kn0yMof6ab5lcMDg5snpub39pfLW/Ouu0NlVK0A2vpdDpbkLIZlSrbHJKk3V5f9rwZ8mwtwgX43gyeSLXJ1xhrq06AsbYaBuGDwslxnelVUqiGF5Um0Zak09nox/5e11N4wFJctW6sHaVnYIVhWM+zlDzLJgQuCAN/ZxD45N3O+rzbGisNDuwwSXpJJ8neUR0Yel9uHJ0kXV+t9u1caLY2ViqV7VmajPpK1puLC1trtaHNedIZd9aFSnmTnW6yKSqVt1kn8FQAztFpLm6qDlS3oTNwZtSm3SvSLF8jg2htWK5uzyy0uskmCrQji0J/e+grcI6k3RoX2GoUhTvTJNkglTfjkNPGOYT0UEGAdZBn2bgnmPp5KM2fk8J0vYopgRVUwVY9uviug0SDUCArNydyYGvBjANGSJywo4pkn8BWjVANUXQL6Vmycqk/AA5BECmUCLdbIcktODyEpKmUhxBMdrXbVPDAWqQzFYtqaalGEsc6B0EcR3fajCZZ8xKcXoVQDafC3bmMyLxoTUexTRJO4qKJSOVrkNGHTY+SYKko3Z20fFLlzJikaD5bXLlBClvHubGineXJhlNOCNrdjJZtMrhyhFe87KWsGiyxcHg/ft6kWoropDkaiXUCIRWWoras3WzS7XY5PDPD/OwMfqmfoZHVWCVJ5hcgctC3jFbrCKVSyP/zoT/kzz/+kZtGBsTve75gcba5KQ69fbIXaxXI0ZO2qAuKdmUwNz+3va+/b6MnykgcSdJdb7WpWWNqtp2sq8Sl20A1lBduxw8AiUuz0TzTa63WG5xyjbhSmQpK8TRobLe1WXfa10jf3x9F0a7cgZAiy/J8XEk55fv+tOgV2CslUkrVjaKbbMqtwEjGpOcRRRHtjkanCVmWE1ZLhGGE54cYIM3shJSyqfx4sp3q9UIFjW6mx8MgmJLKn1ZS4Aceup2PlUulndYYTK5x1o4ppRpKyjo4rDXr41JlOk+ytUKqRlCublYW2mk+LqQYi/sGt883WxsC398R95WnpHC4rDuWddNLpXCBH3gzfv/ADrRe1U2ytVZ4h5ByVFhb95RHFIfoJMVhEU4uraXAQlULDysUWDh+8BArVp3Fyy+7mOWDFRaOz6C7iwxUYvK0g3OmYMIRCoOgk+QstNq0OinHZheY2bcXwjIrL7iIxvwi3fk5+pbVaHc7HFto89kv3MS//s1f33DWkHehlQIZ+HgSmt3OJqIKpRK3e1YeSjrdjVonVELvkCjFO3Cg252NSO+Q8oMp4SmM1SRJZ5PTpuaZbK0fRLsy7cZSrWsyiJpRzE4B6MTSbM1t6R+obLLzx+6QzlYZGNzuE+xYaLY2aVUKK/3hllbCpkAGe6U0+8Dfh8vXkJkaInxQO5BeQKuT4/XVcDLA2ZzA91k4voAURfgyiivTMgymXZZMZIvN8TzP10gv2uUJF+TWTbQX2mubnWT87JHapYO1ZRt1mmByU8uT5ju8/pXv0zDmhEIqxRL+nWuN0RlxEKDCGD8Sk91usMnkjtyI1A/D3UJAmibrcq1HZBDfGZXK05ltrTVAHMd3FolcwY5Ou71ZCiiVSluskHSTdNxJLytX+3eSabAy0M4EzpJZ7QLtZFN63ozne5OyiPGABSfdRJJma1WmN0VBvDuqVrfbvDuGOOnB9/yOUSFF3Tox5nn+dLubrk/T9NLaYP8mcBw/enR7FAZ749A7FJXiO8jz1SoId1ej8jbtJJm1o/gxbc14qVrZboB2N7tmeLCvPjg4tDlLumNZkqyrVCqbs0yPh3G8zQtCWu10fHZ+fmygr399qdK/bbExt9VmnQur5fgOVa1sicsCkxvmm+0NIoizcl9l21IOSrejNy22WmsCxd5yFG73JRijEVI1pCxQCWEcudYTmbGBkCqTUjVxP3sD8ecl6ee5hfyXIIUCBnMnqeToFVmQJxrl7KjAgslX+9iqlCLDsBEh0gDRABcom7yjaAKtGsaFD3qudLMRqhYLOSmEHsNkF4Kp4fv7ECJNc71BW7kK9fPl1ZRSEpRKxHGMc45zzz2XN0y8g4tW8fuLi7zL99knBJnwSIUiE4I0Tbm02+GKpNPlscceY+/jT3DD577Ew/ffQ/iCCxhYeRbzbQ0uo1yKWWge52/ueZwdn/wL/st/WL+vkzEexOVtEt3LQnSBPMUK7WnzFAH9fQMb0zQfX0jaV1rrKmEY7y5X+7cswZwa0IZRYFRK6ggwIgpEzF5PUjea0cON9vUS3aoNVjepcv9W225uzHI9Evuy7pwj8P2daZZvEMobC4Ng2mSmIFT3o6k0zem4MAs8b7TruOLYYkoztaRWUekfQqQZmbOkeBivRAYbwr5oB0CnYwn7450O0BqchCw3E0mrua420L/JWlMVUuByi7Z6XClvyvN8EAUDkkHt9OKQjHTUOGq+CDGKsa4MrlS+bAhB5vdV9gPMZ2yS0Ay8yg7VV5mmaF1HtzW/wRo9ovz4zrhUmTYGkm4ybnQaCudNKizO2UrPsMwKikVOZKdGcUiiDf2VCJO2uej8ixl7/3UMx3xoYZH1kc8uKWhKj6ZUNK2g2k25otlmXbOj+d737+Gvv3E73/3+Ltrzx8kTDVGI7LHQZMZx42enePPrr1g7MvRCrGM08Ly6wIBOQy/3ZqTzmgrXiAK10w9ihIOsk42nmb6w3D+4NbOQwJi1VK3zKqIUNQLFNgGkGvyoSB23MNroMJlndk05kLcO1mpbdKc57lUGduD0KpLsQovdVC6VtmXCJ+m6DZ4vZqRQ0+0uY5Eq3eZJ0E62ZFSuJ7BelgbBj1FBRNpNyU1GUI3Ajwn6arQs2zLDHiWChh8Gk37cN7kk7LSFkoQYsNKrOqCdmo1pkl8yNLDifQqBUYwuGNa3jaSbOegkEJTxojKhCGk0nubYQofsBaX1lPrIAtAi2mc8sMZVSuVoq00649r1AFhLmHbTiVIUTHZazYlKHEz65fLWLMsmFjvJJj8qbQvL1alEM/b08eZtlXJ1WnpeM4zYcUImwljqGMkFE9ZRMWk27Auxr1yKJ8NSAcvmnWQ0b7U2BJG3v1CY4JytihN0gQUhSGbsRFyKduKF63VPxqpSXyOuxNvzNB0NotK2hfm5LdrZYT/yalZ5FT9kv4JGV3PFsbl064rB8LddUAoSCy7LR4WFSl91s8nNqB+Xp5rtdKJr8iAshTtLXlhVYU+FheXdA7XBzQBZtzu62G5dI8PSofJA/zYNo42EySQx64YG1Lag5O2NSpVt9OgRE12Qe4SBv1tbUZRReQIn7KSxdlwIMt+T0zbX/3gg2b9PpflsTBskFiUsMhB1dLYR074G5QKkrZKnl+JsRYXxneACZHop2AC8hpLh7rLUtyK8Q+R6My5fjUovQYkMqRrSZBf6Lr01jMs7Cqzm53h9vUSEQwcOcOiB+/jhD+6iot7LRb/ycqSg2R+zEwsGasU10yqH3CpCMjcYBy8cubT6y1dd2nj9la+66c9u+By3fvcejh17GhlUUF6IChStdpdz1r6Iv/rM53jLG193w2suP+/dvh8gtMDpJbTbBT1rJCviwyJzTtSF8NHWrArjvgfDMNhpgbZj49yifX9uWdOYWwyarS7NVpcsN0jlEcclBgYGGOwLWTHIxyvD5ZslTB+e7Uyhu6xYNjgeCphfmNschtGuIPTrSZKGCFkkmxg75nn+FL6P832yhLUGaqngUhf1UV22irmZBvOdFJAI6xAqpmU8Hj/G9cuqTESwK8vl2mNPzl+7bNnAzTrNR1bU/JfH5WAyz8M10lOUy6VJTGGBSilbDkGqHcaZUeOooUIW2m6dH4f7lKTRdmxJcy7tGHnVkcMLtaNHj9GYnUUKQaVSZuWK5axcNry9UuZmz+OQBzOlysBWtBnVllond2MSMe35wZTNkvGs29lYjrx9zpmacHK0F4caPTVS42yOpwL2Pfkoe+++nQOPPsCqwffztqsvPOQ79lUCpoUrGH6EI1WCqXLIWC0kMENe7UVnv7r6pqte/ZE//sQN3DA1DV3N4AteyML8PFG5SiwiDjz9GHfv+gHrLn3hJs+6GSMs0hrKcbBHKjvVTRY3IcQaL4qxFlrdbAMyaMVD1a2ZgHbO5k7GVe2UaxZbLY41jjM/P/fJrNtl1fJhhBNElX6WrVxObZCPhiW524NDixkbbeaqtUq4FSsmkjRZ5xTEFR+JpL3QXmNSUZNSrhNOplGltDkHFhM2a8u1synv37N/BhGU0KaXOm4hNwKv1M9TR+bJJGtbXa7NMtYqSUM4MpyhGqupasTGdtduCjy5txSFt3VStyFHranU+m9OYGK2xQdURGOuyzXx4DL6Rl7AYgqg0LlB24zzLngRzczQyPg9ockSwbrcsAYB0oqmVKoVlapTJs3HWp1kvRAilYKmFICzlW6SbFBKNYKwNFmJPRa72Ybjs+3xUrV8e/+y6s4c1rQMY/v3JdcfPXqEdruNtZo4DIjDgLNGljPUX9k9XGVLCqSJ26iT7kig5N64VN5hXQ7Ojp/o7ONsVQjVEL0s6rmF9vuXLRuYlIFoHphN9hmta0NDlW05jM4nZsOxucUPDw8PfyjwxLSBsVbGtQefbr1r39MHmJ2do7+vyksvefFfS5Nnccm7M46iyazbGc1zPdZqd6/I2/k1fUMDmzLDRCaYSAWXLi5S76two4uCoKUZW1zovCuKwl3V5fEmDaP7G7r5+FMHK5mxdNsdpOD6KAwYHhzg7FXLbh+qsE36clrEfVnu7Gpn9EZhTRp4aodSCinllHMOzM+v084vrsI80dzkVIXpes1cLSbvbJHW1PJjB96/cHgfJZERSw1ZG4HFSu8K4QzCpb0sFVXTIrqqqypXaeFjtKEcKnzTQQqB8UqXzOYeWWXkA8tWX/Ru6cWTP0+VWa1WyYSg0tdHB8vT+/bxqU99itetu/jDF54d/5qnmXI6wxi3wViGtRCrpBBNJVxDCpqBp3a2m8mWl79opbjoP23c/Pv/5U8+/Bef+TKYnPLgcjpJjuwfQEtFR1v+6H9dz8v/9L9d4jK3vqTUTofIBLZ6cmYLRekoNlSnq9dLr9QUPlnLsmXmePrBe+5/mG/feQ8P7XmcI8fnmG91abY6OG1AKYKewhyqxLz28kvef9mLz3//la9cx7lnld7rUZpZTNwmTEIQlR80RleUEPSEyHSe51gnAi+IWEyYuO+JmRu+8q3v8b2772W2ndJxiqeePATlfqK+QdI0I1ASm4bc89Bj/PvNf0ircfQqZbOrotCnVC4zXBu4dsVQP9eO/pK78vJzRaWvvDXPc1yejvlSZEqpukDUE21HM2PW4oV4kTjkFKFFVI4nfPDxJ2Zrd9z1fe64626eeHIfi602uTY0W22UUnieRxAEDA70BxeuveAdr33Na3j5ZS/m5RcNVSJP7TJQa7fdNcrpq6uRtymO4ymbFjWGElsVmJp0csxQKD8niqblYeQj/RiTWEorh3l6/+P8yR//Ea++9GObR2r+GpczSgEP1oy1NSPkBqX8hpBepqRoOAjPH+bXPvCv3/35I0ePcPMt3yy66LTb+MuXIV1KaXCY2793F+/+tbe/a7iiPmTznCzpbu7rL29F6DFfiCxL8jVJW2+1Ktql4r79KqSewPhDT7Y//8APH+W7d/0N9+9+mAMzM7Q6bYy1+Eogsi6+59E/tIw1557HxRdf/IHLLr2EdZe+iPNWyt8Og74HF9rd9VLrWqnSNymEyDqt5gYnvZnB/spmRK9MBmg6Nn7t9vs/Vr/tDp6YaXB0IUGrCKMdSI1frWJNTqpznBfz9e/dww9+495rhckI4xJRXKplWUYl8rn6inXvf8sbXvP+C87u+7Vus3NFuRRtttpsKpX92w7O8/nPT38tuP/hPTyyZw99tRXccd8jIEIIqxDGYDLIDY//8FE+/JH/TsVnbd5to/zgktwK/LjCYDng1998xTW/cs1Vv1uO/G3t+e72/kp5o8SSJV3KpXhHkiTrlRdOtVM93s2zK+O+0h39cfAX8wkbHnh45qpP3/JN9h06zhNPPEHj+DGyJEXgCJUkUJLAgwvPPeeSV6176eevfMXLePnLLrmzNlD6AwnTi610SzmQW6STLedMKHBBL4EoWFKYw8sGPvTIvob7wk23cMed3yc3mlese/kHf/Xt1/GSC1e8Ly2VLrUe1ZlFjt9S/2btrl33c9c9P2D/4/sgDPEkLB/q59yzlwf/8t2/fsOvjV3dzLVbI6RtDA4Nb04Q5DD+xa9+54YvfvkW5psdVq16AW99y1uuedubL/ntZsp4ZVnp5lRzyVe/+4irf/M2frD7EZ44MMPxxiyR7yFwVMolViwb5uxVK6+65KILr3rTL13Fq156znslsulcEJrU1VKdbwyU2etJUXdWk2k97vv+1D8ZhelOVZonn0cFFN3NnRmXLl9D1rn66NN7eOL+u4hNk6rKkVmLQAmMc0gMvk2RGIxQ5CKiK8vkIsAaQzn0sEmzgOGCKk1RpvSCi1k22H+DGjxn0qJ+bte4MDsLIsQbqlEqlegmAfv376fRaCDPPrulnMaThtDzdiBUEbR3tmdFGAJPIUOxpXH46GTUP7zrd/7Nv8ysc8Fffe4mTDdC+GXivn4OHZ5h+fAKdj34MN+7+5Hfu+aKi0SeWTxEXcCEcEstwWiB7MXD1Ghq3aWlgNsOz9nrP/OFm0Y+/cVp9jx5EKMiVFQBPyK3AcQhqGIZZdZwdDFhvp3ww099mtAXvOLyl/DOX3v7J695wysby6vid62Oq3merZFONKHoWuh5ijzXo0iZoeDJJw/f8Dubt/DwvsMkCy3E4DADK1YRLltJqh1JJwHrSHMNFmabCfc98gRZexFfWOIoYH7xUXS3TTmUHJo5SBy+173i4nNElutRm6WXOimbfhBghVe3yIpXCg9Jj5aGkaZh/O4Hj19749SXmZ6eJk0ShleuIoxKZMrR7LapLjsbz/OQqqhp3X+syf6n7uTWb99DpRzwzuve9HtXX/lyrn79pV8ol0Xdx9ufdOxGZ9N9sRIZzlYEpoaTzSJ7k2lg/ZKHuXj8GJT6ECZl1VAfqWnz2KM/ZHFhdvULaiuQiroSIHwPrOshFhZrU5wVdNLuhjyP15w9EL57YvxXbrjtjnvI0y6UynTSjFSn9PUN8sBDP+TY7Ny6kYHatDMKa0wNo8fQ7WsKZEM2w1JlM0FMBnznvgPuK9/4Dp/50s3MtxOS3OJFMXGpSlwbwBiL0SleSROFIany+P6De/jOt+8i6q/yhte+mje+5pUfe8dbX797MI63RzLeJnGk3fYYUmRKgk47zM43J4VfyqLB6q5bv/Pgxz7+5zfy/Qf2kCcOKgNFdrkXgDFFZ1rnMNYRxhUOzhxj1i+Uk1Mh0g/QCwvQmuf+B3dz953fY+f2/7Iq9NXuUAlk5G9bSNn+F5OfC/7oEzfSbXWJBioMpg6CkLBvGWlOQRySuyJJr1bjyacPojuL4CxOBaRGgIqoxIrHHtyFMNlHfuNXR7d5fjgjpcSkKe3W4vXDw8PvC+LSTic8HCJUHo2u48p9B9of+PwXv8wNX/wKRzOF1kUpWVQZZrAWYXNN2m7TTjvEpSr3Pryf733/Xnb2f4YrX73uimvf+uabXnvlq3jBUPhundtxT9gp4dwYTo/gXCiQTRAgJYfnsuv/8KPb+fb370FbQa4Nux56nF0P7WXLf/x/r7/0gv4/ePhAcsOf/+WN3PzXX2O2laJRBCtXc9bIKhrHDnNscZbmI48zddNXeNH5L7zpkvNfcJ1NW9VOmtEk3P6pz9z0/hs+M8VjTx4gjKvcdf+j/OCRJ0jF73zs2jet/fhjR7jhi1+8iRs/+1n2HTzM0MpVeH3L8HJJHBX31inJwUaT3Y/u46+/9T2+ecc9vP7KV33yff9iIhvu50NRJHZZHVRMltY8AZ4SOO1CcXoX2P/NPcwlzlnACkadKOI7wjEmhJvGmZqsRLuw+ZqSylerbB7fLBCpDJkuUPKLIn+FJrAJyhU0abkISGQZLTy01lSFT96ZJ9MaZweRlOjLa0RhCi7bkBP/3Bhxyn19EPeD8kjaTcIwpFJS+L5PkrHOdJtrI2Fq0g8fRHpTQhaZYliDxI4dPfjU1uVnnXXpYCWeaiWtdS8Y7gt/4+3Xuu9//24efvoYXq1CZgE/omsEgV/iy1+5lTdecdE4TuDBVFEustQ/UNadUFg8jBC1uMId9e/88KY/vv4TfO/ue7FBiYHl55Dhs9jsIFQEUiA8H9/3wFmyNAGdkRlD36pzKAeKu3fv5bt3buaX33x17f/+9//2k5evHXpvq8NYJfCn84LeLfA9RZrpih/4Uwa476FHeGz/QZxXpnJ2USze6iTkFsgNKJ+wf4B0cRGMxQlJZiGs9JN328y2Ula+4DzmGkfQ3QX+5r4H2f3ID1l38TmUSnFdlIJ6Z35uC0LUrZA45YXKo5HB2h/8cPZjt3//Xj7yx5+g00lB+ZSHh2illuPHD0MUsfysc1hcbNJsJWDBi2PKwyMgZFGhYlM+8Wd/xX0PPsThxjve8dY3X/mOVVXei5JkqV7jO5P6sqjVBVsViOzU+gwnBGFtGBXEkHWYby5S8hRD/TUQYByknfZ4ICy+cKGUIhW2KJuQBbFF2N8X7ViYb25BhzOvetl5ey++8IK19z12gLBUJU0SnBOkuSZvdTg4c4RLzq0VcfXA3+fybK3uJuuEUg0R9e8kiDnSYvKbd933rk999ia+9q3vMnz2akQc4PkWoRSJAZPlRRccZ/E8j+ZCB5SHH1YIRypkSZdvfO9u7rr7bg4cOnDJ6Otfff0VLzs3853YmVtqpTDcKXG0ms1tq1YOT+RWkUrGHnjoh9x5725M0Ad9JeLBGlmWYvMcKSw6baPzHC8oYrReqYwUOcIJjIxQcZmobzk2adLuHOPO79/NXXd8/2NveNVLRd5ZXC/D8s752c6GW7/2TbqthMpZa+g0jzM3Pw9dSxqm0M2g0gdRgPJLSN0m7WbEUYQfhGjhI5xPogUdk/LYo0/w1a99i7f88uj2OAjvTNPuuHI2w9mq1hqNpJWmW+NKdKeA9Eu33PWB//bft/P4I3uIz1qNKA1SZC85km5CkmgwFik8/KifuVaKH/UzUK6SJE2+cvtdPLL/aQ43u7znN978gaqUXxDWH5POZgqRnagPLziWgyON+dW7dj/CXMfQN7QMH8Hi0SPc+/BjPHVsgfMv6L/y01/+a75U/xZzrRyCKtIP0RaefPIgfbUBwiqY9iy3fvN23vjaV3L5Raunfb9KK83Hw5AHp792G/c//Ch9wyNUaitJZxd47OAxvnfvbl544dr3//ePfoybb/oypf5+Rl54IYcbc+j54/SvWAEmZ+74MVyWUR4cZOWaC8mzlIefPMQDj/wVuRPBNVe95sOvXXfOb4ce23UuJ5wzeBLwZNP+U4RkT/E4AwdhQRLgQLiQ1sJ7CPI10ub4QlP2HRXPQZ4RComRHso5QgyeyxGAERYfMHggNVUVYLwORoINU2TmCLMGZAsQ6VU/T6KYdqtFHFZRXkFpplB0u1201kQBu0IX1z2XTTghMm3NmO6xryhc4AQsX7Zsc3dxYasT3kxfubLZAuedc9auX3v72Lr/+sd/RqfbRZR8ov5B0s4irWaHvU/s53iTLcOx3OJ6brs4kVAgMCi0EOO5YM2ffOKWD3/xK7ey6wcP0FdbRv/yEeaaXVpJh6ivDycVWZ7j8i6Z7vWRcAbPE4R+QLPZJtcBUV8N4QV84457aMxu5d+sf9cnx3953btdRqB1hrUuFFIiBJnyFbmFJ/btwzrwPB+lJEmekRtHVOkjURqQpN02WE1QKuELSNtNpB8QRTFhHNOYX0B5Af2DNY41DrFv/1NLxACjJV/UgyjapYIQbSTaiJHUcskTM9nvTX7hJv7sE39BvPIc4sHqiSXg+YrK0BDWOubnZpHKIwxDhPRwUtFJMpzWRWWcgqFzX8Q99zzA3if2c+DgDP/iXeOfPHeYX46Cat11WmMFT/LJxsOn1sM5BGmmIevS11ei3V4klAKUz0KzhRQr8H1/SjkNVk/YPF+Dc6EQIhXKm0GJ1C4cn+4fqI3Nd7obhirxtrXnv/D67//gEYQIKVWqkHfpLBwl8gKONWbppmwqK7EtiqLtJutu8kt9N2onUqLq1Myimf6Lz99y7f/407/k2OFZaueuZbHdxQlQnoenVFHegkX5Hp5fIowDmq022hikH6JUYcTqTNC1hj/atp1HH30U/d6JT75+3QVZXK7s7LQW13uYav9A3yaXtieS1AWu2p89/fTTmGaL5Ze+mLl2TrfZwgs8XKdJtTaAzjMSXdBXtpoLeL4iS1P8IMDikbc65J4mCj083ydrJRx6ah/R6y8nTQrDAJNz7OhhRLmCdY5quYzFkkSKchzQ1hqkhTzDJE08pXE6QwUBWZrQzhNkqR+8GLRm5fkXcPDwEdqd7jXVoXhj2s02Vqvl7Uq4wDpY7CTbKwN9Nx/r8OH/+YnJdZOf+yLH5haprTkfFZdoJAlC+QTlCIWHTjW5NkgEvheCEnTaTVzkU122imxW8vjuR9l2/Se59/4H1v3JH2zaraR3XFndwOrTBb2Ehx7Zy2yzS9hXYyF1KM+jb+U5LM4dZ8+TB6gODl/15a9+nWNPH6Z2/oXMt1O0gf6hYRYQtJMMqQ0rhodp2y7S8zFFEs9YGJemvrfniJs5Ps+KNeeTGcnB4/MMDg2TNGa5/c57uOvuXRw7epiov0ZQimlnGhXGaA+6aQ5Zl0pfP8oPMdYx20owxqD8ClFc4ePbPk6W5Zy75rc+trrGPm0ZETYf9xw4a2pF0ubfvwD/uaWCnkZdJ0R2GsuGcyB6RAQnE2BGT369+MzxE67ZuTDP86LnZJ6fgHMzC10C0qCPTJVp5oJO7nBCIaXE6hRhUpLFBkpqApFB1kKaLkJ3i41xijD7eYwgDDHG0O12EUKc6E/peR4WKsY5jCtadFkhp4X0poX0pp1UUw6RGQcI1YiieHvBzsJ4X1Xe+IbXv5bI91CewiUpKA/hhzgVcPDIce578JFLPI8pIRVSyma707laRPGkdoziSVTE1M4b6x/+o+t3smf/UfqXvwD8EkeONjDGUC3HpK0F0oXjBfxtO/j5AkG+QMm1CPUCunUcZ1IGBgdZXGwSVQcgKPPQ40/xwT/Yxl33H7jBD9jZSfQW3w/2Gq1RUk63250NnoSXv/xyYl+RdxaRJiVSjkBayLvQXiTyBegEhMEjx+YdAlF8bpI26BQFDAz0c+zYUQYHB3jRiy5EAFEU1tMsG8/yfM38wsKmzLrxIGLvzHHze//hP/4ndt74eaJlIwRBSJ4mSCzOZLQaR1E2p7/kky3OEric9NghhO5SCRWuOQd5Qv9gP1EYsNhJCZatomsUf/apG/nj6/+MjuGq2cV0qxeVpgsiDdkEkQkhsqLnI5no1cyhHcQVFhONV6qCH6NRVAZqaBhFBRSQnmogvRkn1HGHbDoLaFOTnmqks8du84SbkdAaHhoiLJdwWYbW5gSZvwPmFxaJQrblWo91Op3NTnozRAPbj7a5ugtjH9/52Wv/8H/upE1E6QXnkZii16t0Bs+mKN3GNx0qniWwKZ2jB2ktzKOTbgHLNhcx2jA4NIx1BVN0dfUF3PKN7/Dhj2zn0QOLN+QwWq707QzjeHvaam7tLs69vxKqhg+Tl7/kxcQDFY7ufZj+SoiUFpd18ENFZ6GB0AmhtNi0TRxIYk8QCEPsOYROQFii2MembdLWAgOViFdd/hKSuWOTYSibfqimfcy+l192Ka5xBGUzpEkQeRfP5ngug24T0jae0OByAjSey/GFIfah5At8l0PWwWZdDu/bx6tefQWlUnybzu1EKYq2t1vNjQjZskLhl/r2aRj5H//rL9b9rz//FLn0kWGJucUWUjgil1Chg2wfJTm+H9c6RlVpYlK688dApwzXBummCfOtDtaLKV94Kc225qavf4ctf3D9e5RPI4ijKSe9GSdASpEGfkCWc2FmHN3c4vyY3HkQlFns5gg/xqmAr9/2HfbteZTyWWfTbHdP9PdcmD1OX6WMSbssrw1x4PHHqVbKnHfeeYVTYl1NO1B+hB+XaSy06OaWoFRhoZ1QGajx1MEZHnn0cbpZTlwqF1nbWYrvK5SCbGEWTxRoWrkUk2YZ0gvBi3BBTDsXBGet4YbPfYnPfelmDNQMohaXylPdbvfKII53/Lx8Hckv+nA/ssozpdr/F/jRLhHEyLBCJkIWM2hqRctFHMsjnpzTPN105OEQrlSjZTyamcV5EcIPQfkgVdFjr1BMRQ2c9H4Eg9A/9GVLLKphhZx2qKKtkVDY4vW0Q04jZNMJcYKoJlTsHq4NccH552F0Dr2+htqB8EI6qeH47AIOyLUZRYosDMPdaau9QSMr+PCl+r3uxi/ewvHFFBX3EZT76Ga6MIB0RrNxmMglDJcVq/o8zurzqPk5YTaPbB8nzOepyIxKAMePzlCqVuimOU6F+OUBDh1f5L9+9OPs3b/g+vpLW3w/rDvjkFIQx0VZyEVrL5h525uv5pyVQ8wd3Edr9gihMNi0jfIFsSeoRh6kHTqHD9CdO05n/ihSd1CmA0mTTuMwh57Yy8plg7znn7+Ta970uh3WwexcY2tULk2V+vq39w0ObdPIVRms/a/b/gf3PvgIUd8Qwg9ZXFwgVIKsvYA0CeVIYbrzxDLnhSM1qr7hrFU1SiKjefRpgsAx2F8iazboPr2vEAJJjl+q0tWOm+vf4IbPfO33Kv3h5m5mscKbcUI1QDYdS+xTSx0fgbgEfgzCI80trSSj2c1IckPuWG1g1AqFEbJukE0nVcMpb8YpbxIhW/jB3iAI9iz97oEDTyOFoNzfR3b8GFma4HkeQogTrcOEkJkfhA864U0ePN6cqi4bmPrMV3fd9Oef+TJN41EaXEGn1SU3Fp12ELqLbh0nnT+Mly5SlRkj/REXnn8OLmmiyBF5h3IpIJ09xtF9j1OqVIlKVVIjCarDPH7wGP/5//sfzHb4QGIZSzM95nn+vtLQ4MedztaGAq561Tp+/bpfZuWqYeZn9mNnnkLkHSIPzh5ZQehJTJZgsi4mbdM8sI+02aAzewTTnoPuPMnh/WTHD/Hic1/Av/4Xv8Xa89eIqL865bqdq3VzfudZK4cv/PW3v411r76c5tEDLBw9iMy7iLyDNCkEColBd1uQJ0idYrqLLB6foTt/DNudx7QayKxJ2XO88zffzWtfcwXVmC8IbBp4CiFEaixkVkzIgOYNX/7OJz/9pVtopY52Zhk5+xz6BwY4/PR+9OIxan7OZeet4porL+Mtr1/H6y6/kBe/cAVnD5ex3TmOPv0Elbjw3vF8EgNqcAV+eZCbbr2NT0198/NtzSakjxCymef5mlznxAFbnVBoW5C54EVoFDKIEX7I8dk5vvWtbxENDRL5Hll7EbIO0mSE0rJ44El8cg7u3c2yZYO8593v5GUvveTGzDCRZflaKSC3loVmm2XLV5BkOVL5lMoVFvbsoTY8zPJlwwhnSTpNbNYl7yzSnj9GyXOcv/aFVENBa/YIM089Wdxbo7EUtI8qLKGiCqmVfOPbd3D/nmOfrJS9zQ5BuVy+NW23Nv8jo8b7+wtlAnVB0Uz2pMJUjWxxcSKw6SU2qNI3ci5l1ya0HWTaxC9V8csrcEDFLOJli2SLx2k3F9DG4StBrCwChRQ5mdAkqkTiymhZARlTtBp73myE0AqJQE4XClKOWlSl531nzolpISzS8/f3yJ5HjZA16cvWcM370MUvvuiD39/zTQgUtugPhvIj2kmLpw7OYGFMSjVtnR314tLWrJtPBKVg6tA8D/7FZ7/IrgceYdm5F3Fs/0FktUS1HLNssI+1567mwvNX85pXv4I4EIS+JFACZ3MWF+Z4/LFHuffee9i95wlmFjJa+w5SueDFWAt4ITkSo2LuuOcBPvvFm/mP//7dCCRZ2pnww2ASZ0lzNz6yrPTe//Iff2fDvQ8+9o4f7H4EL67w6FMH+dyXptFZSt71ueyyy7ho7VpWLR+mLw6Z2fc4Q9USLktodbpEg0OEUcg5K2u86rKL9vaFvE84sNZWO51ktJtk68oDg1tzWDN9yx0fmLrpFqLBlaiwRHt+Ac9pBkplhs8+hze8/rVcdsmLUcIyPDTIQH8fSbeDkIon9j/N3bvu494HHmL3I3vQFs69ZC0HGosYrwJSYKXPwYNH+NRnpnjLG69KVy8LQp2F09IxJoUoSON7Ro90FilcEahEgfBABjhykArlR0hBK7OsdY5AIqelZLqgVyxo8pyQzbzZviaqLbu6NZder+JSo/AQHO3jx/AH+7FZl8BXWCkYGOgvmpdDQyg1rZ2if1lp5z17F276409+mo4NIfBY6GQQBGSdRdauXsEVL72Il6xdwwvPHuHss87GIZlbaJM5SYrgoT17+eu/rrPv6QMkZITlPlbUBnny4T14A4PElZjjs0f48s238va3jV7z1te/cnd/UNqE7oxhbbXb7VwdBeVtF5+7TPxf/3a9u/r1r2Fmtk2Ox0M/3MvNt3yFAwfa+L7P6177Gi655BJGRkaYPTpDXwBWZyRG4IURSnl4LufSc1fxxldeIFTaAUQmPH+fsxB6krE3v0qMrD7f3f/wHrrtebpZzudu/hqPPX0E3y9x3ppzuOSiC3nZxWsR3XlcukjeXkAKgQoiMqfAL9HXV2Xdiy/gRWuGPq6gnibdTaKv6F/qpMIqr7L/SHb9n/3V52i0cs4670UcfPopnnxwNxde9hLe8ktX8s/edjVnLR9g+bIVd1bK6mYFx7Vj1fwiG2bnk5GvfuM2bvrrr/PU0QbHDx8mOusFJK0OZBoG+zi8bz+f/tJXeMPrXv2RFy4vCZUbbJpsTJPuhFfxJ5XyMA4sHiiB1gYlFdY59u7dQ3N+jlBB4/ABli1fwdVXv4GLLnoRF5x/Hq3FeXTSZvbIQc47eyWve/XLbh+ImchSsyGKS7syx0QQRnTThHbSZqg2zGIrIc1yhl78ItrNeUxnEUzK2SPLef3rruTK11zB8pUr0Q6yJGGoHHHgqaf5/g928/Xv3MljD+yBweVUVp5Fp9MBKVBhibvu+QHfufNu1l34ttEkyyvVKJjK2813BH78T0thLjVLdwKE4wQ/rEOMWtRU1F+bwpU3LHvJq8aWrb3wWnwHug1pu7DO2xr6qjD3FNn9d3Hs2DGEilCBR5Z1kdahnCRDoqWPlhE5EVZG4LwTHKDPo9IcPcm5KgMnZLj0gROMOlxdSFkXQuCsCazT1VwHqwOPvatfcDboHF8pcm0QTuL5IWlngacOzOAgEMoj6bbXlsqlelgqT2YCbqp/45Lv3fsA0bIR/LgMvsdll72U17365bz8JS/iTa9eucOH/QqOS2jhQDqanmQazuJNr7qE+V95y/X7Dx3dsPMzX+KWb97BzOwRvEqNsNxPq9nBL/cTEfHlW+r8+nVvcS9ePSSsc4GnJK1ue70MomaesroWq/FfeuX5o1e84vwrEPDt+w9/8JavfBVjNVZn7H3kEVYMDfCyiy7guje88AvCXZz6ln3S0AoDHmw5rvUF+z04ZDS1xYX29X1x8L5arbax1WptCMuVB52E1HDJn37yU6iojEbROXyUZWvW8NqXXcQbX/sq3vyGl7QqEdMYKCtuldBsd7imVCrfrqBx+dqhyq+++aW14y223FL/zsinPzvFXT/4AdGKNVQGa8weOoQfhKw493z2PPEUn/r0VLD5/3zXqJN+3Vo7rYTDCodzjApIe3ymkOVgLUJ5KD/ANzlKLVGcEQhFilMFhSwWycmGBELI6WiwlrUWO5sHa7X3PTmHu+WrXyX3+7jopZfzxL59KCVwJiPwFSuWDeMcgbGuJgGn/NEULq1/63v84OFHkXE/+D55mvKyyy/jutGrePELalx9+VkfLcOtWWLXhqHcLgUkdmCDkGRtwzVXX75y77961+vX7rrv0Ls+NfkZvnBznX2dLkNnn02rm5MaB36JyrKz+MTOG7n8xRd+YODs/k1ZCqETaVyqTmVpsl5Ydq4dqYg1Iy8b7cBVBmqfr/dtuPnmm/H8AOF5HGvM8eijj3LZpZcw8dYXfSGAPRJaqeUS5wgjxS4FxwMommkbM06eXaiC+E7PinRxYX6DVqXq5Wtr17107ZU1gLmE99+/e8+6R594itwIjh0+zJOBYqjkseHdv8KaIX4/gD3GUvMkM4ljHT1o3UIlhjuNYTTtti6lEuAQmQyiembY9tkv38JDjz9NLgIOPv4Uq198Ia+8/KVce80beEGtzPkryrdWAzellGrozKyyxlY95R9aXuV3hyrRyG//i1/Ornj15R/7/C1fY+enp/CwlAb66RxuEIQl0mVn8dDjT/Htu+7hrGtfv15atzMIgr15bivaMSE9Ba4o3UEqSBMIPZyxPLbnh5i0je4s8pIXnct73/MernnzK6jG3BrAXkmtKaEleEkawF4B2dxsc6q/Wt4Z+cH0QsZmKQVRGDB3/ChycBiBJe8W2cezB49y8QVr+PVfvZbfGH9zVqvwB4lhnbHUYp87Jf1NH/a94oJ+rnzlJdsvOP+8yh9/8kaeOHScbqeNbnWgFFKt9jM3f5R779+N5W2VJNPrykpOhWG06+dFff+LCcm6kx6mdA6JqwvnsqJQW+CEZG6uubXbzC40qWrgDX4BNfQF5LL9qBVgKjC4DHQGRw5z5NBBWgtzYHOUMCgMNs8wOsc6W4BgnoeTPlp4BTXM8wzJCvhbu7YbY5BCgLVI4aY96WYwIKG5fGgQnCWQEqxFSYlSHtYJGrNzOAhzbSaMdUGW52MawfEW9c/f/FXaqSEeGOLQ3r1c/ZZRrnnT1RyfeYp777iNp59c2CBzmjKxrSg3kxVnJkOTTScLCxsWGrPbW832lkoc3fySteeI/+e337fr32/4TWKpSVqLhTBXHrnz6OSw7+ARvvf9exAKPD/YqTyFzbO15TCcyjrNC5tz81ttaitZK1/rwaFQgSchjkKyLKPRaDD1uc/y//3hH/A39868oyS4zbPMiNSmEUyXHbfqjh2xqasGzu710ft1lkw4Zwnj0o4g9KdbKVu/cfsd1zzw8B6WrVxFZ7HJ8HkX8CtvfzuvfPnl3PSFz/HlqVsrSZN1fYobfdjZnmtfM1zifaFhMm91V+t2tkq39aoVFTa+d/x17/5Pv/c7vP6Ky0la86SdDmiN8gK8qISRPl/+6td4+qj9ay0ZNzIYNcLHODG+tO6FNYXCLCA8hDWgc9AaqzVG52hY1e3mVyZJd1036W5K02R9kqUT3TSZ6KTJ+laSTuRW1Rvt7NpGm8k//pM/o1zp47rrruPss1aRzs+hsKSdFstrQ6xYNowv2SmlbBrrxrxA1GeO8eHJz07hBTGV/gGiUonXXf06rn7dq3ni4fu465tf5fCThz4QQz3QrUZgTJFQlzDcXuSaAcWETGgOwMQbLlt13Uf/8+/cuvH/+C08k2HSBOcgSzROhAwsO4s7/+Y+HnjkMQygRRC0tUSWqjuDINipu80tIukQGlf3M/YJSyZtTqfdISz3YWXAfQ8+zM2f+iv+7BM72PN45x0KGhHsGpBMlKGuW2ZEt/NVuptPdBZb6/2oNNXOIbPeIRFXd0jlzZi0XctbyRpSh7BklZCbpTVF8qDn0zh6jF23fZtP/eVfcdNNXyWzrFUwRaZRhulQuwcDw16Rk8qMloRpk3ZrgZJNZwwOkSHhwJHmB/7yM18kTQyq1M8Fr7yCN715FE9JPvJft/KfP/j/4guxT1rbUtZM+Tbf57tkX+A6OwLyyZJiW9JJ173yxcvf9+//9bt559vfSuv4YUIc0bIaSbtLUOpjrq2Z/utv0Em5Os31hFSyXi6XpqylUiRPCqy1RbmMFHhKEniChcZR5o8e4sI1Z/F/b3wfv3ndK35/Vcz7Ysudtu2qrmNCmZimSvKGbndHTDep9VfCndZk1TTTo3HA1qTbIQp8hlcu5/jMQcqhj6fg0AP38s9+9Vpu+OT/YMN73rxjpMJ7PcuhsuPWYZ8PyZzmwpHG+nRu8VLdTFeNVFk/8fZX7Jj4tevwhSGfbxD296FzjUVSHayx59HHOHQ8nyxXS5u7WT6uPH//z0th/uJ6mJzgN13K5qz3UqJHHZKgVL3dWkuGDTzhAuVcKMO+SXxTQy9OkBy/qn3fnRzYfRdu8QgDgcW3HVzSoSwFghRcit9rYm2cQYki068ol/75Jv38ZA/bIZwdFULWBS4TzqUOQoHLBK6Os2POMg1uVAFe4E9mljEF0/3VEkpQtJ12Rcd6ay2e55MkGQ4CKUSzXK1uM0aTWTd230OPXLPnif0EteXMLTR5w6++nRedu5rP3fhXHHhsN1t+9/28cGX/hyJrtschLBw9VC+X4jv9KL5zoBLvMMLHSIEBjGNspD98+W9cNzr13bvve8f0t+5hcXYWwj5QAVJalCnx/Xvu5T3/7JqxoqzC1QsiBYsv7aH+cnmbUGCcqBnLcNbtoPMcPA8hJQODAyQtj6effopvfeNrvO6lvzVc9tia2XR9azbbVBno36ZNZ1Ug5N5yGNVLlXg615o8z0YT7S4RTmWdjKs/8/kvYJAstjuUasO85nWv5+DBg3xiyx9x9S9dyVtH38iyKps7LX11NfKmRdbKFo+1tlcr5VtDp4krfdutkxyba23vH6xsvOKy1c1/+y/fc9OD//G/MTd7nKCviu/7PH1ghnJUZr6VsHvP46x87QU1Z0UIatQKUz01hikxeMoHZzB5hs0zpLREfkA5Cglgj1/y93nOm1TCFnukh8BY51iqp11x1siV+45r105z/t1v/5/Mdy1/+uc7KQ/0YbpNhDNc9pKLGRos3+pg1PfVdKYL5f2Nb96OcwX12OLx47zt199JpRTwiT/5OLJ9jB1/+Pu8YHnfb0uX4OnOVVkrWxuUBrcESu0RjlQvtNcHmIbT/lg3M1cMD1VG//n4dW73Dx/n7oeeRKhywZ2XpRw5vkhUGeTe+x/mza9dt30wDjY2W2JzOzWjobOU42AvSk+YZL4WqtJ2X4ajnhTvx1ia3QyNpNQ/RCIFe/c+ytdv/Wte8W/esa/byq4IPVnpi7wdmW9Iuu2NURxPBn0VukmG8+NDCSrUuSOKy9OVipgGy8LC4npP9U9axYZuq0WeZVQGygRln7xUohpIvvjFLzP2S1e+Z+Cc/vW6014VlwI8azIhvSmT641OeqGTwWjkicmoHCNwo0p5k5lh/d333s9iNydaNkLS0Zy1+oU8uPshdt/zXbx0kf/1ub/El2K/RDWFc/hKTCPcBKQbbd6tWiGbytpGmnLpSDX87d/5d//Hx7575/d58qn9DIysIUkS0ihGhBUefvRJOqm+uuyrW7Ncj/sqnFKKhtYaoVTRCMATOD/AVxIReEjrKMU+77h2lGuvvvS9ChpP7z9803mrVwqvLHBaI5xBKkW3k2x0VmZxXJ1OspxWp701DvoDKcCZHJ0mlMsR3fYCgZS8beLX+eDmf0WtxA6Z0TLW1nzyfQKTSeMYCIItwyv6tmA0Rlt0gaiFL73o/A3LBqocXszwPUUqJa12h4rymTlyjJkjx4LVw6vIHeTa1FD+Px0P80QLKXeyZYzswbTCybpDjQoV1Z2KAq3KQVeUw7aopplfnUrDgR1Z7h1qPXI/s4/fi2s8wbBqsjJM6DfzlLNZ+lyTwVAz6GfEtIlMi0C3CGxC6BIQGk60Z3perj8tkj9cILEIZ+sCm0lss1CeFokLhDPjVmdrcabmKxBOZxIIJHgCnNY40+PezTTK8zHWYaEqldcSUiKUwvfV9LfvuJOFbkKpfwgyzYMP3M+Xv/A5Hr/vb7h29Jf4rXe9/caBmC2mO785Xzx2ff9w/194gchMt3Vtp7mwNU0ztIF2ypbZufamTmtx41DZG//N3xhn2dAAtNsgJcILKFUGECrkh3sf59jx5lYAnWcEgb8vy7qjUejvy7utzUlrYWM18naEkgc9T2GdJcsNpXKV4wcOUipXCMOQJ554HGcJfAF91XinZ9NVuj23sax0qmxySXuxsTVPOxt8JfGVV1fSa0SB3L7YbF+x76mDBFGJhcUmpUqFJ/fv56uTN7D2ZS/lt/75u1k2pD6qDasUtuHyhBXLaxuHav0b/VBOk7VHW8cPT5qkNVb2uVWnesyH6atfc/HHX/6yl4JweEpiTZGVap3EqYDdex7DCIaNoGag5pCBcy4sIG6LcrZAR3SGMBmhdESexBcOkydkmgt9yaSnBEoKPCkoWJNE0TK1YFkZneuw04+9/b90zS/z+JNPMTl5I8nCPKUwwOmMwb4Kb7z6KvpK3Jh03Toli/h5phm/43vf5eCBpyiXYvqHBvn+Hd/hKzd9kebsUX7jV6/l9a9at6MvlNux6fowkK3Qk02cxVNMlUK2eaa7plLxdpZjOe3l7WoAvGh15bo3v+EqmodncM7hBWER2840YamPhx55tKhBBvyyvy8xcl2W6xFMtpbW/Abbnd+gTHeDgjrOEg/ViKqD4MWkVhJX+phfWCTPUiS08qS9Ju8srpFOE8l8tBqIVDoz2m63RzVy3C+Xdlo/rMx39GRjobm90+lguq0Jz+VrCuSGVrEhFdo40syQJJpjjTlmDh/FmAIKL8fBljD0iZXIIuUYLIXbY09sFSavK2HxpEi11iNeUNRY3/7dO1k4fAwVliGMufueH3D37bejs5y3X/c2Lj6/9r44YmsYymnfV0jloTzV8DzZDH0IfRfUKvGmvDu/xlhq5wzx++/81bGi3jzpUK1UkV6IDEs02wmHjx5bHUbRpDGmluUZAjLnHEEQgLW44lrJswSbZygMF567mmuveQM+7LSZrQ5X/T8IyBHJ3MbO8QP7ZLp4PaazMRJ6xCatsU5zfpMUUK1UNjsICiQoodVcoK9cIuu2edHac/mtf/5OnnriGHNHsw0iN2l/JLdXIjEd2s4Vunnsw8ncwXts+/jOdHZmjzLtLb7N0SkjF513NuesWkk5DmgdmcH3fUyWkWkNQtKYnSsUmvJajpMVGP+AHqb40Umqz6obO/mtU2vJBHZMYKYFpEsxSYEoYpNFdXcVbPHBUlwGMpDTBWFBQdomnRmV2ErxNdmyQtUNqp5rJiyqIj1azhA4nQQIiUlbm5OZPe967I6vslwfZmWsKUuNzSzaQu5VyEXAYLWKFbPIZB6bp2A0kkKwIRU8x0n/MV0TezWlRXG6ONF95fRuLBaqRffQUzu/uawg5y7eUX4w5ZwhS7PNQorUdw6js5pUHjZPkc5itS5YSKxDa03oKZCC3LHGg0OLrdZ6z/dnlArqu+67n6zVIXACKlWs0xx6eh+DI8u47q3XUAq5rbm4uHGwv7K1O3u07hYXV/lB+KCKyrcqK6czJ8aNdjVPiUMD1fKOWKaTnU57/Ssvf9EXhgcq75hZ1IS+Il1sMZdaIic4vthitp1cMrK8Whcup1T2ts3MHLpn5YoVLxdhwNzxuetFbBCeyuLQR0loNxfwnaNvZCXGWdqdDlJ5RD67FhbSTaHuhpX+vk0Ii9XpRq1tNYyjXUL5U81Wd2PuZFDp79+Ww+h377ybblpAptWwSnOxxQPf/R7R8mWsGKzyll96+Y6y5NZ2S18zVAk2dZvNcZMz1W0tbMeaWmWoNo6DpJuuD/xwp3GWtJNNxKXgzpdecvH7v7PrITrzC+D5nHXOag4++ThCdzk4M1MYRYJUOFKcrYA6rY7KWYNyFqkkSvgYB7OthMcPHKPVST8sbPphiSsShHqxfmsdxloMiof2PMmRxgJf/fptNBY7HJw5jvBDhoYHWDh2kFBoVg4N8YrLLsWDmWanM94Xl8lzsybV+SVPzxxBhjHtToe46rPQOFZkpS4b5po3XM1gJXpf0pzdJNPmeFytTikv3N3Rmhx/vSeZKfdVt9BtbsnSbO3g4MBE2s1wQRC87JILOf+i83nsSLPgeVKSvtowcwceZf9Bn8yytp2zxRhqCtHwfX8nVm9GuMCvlG8liHcs5kw4a8iyDNNsFdXJnsDzfdrdDp5XiLWBvur6yBPoNBntLM5vqPRVp1QY1jvNzoT0RLOI95KVy9GtoYx2knXQOl9TLsV3dq1BOJlKqVBegJE+yIDQDyERGD2PtaaIKet8Aqcm283FdznhXRWWKpuDIKLb7YxnFNR02thqFPtox6o9jz5GMLyM9vw85eUjtBvHoVLFlxmve8MbOdziet0216MzhMvwPdcKPLtHuDwzNq1Za6vttPGRSv/w/kNPH7k2qAzzoosuoVKp0JyfJxrwEUGM7nZpmYTHn9zPK9aOIJS/X2szKn2mFZbIE6QmgzzBKUmadEnzBE9ZLrv0Ii48pyYWFtrbY0/cuWxoYHOyOLcl77aurS5fthljauni4rvCUuXmytDQeJbkE0k3WR9XqjsdTEGxHpevWMmhgzNUBod545uu4Y477mTqhp187Ys3zpQjtVlYQ3th9npPmuFqbfDjILJ0YX5DODS0jW6+JkuS8TD2d48M8rsuTz5is4SgWinYwZQC4aj2D9DudEg160OldvpCoO0/aD/MEz7dT2iQcrJRp3TuVGU5CvkaAWMS0cLZinQC5UAukcRiakLkvUaloo4omtg6p7BCYP0Am6djgdM1T5oaJltLrlchw6uI+jYL6U9mjglPMClcZzR2c++HdIt48p7V99zyV5ztzVNTbaoqQ2cZxzqOdrCc0ppXsvKFF0Go2PvNaZYjqZQ0OnU45WFFXHC1I1sF76JIcS6gR5YOIORP45g7TjYAO5nIUyjMXguwntdhBIUHIlRR2gJVI71x4exUb4ZHXcHIg0VUnFBjxjnyLF8Tl/u2Silpdrrrq5XKzm6ajTaOHsJTYJzF6ZygUsa5HCkF/QODKEHDQegH0c4gCHj84NF0cbFJ0D9Ap5uAp2h32gSxz/BQmQvXvhBfsZ9AsbiwsK1vcHg0yc1YR3iZQdWckut7xk1LWJsqZ6aaiwvX99VWvk9Cc/WqZe/Y/cQh0laDwZWrmDt0EOsHNLpt9h9b4MLzlo3pFHyXsaI29FGTJhulCreHpeoXbI/BwugEYRLKJR+jHJlO6eY5UV8/KowxUKv2hdvMgt5Abka10CNWyCaeaqRGZM5aRFje5wm/2srZpHwaRxuLLCx28EuDZLYXD45LkDZ57cteRGyzO4X265VQ1tM0Hw3i8lRqNC7quy0Ko6lOmmGtHVNevNMisNaOBkpNGhg9/9xzSZOEoFwBoTh85Cj9gwO0jx8Em2Fyar5jXyjMVIYeE3gZSuBUSGYEQeCTOY2QkhyJFgopAjb83n8tCqtOJvgU3OMOTI8ezlhXeLXagKeIyzGVWg3daZItHGUoELTnjvPB/+vDrBqKft9k1EI/eDDpuvGBgcrWr9/1sDvc7GKiMiqMaHXaKGfR7S4vvPh81px1Dtow6of924QX7s6tC4z06tb3xqygmjmqMrf10I/v9FT4YLPV2hZXBzeFiqmR4X6GKgH+TIrOO3hhzOJCi1JfHxrB4dlmbflgdZ8QZJ7mkLNmHAGoYC/aVqzQo34YTgI3SGcxJkNF5aI0wVriUol2u30ihNNJ9agUXj3sH66n1kKSE4TRpHUGCorIGYGrO2ORQiC9aFduRF3ikJZWEIQY6ZNaCdIHk+IrRaB8TJYQCLCeSLEWL65OEVSmU+3GTDuvlePyzjRNx4IonMYVHX4ee/LQO5rNLqFXtOzrLDQQvkQJD5TiQ9s+zkAlJuumCGd7EL2tCMy6HuoEODw/xDq5WltJpqGbW/zyAJXAkjqNybtUBvtoPf5kQTLiGPNUMO3Lojmh73KU7hDgcDIA6WPjEgQ+Opvn7de+FZ1kY8v6yxuTbkKa5vhxdYtQwV6Tq4ZzsiniwY9nTqQiczjhTfq+KIz0IEAiUCog0YDzWXvxyzjcaHHLFz7Lyv4htJUjQkKS5ARh6XbPk80s0SMqCHbaoD/QqQuEF99pnJ9pw4iVVFetqHHvw4+iygqdisLLzHMWmy0q1T6kpKlQmCwdR3r/sFyyJ2OIzy6JFM/IZBWn+aMOga0UvRZdgDvRBaOXTHPi14Kiq72tgBwt/lf24i8C4xgvPK2C+ADf348QGU41cJY06a6v9Mc7dZrg5/MbEPPXdu6+jf0/+CYX9ueE2pA323RlTlAewI8HEeFZxGsuR77sNXv1ngfWdlUVY2aRLsdzhUWvnQBUxt+7W19QUhUTJZ4xsye7svcUZGAR1VO61Pe6WZy8I1LK6SguYZ0jz824RVaPzc5vHx4a2NjudMhzTVD18COFEGC0pqs79PdVkdC01lWMMeMOMbXYbAfNVrtIAjAFqVSmNcpali9fRrVSRkHdCkbjcum2Vre7Sfjxbi28EYOqIQTS2abENpXLWwo7XimXb3UOclgz0FfF5Ql+GVqtBQj9whsSCiM9DNSEUBlONCQucM4FhcftoMchLHqx5SJeZ7GiQCGcc2TGFnNmi7IboA5iome+pQiROSROyMAiKhaqxlGbm18sOq0A1oKnAvLcoIRg1fIhqpG/M8tzjLGjzhEYIbCIMekFrSQ349ZSlcgmouiTKoWoS+ewUI/DEOGKGlnf99D5Em2cI006SGhJTEtiCnKEE8aVxAlJt7kIZUUQRUgp0FqTaAuuaETtjC36ygrZexYnIyzSIQaquDyF9iLdZpswFAyUQ1ynS6txlE0b/zUve/GFt0YeuyTUrZQbnHMhCLRxHFts4VSACkKCIMB02litGaj2sXJ55Qv0auIEft0JW9yLpfXtivKJTJvAkxCE0S7P9+hoqFaiXdVyvK7oF3uiNwtOuF5vT7GENqUCl/VoG5sI2cTJpkXWHSClQEmwsuhe5Jw5UZtzwphwJzvWFqqHUYGrFzNllwRanVNcAytkvZBVp5j/yF6JTzHfFoF1DueKrhjOmpqziqKxPTghAk/5M8KBMa6WZW5UCzGCgk6i6SQJaWIIKhHWU6R5jrYGKSXHFlocmDmC8EJAFrkMS5LBnezdBCkIWTQl762BJUPcAS7t4oSkMtSP53lkOWujwEdbQ2aYKEqXcqQKEMJicAXELBTV/n6WD9cIlZgWRcP6MU8F005IjPAmi7kAK2wvrre0V0/tK1U0qc5yA6UKaW55fN8BWt2UYPkQbonIxglApK4ooRsHHy1cU+BaUqi6RY4voY9FKMoW91Wc0o34pNzsccj+/Ib3Yz1HZ3qQoPiJoO3JxBwHwi21KcqKhwyK4mzR21RiaXO3HKIuEGM95Zv18NreTbAtC1UjvBkj5U6FAM+RGzBWEkZqZ9ZqjsexC9HdK5o/+C77dt1G0J7BLyvSNCeIBmhnCUdbCm/lKs576dVw4SsA1VA2I9RtSmYRzyXE1tI1JbTLARPQa4vz3EBZ8cx3epyhS3PWA2F7C0GeaD9NVgiLk3MrC6V5YmtLFNZCmmYbhVRppVLavtCSWxLL6N/84AGs9BCeX8Q1rMWTAuEsq89ahYBUYls4ixLQbDZZWGyivIFeHY/EITFOMDC0jHI1urPw8vRIqRzt7LaaOwMv2AtiRkDmEIFwNisSkopbqLxgqpvlY8bza6VKpcgW9X2STpugVMJ201PmgOw0b1y4cKlJ91K28BKMbZ3EnhBePYIHa7FQZUkQwph0BYUgFAiBEA7hXCYEmYDMOqoLC/OFqhICY11BpZYnGFFk31kE2rkx51ygpJxSwoHR01IIMGZUIlpKqbrE4azFGjNmlTdtHWO+HxSE4MYQKdV7XXCsav2Te/UNDA/TJcAaXZDMF8kf+J6P53l0O10QDiEKA6JYKa43R+COHQIlCKsl+sIS7dkZjh06ynlnLedNV76F9b/5z3ctG/RG2y29OQq8QmlZF1gr6XS75LlGhBW0Bd/3sZ6PQVCt9lGKuQ2zFGaxhSdU3L4pZ8UEzuIJh7X5GiFVw1NFiVa7m24tlcPbhResK0g4JKJXh3HCZHRL6/9E95ZCYSKbTojMCXliNwlR0EqK3jVbB0IWDZ9lby04bL0IfgjA1JfMCvtjQiYndqoQOEHgxKn7+JQ9e8rXrTXDWDeKK7qCSGhJpwPhPIQ1VaxuWFTVGRlorcmyHM+PCyXnKIwfnZMZhy8d0g8RQQWHd+KYJxCrnhGQ57qnKHshpN6eBQkuZ8WyKkeeeIiRwYiVw4OUArYZ61hstrZV+/s3OaFuyK3FSoF0vVCZ1khPsnLZMkZWDv+BUpY0TXFLDRrcT6+KrLUopciyDqVylU6nw+FDM2RJQhiG/GMd3o8HZE+JSy4Ru4ofXwPyDNWQLVkNTohxegvdIbGid1MR6Y9WxoUlJZ2oe0qOOhsEaWGpj1rjKkVihMnK/z93fx5m112eiaLv95vW2lNNW1OVB5WnMgaJSWBjM9gJwTsBF0koMrjSSUQGubuDcvtE6T4Xd05HuTlt7j0nyu2O0n0bdecgcjqVTkKRkKKTbB9CDCFWMDY2yGAssF2eVNawpVLtaa3f9J0/1t6lkjwANvA8fet56lGphl271v6tb3i/93tfE5e4vzaPdvt9/OSX8exXPo+kfxJTNYl+Zw3QI8hECqsrCOkENl/9ZuDVNwKm/mGsndlHiDCcIYk9gPpQAVDKQsChcOt+pZsxNLyp7cVJ83xgiIOeMa7/v6ii0CZwfr6ijLNUdOTrJy04B5BsCeJ2JKpFAJVqun/52RZ/9djjECaFZ8DHiGgDFDFqtRKuvuJycESiiA+RoAYAeO/hfYBKzSARKUhdQhAa1gM6wXLfYS+FCICRKNkSHOrEaBFhgbl4nEH13mCITuZ8w7KekQla1vnBXHjQAAnaUJG+2E3IDWI2G78zDhWPoBCL1gJUQPnF4xIgiC041okAwQCDEy7Ep8HES5F5nohyI/Bo5AghZcEWjAQeLDpaBmwUxYpDpEmt9JNaChTMPbsbBBgpW0LQEhEQOcDH2CgCS9EhhRiLQB5CISYwgPSTxOACmcgXeVtbW0MkAwiCSQxSYwCOyPpd9Fb7qNVGwNEXMTTifKJkRgCw6fJtaK+twmdtdDoZbPsMLtkygfe99934hX/y050t4+pNwaPR67ZvTtXoA0rSipJyiSNgrUWaluBIwvYzSCpBDK5zJEJmsUtLLPOAiU2IswwsMRgS1AJHSPiGFJQTs3HBT0oQAqMuBDpr3T4iKfCgKxrKZQqOEOwhgVZRABEiqBmJ5gWJDnMRMxhoxHi+o9xYSIIkhNSDlbQA5jBLIEugJjjOFrGp6DJfrBnYyCW44Ht4Q0EvBMTgTBOJNnOsgmONOIJibCLaecGApJhLSUtMYjZI1EkOulQG8iwHJYSkXAEHhWAzlFKJ2sgYTpzpvmSnVCqViivPAFNhCh4HiIYEo7XyFDR53HLTm3Htlds/JQA45xrex8kINKJQcAGAlkWcwqDjFBJTWzahkuDO6OMw8S0OV9mGHfy3Sp7ee2iti3+FQKfTQevkSZCU39b5/x8qYQ6OX2No/XQxJsvDpEgbrbho2AE1ATQiiQ6RQISoAaIdBsmSITGIdLboGgAGG9D5jkoACMFBKtMMSjbygL0uYloQ2qnCAyXCEnqnD5Pu39j70ufwxAOfxjidw0gpgNunUEmq6CQjONUVqE5sxZVvuhl41Vs6UOMHg9XLsjx2CMAHJftCJzLmEBAQ7EHsvytrJbwOa1Nz/aOiW/ogrXeSsaiKaX1WMZRGs8RcJFaEOYFYExxrtM7cpRwMCK0WVFJGz8XdJ8727hkfLx984OFHsZYFOCTwPkIqjWj7yPsdbK9vwvSlW2EEjlH0kMSm0FdNkaQlZJGLZUcmkEwAkeDUmXNwHtMlwhGtkmOu29uXGL3MwU8xsRHMc5FEhyGaTACYmkwE68JeWTatCNROnj4LWa4ghAiZpAjOv2C4GiRGC1BOQ0h/A6GbMXRTUWAmECmQ1AU0BVgSKDquGOokRJuGu7TnkycEcVswVRlIyqUSSBB8CPDQRYsiJWKQWO1bZMDuKEwtIlZDCBDRQ1GoqyJRGEDMI8Z2DGyYyQqpF5VRCIROu92G1ho2FtU2Bt0miW8vYJTLZViRrAcym/UgOCARjHLFgEI2KGZjEby46MmHdninlh8FwAhZF7WSxg/echN++n3vxTvesuuzE1UcyDPeKzi0y6n+rNGi6X2AMUVOKJdSEEQBzwsBHyLIR0QS6FuL3GNHVWFpQ6wwxGFusLu8RBxmOdgZpdUKQqxaa69VkVGpJnefynDXmXMdRFKFBKUQ6wGbOECyH5x/5MN5P0O0GfJ0HMSMYfKKMYBj4Y4CQSApwUGBi/MAgdhgxBog2lTAsWYI1W64P18gWRIixGxBsht+PW4YORUzZBJFki7MockSsxHRgzk0KLoqSMIotIQihIilSJgnISCUgWANrVJ4knDOQVLRta6daWHtmaeB2kRRvPKG38nnIU/PA/uqDbA8iWLlSrJFfvY5zL33XfgX//QXUa/Q7Nrquf3VSmX/yOi4iUA1QsFjQGhihkRhG0ghYmKsMB3w3oOoWC2KMSKE0BBCNL+d+BdCgBwkR+89+v0+ECPK5fK67vf/XyVMfsGGcnDgiCyDzQB23QAVDjtRbjLHuYFVkSk0T8+DjoU8yVAH9XwHRsxNKoQKEGOYI5aLTNIwFcomWmI5JSyJmM3Bnvp5/437cOqrn4NZewpJ4gsHAUHoeeA5B5gtV+OSV78OuPINgNm03ztzLCdlK1q2AssPOkhYUjDCwBHgBqQbML/S7rJBA5Ueej5Qa4uDv95NQvCFSPyQWbxhumkIsSYQq4UlFOVCm2OZzfdaxFZSqR5Ohd7pgOnPHrkfz546C12/EjkzSkbDhz5cdw2XTb4KU5vHVjTQ9MHOk6Q8csTERB31iQmcfK4HVAvHcs+AUClOn2njseXOjddfXf1wIsvNfLV9m1bmGDEb4rCJhka/hEZk0Swqc9EgrXMp0Tp+Dh99duU5JGkZOTOUksj7BdngQg42AaAmU7EHOOguE6zPJIa4hxwUXbLoqiDgB7PS9UcsrlFrECjXD3NxtuISQex2DtNbt2wGc0TuLKANcu8BbQDkePq50+g63FrSOBK8qIe8v8fA24QAoUUbub0WJNoRZEMUbZLmmDQGJIEIVJ96+ukCygyMGItONnqLEN16pf5Sb91uF1SSSI1CDAyX9QCfo2wUktSge271wvkWCUgxuLeIUCXgiiu247WveRXe+NrX4C27Xofrrpj4GQUsdNr2gBF4tFQyh6FKAAd4l88JShYBQn1ivIAcc4t0dBTROwRmgAROtc5itY1dYyXUi11f2igyYoAwC8Ra9G4aWraYOQGJdixWXuyTz3Rm1nr5QK95GA9ogCpFUPQQhRzm7mJHhhAL3eT5yJQXSBVMgSAwfPBFSh387S4UbheDHW6zntAvjmEvsAFwnslODSYyTDDrvevAuH74U84H+GJ2DobogMQSEe0mMCiGqqRYgwSkB5gDQuA5cGE2XhupobNmkSQJXO7AvS5qm8bxmlftwHg1RffcGUTnMCT5DGz41hPmsIM7f0+ch2ZJSCh4vOP69+Htb34tdl61lRQA9s4wRwiFpR5jv2cCk4JUGj4wlBjUyqE4YyFiFkWXuCSlhHOuAQzMIeK3Z541hGVDCGDnIJIExohv6/z/D5YwCQzRDLQeqhrnodah4TDZQrpNDAb1tGHkG0EU7PqtxAPSD4bwmQCTaDOoUXSk3EAhPLEOQSpCQdsOoQZIJBoPlwQWVHZmH9ae/h0sfxFP3ffXSHrPYnIE6JxbQ64k0to4znYk1JarsP31tyC55joLTh/otf0UVUYOKK0Qs3x3LkroyRrW4gRGZR9rCujJKjzpQUJ/ZUo/TNQAU/NCMQIM54cXBrvhIHtwUwx+vqiumTuMwjcRjOrGiiYy5b3c3qwqWAiEevMzX/61I/d/GapUw5XXzOAby8/AuwySAkwq8JZdr8XkhPpAdB4U/aRUejnPLbZt2/pbU9umfvPoU1+DFgQXI4BCH/PM6jnc/ZnPYdfV7667CJBMjp6PNGyIOREF7LkIGnaBssqKEg9M/uMXv4xnVk4CogRBEs77ovL050kMG64ZMJh9A5wIjtXIzydGFQhFcXQ5MHqZRWaxy0lAE+VSqOMRssUQSxuv1/B8CaAtBVpXXTmNRGt0Y1hn3CGtAUHhvgcfxtMnerdfcWl5RSssx1zUImiZBFkwJ+BYBVHOBSstJ6GaIELm0DjnsPvow1+Fcw4kC1jKGIPIFtF9e8UYEaFcLmH7ZVO45ortuHxyM6pGwffbyLtrGKtWQOwLJSzCYJ4nC5iQCFdfO4OxsVFcsX3bwxMVHFDAytqavd1ITE/UzL6sl81KMHz0CIVaVMfZbJZI2MltW1qTWzfVzzy2Aq0kulkfSinItIxvPPY47n/oy7i88bpaIMwR0SIxWTkYGQguvD1ZiDYimxABk5aOuAAEhfoXH/wy1rp9ABVASGwgtq2jLOLCwr3BRM3Ioh2J7PCrRmsIGpRnXHR8gQnRBbR72TpaUezkkR3GLi7cYZ4HKZ5PRYTzMpxIztN+AiKfF/3t9jN0Mw/LAEO2jJAAhXZhVUcWHGsFVh7qMbhGDKKmhTo8MT72R5dOTeGJE18DogSUgSiXUatWsf2yy3Fb4514y47qMbuGGc3uSWLOh8Il67NdBsrl9J5CzhD1wNgUGVUGkiFBZqKGAwpYynv57khhZXy0dmc/d3OBTV0lOO4CCiejAduXlISWEsFaCA4QAktM1KCBGlAIoZ4kyYLWGp1OZ1ZrvfSSiUUpZFkGKSUgBJgZUkp4/z9ud/miCbOYVYgNk4EC8wcXJAPecMTX9weJGgxhGGQIsILPD8lBbIaG0KD1wGcZZAYHdZ0FSuAGgY0UZF0Ms+xzI4RsJ0ot6JADa8/+Dp57BF//+7/ENtWGiucQewET9QmsWcIzHSCOXYFXv+02YPPVTyIdOwQyj4qcbO7ibgG0tU4P90Xlo2tqAi3KYEWObvToyVEQFQ4RTN8FluygQr6AdcyDGeYG4s/5e7UgGxTzG4mAOMuEJfAATiKyhFhjiLb1sVaqjh20KuwJwNzDjzz78//+Px7CE888hzffeAs2b38Vnnx2Bd0zLVQNY/NYFde/YScU0Oysre6vJaItlFrkPKJSxv76xPhvIngkkuAQAaEghUKvl+Gezx/B/+OX331LnmPnaFrdB7YAeC+K55QzKC9CnUQgNecJU3nEDg08+cUHv4LW6hr0SAKRKrg8R7mUILgLO+oiONE6JHsxdYouplHRYEs1MPrWo2dxc2awj0g9LEXsBFaDDp8vWPEZBGabSnHg8kunfqecGuSWoE1xg5MqOtcvPnQUTz/XwtRUeUcicBQmBUVq+ZgbyvOdWuonQQV7k1m2IDQcA+0M7zvbDbd987HHkWcZVKkgJyVpihAUyGN9T/Cl3pIkQefkSXz13FmMlDTeccMb8UPvuBabU6zr+UqgNSTHXEAsG+z7RqDmPSZ9jikQMFY2uzl69DvdOQLb4ABn891am8NpudS01gEgbNtSuuOq7Zd9/KuPH0fI+4j9HtLxcUgjcerYV/EPX/gi3tt43RQRLJGaJfDSgME80D/GrNTpA4E58WCrTLnZ89i7mmHPV772dWS9DKjUhlyGDdyFAnUZCBfZYlQziDHES8yEosgGtBRQxAhc7E8TD241F9DNHALQCCSbcSBIT0QI6wQecQGXki/eBRioywyYugNGbQAQEAd0oV5m0bMBWcA+YmkTUs0oeFGQAoRfioxdADciOIkxVglkBYD6ePLApVPbdiVHH0Xf5UiSFFIpPPPoo/iTJx9DWQG7XvWj05Mj+EDC+vAF7Fje+Ex94SfPhDgg6uE8wIDWme7hzROVJRddm6ObUUm1CWZIhZYDpiMAIgkpFRCLx1Wy6P44BkgAcQC/xhjBzGZ4bkMIda1fWklHKYU8zyGEgtAaLhTM4iwfJNH/Qd/EiyVMxzQPbeAg5vLAu6FMQRUPPAuSA2o1QRozuCDYzlIYmdCiZ54Eh7q32R5ED2/znYJQSBrlOVAuP4/gsREgIQbyLNslAZQ1Ha4It5KgP4vuyvK5R7+Ahz/9Zxh1JzEmOqgqB+KANQusZBpu/Bpcfv27gUt2fALp5jth5WnksSaFWDIChykGax0jN+MoXf56tCpXo7v59aDLr0eoX4Nk4jL0s4DIZNer0IuIO98SsqXCFy7EOBdjbBRzAAFVxM48hgCjFfr9PpQu1HekNtBJCf3cDfYwUQ9C14NI5rxI4GV62InkoBPpA04kB6MqHewFauhUPXns6XMf/8cHHsJr3/hm/Nwv/BJ2vPZ1+Mzffhqu30FqBHy/jXe/6xbcfMPM+ztrvTvHatX9xphjwbp5KRWcx/ztP/kTGK+WIF0fsF3gzGlMjI9Bl8p48CtfxX/4z0s/zwYGRqHrqcG6dNAGIHOcRKEXozLoBezvBtzqJSaNwbFP3/uNf3vP549ApWVESOTn1lAdGUEMHpIKSgc4Dip5DGYeohkiJ9BmIc/zncYoWIfdk1u3oFYugWJAohXgLUrlChAilp9+Bvd/+TFIg1Yv0i4n02Yv0O6gDKJMirkpBLq9/p0cGVqJpX6f73ztdZO/etX0ZTASsP0uwAFGC6DfR7QR/+HQ/4GHH23d6oBpGMJqN9/DOj2sK6P7+o4N0trBro01Vaou5Sx2QwGlGo78/kf+C55YfhIjo6Pw3qNcLkNKOfBt9QWrN6LqnNs+mPUsaS2bYsAIFkLAeo+RbZNAnuPIP9yL/f/mN/AHH/lTSKAVIureYSpY1GOOGucww/eYoxpy1INFnS2MirySIB5V0a/AO4gYoJVY1EosMUdorQ8DPGBDRjBHBIf6D7z1RpQkkLVXUa6W4F2Os2fOoHzJpfjvd38af/Lnn/81SEAmcum5M2v39wPmyZSbPcfzMq0udR1BlEYWvEhaa327zyQ49nef+8KOz//DEVCSFpE9BJAo9rIHbEykiYEkgEM0xGwBrBNaivUdwAVMb66PoaRF4boiAZ/1kSQJxEQdR774JTz5XO9vyKSQpTLO9d0BR7oRSM92MndXFAosFFzgOW0Ka7M8z/fIgZ4qOEIrLMSI2thIDbVyCooWkj1gM0ilUB2bwNLffBqkYNNqevD46bV7WKVwTJCmBJmUjkTrJ2VaOpjl+U6l5AIBGC3jY2950xugEQCXoZIoBNuHKKfgEPCpT30Kn/zzzxkNHBYhR8y6syLkYNuf7Z5rHeytnTlAPpu13bV9rt/ZQz6HoQjFHsIXer4KQKLoaK/bn69Vy4vRu2mAYYxeHHapRifwPmBtrY1ypQbvPFxuwTEi0cXAZB1OZUaapoettej3+0jT9PC3M8OsVqvw3sM5h7zXK1CcweOd7w8KYuSg60+KeyPWhBBNZoYQoqM1nhRA2zmHGCO01hBCFKjH4Dl67yEE2kopCCE6398OkwAmaWzA7hBRl1K1Cpo1Daj8PDzke613OUltQ+BN7EUSWex2Np+uJvQwEaCkOqwsHXAczndU3gP6PKFjMAdtbGTZJpXa/rzb3UdK7jYlfRjnThx99uiR7WvHHkSV+hhNItqnV1CrpGBTwbNrHqXtr8X0TbPAlle1ohxZcJQuSnZDlmlDcmgyaCmSwOSV19HI2Pi9Mr/hxpIpLFHYelCpBoxNfsBZsfTKmkvKBcmOQGwyM5z3YJaNEMQmGlC0lSpmCHmeo5dbmJIES1Pss6l1VaCEoYoVa5zfG/MR85kv2IqXXzb64R+efc+HPv+Fo/jvzU/jb//2HiAAl159FU48fRKXbhrF7e//MXQ6YXbrSHn3WuvkgbFa5e7c+kkYhkmwMLVl0x+95Q2vRfPv78Pmqe0IwuD4N76OpFaGSsv4z3+4gPHR6gd/+ad+4AilpTwLDFnSBzgE9ALvJiVsWhEPOGC6F3HL40903vfHf/YJPHLsMSCpoVKpACMGvW4PsbuGRHqEUDhyCKAdmOvWudlE0pLS5li/3dlfHRnZSwB63d4tI9XyA1duv2zX8he+AiFSAAreWaBWQ7ef4fNfeAC7dl710ctG0vfmHvOiItsQQG4x3+m56VTJB8Ymxu8CgHPt7h6VlI4zyHzgZ+fxK//qN+BURGlkE/qtkxi9ZApZCzhy/0P4j//5o9h7xy/85puunfj10fro4QjgbLu3t1we3x+FhBVpvb2WLY6Mpwu9iP1/+onP/ebCny5CVyagtQZiD2tnz0IohXKphDTB4GbHimTZAjxCCLPwcSlIMRdCQIwMEhL9LIcslVAxAq7dwgP334dnVt77oasm05+JHlXJaAkOnfMrRxvIU4zGYG7bPD8s2TiHWx+zNJ9HUwPsW9/8emzfOoHl48+BbR+Zi7jiqitx6sRxrHZW8bv/4T+hlOrfe/+P3JBvntryryXQPHUu+0jW97uSGhYyUdpl+3yt0unxVOPAlx45zn/0Jx/Hk08/i/KWy9EnDQ7FjJ+khBTFepALoQjWxC1sgEDX54vMhkD5lokxjI+UwTIg9xa1kSo6vS7K1VGcPnMcS3ffg5+e/aF7N4+bm0RppO0I29NUHkqVNoEx672b5MiJjxFCSBitDoEjYmRwhFk71z1Ym6jsnblq+nd6n/wr6Nom6FSjE4uA3+n0ceSBh/CZLzz+e++84cp8Ytv4gYLdHA/WymKvlKbpMrenYggj4+P7MxvQ7dh9nJjkrW9+PbaMVWDyiLzfRn6ujc3btkEQ48STj+NP/mwRN153KV81NfHHY6Mj890s2y2EbNcmtu6lYr49WxmZOOB9hHWhgUAIgeudfu+2dqc7l+e5efW120kAOHH82cXx0eoSADibz0eRoHC6YSghILQuOj6poMiApfqO1kdeKmEOO02RJIhQBQluA2Oc+TzHgwtYPR8mUGZGjNxwwW0nIS0rmPUVohjhQwHxYgDHFwkXJnIBH0OK71/CBAhSiVbueCdAkFK0mCNicA3EUCOBRpomTUJYlkovSW3Qz12DiY3SWCqJEig/u18KQBoACPWh/JyWAohhA7RAzxOTY5AloRAioCMbcJiD7+/I1k6ju3oK0nZgRlP0VIp2TJHrMagtl2LzdTcBV77pY5ATuzMrwRANIDYFsEQIcwSeFRBLEQJdh1kzcclNRkwB0TYQ3XYSZBFiLe/5KdIpXskGLBFZIagpBk18jHGWYzREIhdSwoeIKIDABFIJjBKQCeGplVPYtHnz75RTWQSTCwlBxXoEyHR6GZ56dgWPfnMZX/rKV/HFB7+Ck62zECZFZaSGxGjEbA3u3En83K/8HHa9evJnYs7V3FqUyqV7rY9VJtliplkJLG3bVP7j+fe/9/Z7770Xbu0UMjKobRoDhwCXA6fX+vjwv/9P+Oojj/7R7tvnMHP55kOjJXkHtEQMqDlgGgCeOY1fO/bY0/gvf/AH+MznPo/RzVOQpRGcOdsGpAJCwMSWLeifWVmf2xYIK1nv4qQENRKtmrnz7yvpBCEwiDkfr+D3r71y+0c/85nPozyxFX0IuE4bppTAnjiF//pnixgfKeEnZxt/uWXCfKJzDrfVqlgsGRxJjD6qgaYNQNbt7BZEHS1poW+x74ff+eZDN7x+557PP/g1VI1Af/UceucEKuUK1vpdfPqz96LVOoMf/5F3/U7jB9+O7VvUB3StvOyA2V7AdDJaOqqA448+nX38Y3/03/Cni3+B8mgdnUCDGWZBxJBCQAiGzXL0ej0IgTYRWQKBmQ3HOMtCJAX7UgAU4ZxDuVSChIeNEU89+QTOnT0DOTnVKuAh3xGITXHxPI4GhRVfOD/HBpH284nyPLN2mDQJ0V5zqbnjF25/30f+53/zW9h62ZVIEsITTzyGkdHRYs/o2OP4d//pD/C1R77+kXe/6wfxpp2X3VEeTT9bGk2PnAs4oCtyGQBOr/L+/+vTf/vR//zRP8SXvvwIRi+/BjZGSA1464CIQgtXFItscX2EEa1AbF6whj5gFwtG5/JLRn595srp3/n05++Drm0CCQ3Oc/hSBFSC3/+D/wop6MZ3v/tHeKSGT2mBugu4CxGoGNwpSc8hSPgQGwLcFEIgeDcniawWcqmcaCMATF86ibIppPfyrIvQ60NUyhjfOoWnnmth6dOfgzLpR2ampzBWxccsiZmqQoOUbho9dqiX9Rsq+qb3YVZLtcxAcvVU8v6f/vH3fPzQH/43eAeMjtZw5vRJVKtVJLVRfOnhR/Fzv/Lr+J9+5Y7b/8lPNh6gStn2LG5Z62O+VMK9slJpPbka758YE78LJfDgw8/+0cc/8Re498g/wvuAya11/LPd8/yeH7qRyrWRBVMqLXbOnb1L6tIRo7HUsjiM4AtiVwxwNoe3drDOKddfg1fyFmMcrKt5KF0wuQfQ7gUscWYutiQ2zO6lEC0anEdmTjieR6AEiQt+ltZXfASIYDnyoKj6PgsXKIkl63hGKbGiBC0F22+wy3doKdqGgNBf2ydjrGkFIPISbH/GBzYiliDg52TMdyLEKkypAfaT7HMQe2glNt60z5NBGN7MLnNQpvQwIRhYO4O09PBV116346Q7jROPruJkP0Np9BKc7eTQ5Ulc8473Ape+Hr0u5SEVc0TCEtjGwcyCgEXesLzgQ5xU2iCLgM1DnYCW0WoRHJGFfE+iX2i9+TtLmMNDIpWEUmqJjIK0uIWEQFoqI3cSfevBTBBC4blTp/FfPvZHkOzR6bbX5ykbro4ZzoF7/Qxr7Q6y3AFCQEgFZVJACETvIHzA2dOn8RM/fht+5id/vBUDqpWEDnXOdfeOj9QOdjvd3TotH/Ys0c+wJ1V4YPadO+/+y7e9+aOfbP4tNl9xLVb7fVgXUKpUkVQqaJ0+hT9euhtfOvo1zGyf3POqq6f3XLH9Mkht0LMRz548i3/44kO47/4HELwFR4IpVZEzAGNQqtTQ73aQ9XsopQkQu8MZplVKLDhLuyMKEYG0XP2UzXJEkhipVe5goHH19ktRKidIBUMnBmfzDqqVCfS3bEP36cfx+3/wf+Kvm3ejVkrft23yMmghbr9m+tLb3/rm1+H6111xh2Y86byfrk+M7e/nFokyD2uJ5Ts+8LN7jj3221g9cxK1ag29vIe1DBjfvBW23y0IQE8/i3s+fwRXT1/20fGRGq68Yhp5nuO5U6fxpYe+gq9/43E8u3ISnW4f2y7dBO0isjxHkiQoV6rI+n3YvIOY5QUBKKImgZYQAlLKRZYSJNGQUkIphcBuUEhI9LsdaK1RTkuoVSqIQJWYc8HcFBvodnyxJNe3lBzZgChtuPcFQpu9MPM/9oOf+PNPfPx9jz17EqY0AnQ6oPEJlGpj2LZtK5468Rz+4I8+jubffg7Xzcx85LpXvQqXXnIZ0koF3SzHgw9+CV/7ykNYWXkWnU4Pl151Dbwq49xzZ6A3lwBvEeWACTFguQYu+mA5UHeK655F6+QgCyYkAg/fdP0u/OVfNTG5aRt6HFEdHUFndRXlsRGcPncc/78//DMs/MXfIDXqNiMJ47Uy3n7j9Xjvj9y6e9smc4dWYqnfC3sUwqykuOSsvVan5lGlJdhhUQK4avuluHr7pfjK48/CjG2GTAxCiHAskK128Sef/Cvc87l/wNaJMVw2ufXnRQwwIv7NT7/vPXjNzBUPT22u7bRZPhe9q42Mlg9nLiKyaPziP3n/A5/+27/d9aWvPQ5TrUJwhLcOtZExpMbg+Lkz+O3f+y9YWPrM79x041tw01tuwKWXTCE7kb2vdbqFbreLL33pwT/63N//Ax574glkuYOQGpGBbzxzCi77PzBz1RV87RXbqBBYB4ZEHYrItSQYQfBgeOvgnQNLAwhVrOe80sQymHd678HOwbuIIBWIqBB9v2DCdaFIDBE1iQClVFOzNJ4wGYHaMNkKISA3TBOHHeZ6wpWyFb/fCTMGBqJFos2CpoBe3rtZUagnOnkYbKekZCMR6qB8J9hNV6SfhFErkH4u9DuzKMnT6OU7QKEOIzqKhoo2XOiQXaSkwzRIBsMZaqRZbdIljjmszfabtHI3pmewRfgdUUg8+ciXUDUp5OYqtl33JuDqXS3Iid91HXlakIRkt0RgRBLwkA2GNAPRgCYxo2rkIURXKLwIscCkECBBkpBUS4fYB9ArSJhCiGYMvsExglk0pSzMfplhcuvgQoQvWkxAa6hEwWZ9PPLNZfROn0CpXsd5lZGLlk5QCBsnSRXJmF53Gsh6PRARRispTj79Tbz9Lbvw//3/3PmJqsZSttbfpRPZGB0dPdjt9mZJmsNMEkIKZGvZLm3SJ43G4Tt+9ic+evrkcfzD0W+gtu0yJGkJ7cwCKkGyaRI26+Hhp07iyedO4e/+8X5El6Gf5bCBIEwZMGWQTKCVwsRYHe1eH5mN0NXR86JeeY7UFBViDH49hCulVwix6SNQKleWVs+t7TFJesgowAPNXa99DW54w058/oGHIap1oJ3hDBGSchnV6ash2OHL33gKCAHy4ScQTp5AOl7B7LtuxtjoL33ktVdtJp0kkzEE+DybryZmIQfwg2993Yfn3tP40J988q/RzzrYPLYJq70M3f4g6VfHcKbr8Fd/dwQC92JTfRzdTgfGGPhQQHouMJLKBLaMJ1h55hnUtm6B9x6lUgXee/Q6HaQaSBKDarWKGAtlomEACABiRDWEgBDiQP4O8AOpQikVpFQDpu+AELNBeeaFkJoXGrVcrA/NxBeCuUQgjla60KpKufRv/uW/eN+v/S+/jW8cfw5bpi9HxwUwCE8/dwqIQK00hpMdj6f/4Uv4zD9+GQSJdrcLFyIQAzZvHoftB8RAgA/o9dvYdvllONMrBEKIJZhDoXgDQgDBMwquNRiFMMSg1I2F4asAtW1OMz/w9pvwmmuvxrNnViFrW1CqVtA520XmIpLyOB4/cQbyVBvbNk+AgsXZU1/F0a99Hffdf//kb//Ghz46tTn5mRB5k1biSS0F/GB9C8E1eu3urWOlLfuuu3rr+99x0/Uf/8KXP4p0dAK1Wg3tvgXpFGryMoADnjq1hqdXTuHYE8+AnUW0PXzxwQfxK7/88zt+af49SEvJouOA6HL4frZbJOWVrTX9pj0/fzv/u4/8Ib7y6OPYcukVgExw8nQL4/U6RmujOHXqJE7f/zXc99Un8J/+8M+K2b+QqFWraLVaBfdBaiRpHelIMhAyIJRg8fXl4/j8Pz6Ayy55zyxZi9p4/U6bZci6dn6kYu4Q0e+hGKCIoIxBDi4EPEgi8iuHM8VAb5uIoJSCGwh4bExwtHGPn7mxMXF672eNSZa0UEshYrcPmPTeI8QAGSOEUAOCUixkFZkRAupcFF9L3yPt9Rcm/RAzfN6fh88h2UEECxHynakmCxHq8dzp30TengNnuxD6N6K3ugf9c7tBdgZkr5XCTcNlu9za2Rn0O7cBoZ4qUSSg6AvbopcohZkIwiRLgQBPGqxKRxDUcYTkKDZfiW03NlCdeQv649dg2+vfifKudwKhdCTklFdHxw5J4kXFdk7CzjO44UlNWqFnrNAzEXKWwEDe3RM7Zw9QtrZfR9eQYDgbdvct9rmAOX6FzmeDgfY6yyyEAF/oYU9FBvpZDpJ6QIBQCCxRGZlAZWwTNl1xDURaBSU1IBlBTEcR0vHivTSOUJoAVybQs4SzJ8+itdZDqTKC0dExcPRor57G/E/8GH7zQ/sworFAEbacyHvAAXmeg4Rc0kkJuQvzkYFSmhwh9jl54Ja3vIb+xT/9BWyr1xDyLlZXzyCCEKRB3nOIbDB+6VVYzSJaGSOXZZTr21DdNImYVOBkAlUeAekUvdwh62eAKOyRsrW19eVlm2cAxyIgAlXveY6EbEqpwDyAqoW0QghkmZsNHo1dO6ff+97GDyGVwHitjPrll2JkbBR5r4dOZpGTBtIRJJsmUd40CXHJNDKW+PwXv4QvPnQUAWiABNbWzu1LlGwFa2EAaMby//PXfvlj73vPD8N1zuHsyecghYSPET4SHEs4maJc34batsvhzQi4PIFVK9D2EnpkM9hUsNqz0JURTF49gxCBkGWIsZAXg/dI0xREhE6nAyLkQxWogYTebAioxxgRmSHkoEIPEeVKFc57dDodrK2tQQBLzxd82LgL/fz34b7e+vuAk1DsHGLwTg0GGgKxWVa81D975sabb5ihX7njF3HZ1FacfHIZznn0+zlq9S0w1XH0POH0Woa2BbyqgtNROFVFdfIKpFsugxUpug4IpJCkBfnpuePPFGxYLQvEiQstXSE1SGhYhz2iIIXNEnNjIymQmJsoCu/2q6/Z9sM/etu7sdo6jfa5Mzh96iT02BhiYIjSGKgygSDLONW2ONPzsNB4+sQZ/PWn78HXv/lEvZfj5ghUhRBNpRWUFG0BwObZrtFq5e6smzeMwOLcj81i1xtei7MnT2D16achlUb7XBs+ELxMUZ7YitLYVvSDhJclVDdN4tg3lvH5Lz6IUx3c6was57zf3SeinSkrNNkx5mbf8TN3/OLPY/ryS3Hy2WexunoOUido9zK01nrQ5VGk2y5DaWwTYCpgXUEOhdNrfYxvvRSV8S0QaQ1OGPQ9oeuAvif0POH4ymmsdnNog6W+dbsAAkeeDc7WBYDoLLztIwYPo/V68ZfnHtbHV9xhOueK7rIg7hRFYQgIzsFaCynQoQu7TDN4BzM3QgjFvRAZzDAbFYa89+sxdeNOaIyoDb42+31lyRIAI2hBI0CxbyDaPYZCHZossrXbn37sa/jy3396pvvUN3ehc/a2s08c2/GlI/dMfvMLf//BcOKpfwvXv/HUI0d3PfzlL+H4E4/djuCmIRgU/YCezUCBM1u8sNoLIgDLmI9CNIIqNbvRHOs5vQxT/11svubDl77pVlx+w49g7FU3Pol0y6/3c9Hu2ljjwBAhh+b+TTrmOwDAE01ZgRlLmAkk64IjFPKdRrlpI+2M4t7NCTukWh5WCisDSazGK7mw3ofZQXXVJCI45+ZiZKQpHhgfH4dUGmm5ApIGyCyyM2fRObeGU6daWOvmcKzgoJCThoWBpwSBUkQqIVKKmAHlrZdh7MprkVRGcOLEKZx67jls27oFP/7eWfwvH/pXuOG1V7331Mmzd6UCC1rQYmJ0s9fr3amTBJBAYNRjxGyS0OFEiof7a+19koF33fwW+g//7newdfMEYq+L6kgN0QWgPAK9ZQqnv/kU0k1TMCObwKYCRwY5JAIkwAI9F6GTMrJ+jte8/o14zWtfD20SpKNjkEqhvXYOHAMq5RJGRkYK70LnpmOMs0IIMKGR5bZhktJhIkKwtk4xNjWw9CPveif+yU/9BE48+wxaTy6j02kDSgNMsCyB8ghkZQztvoOujkLXxnFytY1nnjsBB2wnKW25XD6glWwiePjcI+Ru00iCP/6Fn/sZ/OSP/yi2TIyh3+uCQagM3FCcDfAiQQ6NMyst9IJEuT6J0S2X4fSZNrIoURnbhGeeWcHKMyt4160NlEZG0O/3IaWEGjDD89xCaw0iXJAsmdlIiVaapqjVaoVZdpoicCyo1c5idHwMSZJeuHBzEQrxwsmS1tGK8ytg1Iig2WLfl0xBMCuUbYgZ5PPGWFl/VgH4mblb7vjlX/wAtk1vR6lcBkBonz6LKDQqY5tQntgKUR5DxxHalqFrm9DJgaznca6d4fKrZiCTFM+dOIk3vOENuOGG6+FtVnh/EhUEESKUKhWklSqELHwoC2WrQp91faWoEP2wEtySQPNHZ9+DH2n8EMZqNbizZ6GUBKRG1zLY1CBr4/AyQZAJxrdMYdO2SwCV4PTqGkjCKqVX+LzvbkJKtohDXaa66fLejl7X73311Zvef8cv/xKuuOqKwg8szwGTAkkZPgBZEMijRJ5H9DyQBcL4ZVfibCdDJ/M3rrbtgpACxKFeSc0x+GxOhBwGWPjR97z9Ex/8Z3fg6mtnEJlRrY2gaM4HHRlHZL0e8jyHlAKlUgkmMTh18uSg8CIYbQqC2QCx8THisquvxevfdAOKdUvTslkGKWgpTfTBGIHRkQokAcFZhOALmNkHQEhUR0dfcWKpVCoYrp4MZ5kxFspRaZpCSrQ2JEGzMWFG5ioR2cEcdI4ZSSJxtFKpwGgzYJnH9d3OJEmQJAmUwvFBg1L7viZMoKB3G22OQegmSLZI6mWQaKPTnnn6iW/iofu/gPbaKlAqraz1Mjx49Gu4/6GjaJ1dBarlex788pfwpYcewDcf/wawtrodwUIgQBMPdMr8lGLfVOxnJYdZyWFJFua5VYEIl9vdgtEmQjPGOAuprS6N3Oll5e6sR7a69apf3zLzxh+Oaf2uc2f7N5VG6vO12sj+TvvcHkXcKHYEOaGC9NMWjM5Ao9UOBeKh5GmAk9DrzPa6ax9BsFACC9GjRojNQfpOXmQjMAeoOXRVKOTBYo0QIDg2o/M1CYKWBoI0IosaiJAoHN2yeTPyfhch70HEHFAAjVQwsmUTTK0GUy4XxsAEaGIowRAUQRQB+MIeWHr49mmsPvs48pNPY9uowa03X48P7f1lHPxfP/jrl47L9/ba2S2XbRm/1uW2QWDk/Wx2Yrx+V6fT2RsDYLQ6xjEa9oDRopkYeazXXpvXArj5zTPv/8i/+9/wnsYP4NzyMVDoQiCHe+4ZlC6bAvuC4eqdQ55lQAhIEw2TKJTI49xzT+Lay7bg3/+v/xK/fPuPwp55Btlzj0PZNUyUJEoiYrxWwcToKAhoxhhrMYRiTsFoBu/rWsnhftgKcUSv6/ZevjWhX/uVX2p94Kd/DJvqZcT2aZSEhSYH5bqgvIfemVNINEC+DwmP0VoZ27ZugQJWhltBeZ7v1mkKm/V3j1b0XSeOr/7eq7ZX3vu///YHP/xzP/1juPySOsLaKaydPo4kFUAiYfMeIAXU1i3QpRK6q+eKYK8UqqW00DC2OT6495/jX/6Ln8LMFZeCO6tI4VFVDNdehWaP11x7TbF7ytEEDogca1Jg0QgsjlXTu7eOVYD+KsZSQhoz+M5ZCJdh5srtmNy2+QEfMb+xszwv/8AXvV9gsbmRADR06LDEKN6B4cdNAOj1ezen5dJCv+/nY0DtAz/1jkOH/v3/jqnxClIZoROBmHWwduo5ZN02yqmB1hLeWUSfA71z2HrJFsBnOL3yDNonjuOtN7wJv/Phf4kffOv14G4LxreRhg6S0EXCFrVUoVZOntQSC4VusFmIpJYiyeZQUpNAoIhmr92+xVvMvubKOv2/7vxXuOn116FWleC1FSh3DsjXQL4Pg4BERLDtI++14bI+orMwWiFROKoNLVsf9uS5K7RVlVkSJn2ge6595+j4+AEpqOUDpt7XeP2//oX5n8ANN7weOHcS6LZQ4gzk+wi9c0hkRG2sipFKCnY5bOcshO9japP61ZIxRwDAOj8FpQ9nWbZLCkJwaJQl7vnZ97/1dz/8G/vw5ldPo3viCVQow2hZIdoe8u4alGDUKimMlmDvEL3DyEgVo9UyEgnErI1s9SRip4USMmwqC3zo1z6IG15/yc+srrqFNE0OmlIJLvJshGhIAVw6tRXjtRQGFsr3oHwPKTlM1FJcPrl5sCEbAMTG0J84kmhEEo24LkBDz9+PHnxu22bzifpIBWXF0KEPE3qoCotNVYPJehUSOF24Gq7vXtuCAxhBzFYptcAgcIyJFGgJoDNWLWEklUiRI+UMFbKoqYDRVKCWKmjCopAKoELs/3vxJn/jN37jBXtMa+2s0ulS1/J8gPlTIfWijGEX2N4ifS5LpRSXXnEVdKX+8DkvLxMjm3HJVddi8+QlnTQ1j/W6Z2eumLkamyYvwdhICpx7Cmee/AZqI+OoXL0DkLWWYpWI6C+TMdQlY0ohXi04bBGIO5Wkw8ThmIgOCuGYRLyaYng1YhyThdVPP/pYY6ZgdPJwDHEmhni1UaIDcKmQ45ItJpqSHP5PBU5M9I8ruL8QCK8vLqroQOinYUr3kU4eYcIUYnxMiXDfUNcVHHYpFepon7rluccehXcOl1zxKlD98iOe0k8FiFcL5r6BnST4KQCXEeNoSadHEVCwPIWESc1DjjG72sE/e90b3nzVP9x7BKdPnYA79RyQSGhN6LdOIfS7sIiQPgfZHjjvIfbboP45yPwcjD2HJF9F2a+h4s5iZmsF73vXTfiffvGn8c9/9n0fe9vO7W8wjCPRuisSSf8xBg/BeAwFNHIseA8l5X0cA4jjYwLxEXAARw8SdExIeTSECIa8+pJ66WNvu/76d77mmitq3dPHsfLNR+B7Z2FCDhMthM+RSiAVhJh10F89DWG7GNce77lxB/7fH/pVvOHKsfcrl//k6rOP4bnHH0HonIZ2XWg43Pnr/wJvv+G6nxHAUSVVIoC+y7IbEqOPStBRHthhkcBjQISQGA8RN5QSed/b3vLGMDM9NRO7Z9B6+psI506jFHKU2cK4HlJYtE88Beqfw23vfAfef1sDk/XqvGBxVBJBED0UvYeU4qEQI8rl9BscUBKMzq43XffMda/fcX1t8yieefZxnH3s6wB7lMZqAHvYXgfR5qhWy5DRIV9twZ45gR0zV+JDv/ar+MX5Nx+pGpyTXm957JGHcW7lGVQQ0D31LN7+5tdh3947WqMV9V+F4CUf8vkQ3bSUVBYQj7l+74Y3vnbH9f/9L/8CZeHRO/kMuk9/E2/etRP//Jd2Y8c1W/9pcKgLoE/ElwN4rID/N6hGDdiwhXPSBi1SXPDxYwQM3vkx4uHHRchTJvnbAIKLvCtGMV7W9PlLNyVH3nHT23/k1VdehueWH4Ntn0Hv7Gkg5DCiUCcV0UGGHnRoQ2VnEPtngWwN8z/149h/57/C5XX6rcnNk7c8dOSz6LWeRXbmWcT2KVxar+JX7/gF3PC6K8Z7Pd7PJKcD1FWB1KsZ6mqCOlboPReEDyVUTUD8hZaELePJb739+ht+YMfVl0271RWsPP41IO/Ct1tIYh8jKsC1W+g89zQ2j5bxA2+7AR/8p/O/ywFljihLqc4xaFpo84z3eCySOko6+ftQWHnNxEg1o3DsjTuveODa6StvveKSzVh57BHY1RPwa6eQxD50yBD65+D7a9C+jU3a4n/+lV/Aa2euercivi84i6RU+osss7ulTh4Ow+sdsdWQOPaqy8Z+9t23vPWmKzZXrlo98RROnT6BbrcNuBypUUiMQvQezloQM/rdNSQCMOxh11qgbBWvmZ7EB94/i1+/42fxrhuvu0P62CopfBgc4EIES31FJFnNI/3Q5i21vz2xcurWbzzyFUjfh++dRef0cbz7XTfjn+/+6VZNZP+b4mwvC8qZxCOB5FwkVWOSZYaYIcYjggbSE1zM0AUEIhNclHNaY3nr1u0/9tB99+KZYw9jcryM3umnMb1lBL/+wV/CNdu3/lb0cRocHyEhjoJwTEmxCYzHJNGxEOKsUPoYCXk0sNgFgpy+/Iofa6+expHPNFGvarSe/ga2jWj805/7Kbzj+td/qpyoPw7Wwhh9LHyPhpjU7/dfmA0kJFwEug77KxW9n3MLkZ35SFryU+ievg0EIKmuoFT/cERysOt4LgZfS8nOJDLU897ZPUxAkJXPVsqU46G/uvXLd38S49uuwOW3/iQwcu2hSNVPCYQ6M+BJr4CoKeHmBVEeWHQiUfPl/mHnqfIvSwu2WKzmAES3OzV+CseP/tuHmn+OrNfGW945C1xz4yErRu/IWc5Jjosl7u8lDvVIejmwbBGLpRAxyyQsSd0UWiIQkDnsyQJ2HXvi+J6//8cv4osPfgWdzEKn5UJdSQgkWiNkXYjBvhIRMFyq1oKgBON1r3kVrp6+DK+9bubYZdtGr5UoHEyCzeaYORFKL7yUNdu33KOK3JAmaUol4AA8eyo7/cBXvlb/7L334atf/waeeOppdHt9eO9QThKMj43gkqltuO7aV+G6Ky/BL//UD5PrZ1BJChLAV489xf/9b+7Go994DNqkaDQaeMsNb/7s+Kg82DmXz5a0uFdLPMnemWqlvGT72YV7wWDEwmuwEUFVY5LFCKCT465vPr78oYe+/Age+fo3cPJkC31r0c772LJlE1776uvwtrdcj52vuuxXDeGY77nJVInDhcj+0ItxoFNTkBAaTsjt0BptYO6RR5+69R/vfwj3PVAwYU+fKTw0q5UqgnMYrZSx87pr8YNvfyvesuuN2H5J+VBJ40gBbwKf+qv7PvKn/+1PUStX8I633YQbrn8DrpvZQnnu5rXiBWY766yd0UovG11adHnEuW7+ka8tH99z92c+i0cf/Tpe8+rrMPvuH8GrX3Xp+xWw6BzmKcZcIHaI44ApG4d7zoW9HonmK3n9mRlKG1jnG90sv1XqtFWpmrsC0DiX4eefevbM7Q89/AiO3Hc/vv7Nx3Hi1Bm0Oz2wkKgkCltGUoxVUrzxjW/Ae979I3jdjkt/VQItFzEtgPbjjx3/vb/85J/jqeVlXDG9HW/a9Ua8/W03vT/RWHzuxOo9Y2NjhwbNcS4YHcFoCmYI5gYBkEo0fWGW3ZBGNEkBfYu502fP7m+t9XZ85sgDeOKp43hu5TjyrI8YHDaNj+FtN70Ft7z9bdiyqfrrxLAF6gRLHIdIkR3AelVjzKIPsdHP8huF0u1SWR3IHfastrM97U5/16PffAxHv/oInnr2OM6uriG3DtokGK8Y/ETj7Xj7DW/4QK1WO3zmzJn9SZIcNcYshhCQpik6nc68MWZhsLPYSNO0KQc2cCur3YW7v/jV27/yjSfx5a98FU8+9QxOn11FljsYk6BWqUIKQHLElvERvHHHq/EDb3sLdr1ux5NbN+m9GljiPIdg32Ciob4zIsnZCFGLRFVjcKjdx8G7P33PB//yU59Cnlv80LtuxbtubWD7Zk0ya88p2Gs96eUAtRBIz0XIWpEYuS1jXJQc1omcA01dMAk40g2raUZItO/70jc/+onFj+PE8WdxxfTleM8PN/DWG15LNo9zL3V+c+cnpU4ORxKzEbJmUrlgGfMPfeWxP/rCfffj/vvvx9Tk1sHr+dZ/PVKiuzgCWbcznxi98N3YJf2OEiYxwEKh52mfMfIYudwa375Rq94tOPn0zeAIJBW4yqbPhmT0cFTpYXCACv07ObjtSWXkDg+Frpe7R2V+OP/SX/IX/69PYtOlV+FVjZ9EqF5NXVGeFwjtyFzzQk0SwUq4lmIsiFD4tL18LdeXv0bJAFiicB0I1pSNncHxo7/zUPMTyLtruOGHbgOuueljjkb+OGdtBOJSkTBjzZN5NBAQYa9ljlWALEG0pVArQqgFQQqEYjcv77lGlrsdiUmPaSWWQkDDO97uBXV8ikkvMDUQmrZSoiWB0wLoDKXkNLAwNEvLMzcbbF7XShxOjC7mEa+EPi0FrPMILOZUmi5CAgGYXctx+5k1f3un20e70y30IgVQTgxGaxVs2zb6sRGDP06B5ukTJw76wFNbprbNMQqR9k6OuxhIygnuocJJasbn+eRYLbmTXUDW785Xy+UF78L6qzFMmMW/hEg0u9bp3Z6Uyg+bNHmUCNZFTDPDKFnArmsOt4eAesngSEngXm8xRT7kiaRDElyQz14wYVJDAE271r6rUqocUeXSUu6A06tri6fOrb2v3cvhGWh326jVqpgYH8H4aOWzJaPu1RLLkkKLSNhO192WptUHBFHHaCwIAvIMc/1eflO1kuyzrrsnLalDRBHW2t0xElJTPqykgo3F+etYHHAW05UKmprwZK/HNweX1xOtHtaSlgXiUmELd4HU4itOmASGy7O9aZoeFEohtx428G6p05ZOxFIsXsvZCNRW+9jTzXDz6loPZ1bPodsvptmT4xWUtMDmzZs/NV6j3yeg2e3hLnBErSLuJAAnTpy9h8D51i0TDWYg62e7tdaHUyORZ3aD8PhAh5nRGK66S2OaMQLW+0YAEIWsCk0dodCMQCMA9QhUrce1QqAdHOrO8nSlRHeXFA7mFrsFc3uw77l+HYdveZ7vTtP0sJQSzge4yPNSmZYxojmUfrCMeR8xqSWWGUgGv7OWAEdTYEkB6PV66Pf7d46Ojt6F4v/zaZouhBDWZ3z9fn/OWnut1nq5UqksRCnRB+bXIm5fPYfbun2Lbj9Du9OFc4UWc7VcxqaxUWydoD+uanwKEQg56sQh1xSfNLAgxOq6LzGJZhwktAgxm1m/y6TJMaOxMHg955zHdAioy+BaNdFfEeymA6njgdRKhAIPtuoL6dPQHIzQGuddhQozDkcaZx0djlLVRipYIMA6j+lU4aAAcOrUuaWxkeqhlzq/gdkIqZdCBGzkPSpJV6TCUgQaecCOXo9vqZTp7lQWj5n18t0hz+pSoKWVbAmplr6vCbPf7d05OjFxV8di3lo3U5LxSCWNTZx6nP/x7/4Gp06ewK6b3oGpHTd8OKfk4bXM7yiX0s9WNAMh1DMn2hZJrevlrZt1vrv30BI/+Nm/wrbt1+Daxk90bGl7rSuSvQLcjog1J+Q0EXIB19GMZRlES8RX0GG+gs1VBhpRiio4QIS8UzF2O5798ke+3FxE3j2H6995G3DNTZ8IYvRwxtoSuFnibA/AiaPkYAA3QHZGUKwRUc6REw6xKpislnqZhD5sO739xiRHkaSLYCrWS4YkDiGQOQcnxFxk1BhkmESCgoqdE8EajcP9ftiX9/s7taTlcindnxiJ6COcsxcY3L6cgKloIGgNgvVoZAG7oBIkJTo61Cr1wJQA2hJoCWApRMwFj7oCr5DPbKWcNgHC2bXO3tzzjpHx2h1EQOax1zlMG4VHEQEjcShVgLcWvW5nX2qSh4VQA+NoXleXGhZBDGokSdoMADIbdwsp2koWe7YuYHe3h1srNdztgSkR0VbAcZ/FqUoiDioBnDnVOjBaq+wbOqFsTJiRaFYHXkqkApxvAALQpjmUPQ0B6GR2d3XEHOb1+Y1H5LwRfb6Do5sGyBpT3ecsNyLLJliBWUBKAa2Lrape1p4ziVqEYOTW7Q4eNaXS40omi0xA18a7KhVxJwBExqzNMVNKcUAw0O/le7SSTxLHJl0Mt/JAz5UILz9hRojo58GhLqU6LnSyCBLIrEff+r0+YpKUsRGiJoxqG4NjKIJunQGjgBUNLAwVQ7tdt9fafKZWrewVgpD1+3vK5dIhJc6zA0KIyPq92RhjLU3MgohujhBrtO5mRDmx6AwZv1nudgitl4XWiywlPNDwjEkXeLrY2YORRK3E4KiWWKTiOqLftfuczaarlfKnhtdPnDc/aGzcBYwxzhKRlVI1mQi5Cw3r/EwE1dJS+YEQURdKtKXCUmQ08hw7QkRdSyyT69lEicPe+1ml1FKapnDOodvt7jHGHBoo1jSEEE2liv1E5xycc/OBZB2mAgdMS42WFDjNQGIZM4XyGlrRo5YqPGCAYxJoBocGBd9MtIAUgM+6cwVpqhCgLxKnWBo6/Ah5ft/SOp6LzDWlxYqSaCoAMVubF+wnI8lWgGwxySUe3AQD1x8Ijg3BsSrAyXqtUWw2LKBUwsqZ7B4hRLs+ZmYjoxEDqqnCIgDY3Dde/PwCUqpmYEZkwEXM2YBrI8mqTvSy0RiiD7AWu4PN66kWB0pGgWNAlvXnhFSLwHdfvuDFVaAv3s86vzEDAOh0OoXFjDHHElFaKJGfFYKaHNyc7We7tCzfI4kWIAiKGYYDEvbQMQdct6rTbLeCOC7gOhGxDS6EVgVsm4gQhapGknOvIGEmLz9hCsMkDFgOBaLtebB2eC1itSD58MJQnQggW+wxEcjTQSGKHTvmCB/8nI+xBhZtKQAzOr4fAPJOe4/N851a6+W0VD6AEBr9Tu/m0mj1zhRhcUCXRiSByENPUUK/ne8zxhyrjlcPSAJCBHLrwTE2iESTX9Kc+VsnzOjzvaLYjVzWSbJUErppA6Pbzu7s5/bGSrV2dwihHgk1qVRLSkDGsFikWIYLbr7f8XORREcK0Sql6khwmBMKHS2w7GOY1FI+CQKctbujjS2BuJRovSwENTcSVnjD8xrItzXPnj1zl1SmpZRZIWjrA80xIyHAlhPcc/rk2n4QYWKsdkApLPro9nIoNCjTRB89L3r/QkZ2hNjO7hQRVQbBw98chegIYx7VqVgcrZrD5871d/uQT3F0Va2BcskcM1qtIHISnNveO7uyXCnXFmGqTdtZ25fbWCtNbNoPACefe2ZpbGL0MEc/xwwIEm1Sqi2E6viAuRhRS5V4oNvO74ox1Iw2x1KjDogBg75STg456y4gWwyt5JjQ/La0C17q9WduaKMWYmb3u8zO6BjqQusnDQHKiIOQClIb5C7Aejcfe1SFECASuRBoK4kF2+vtZm+NEKJTLZUO6kq1uA+cRSr5kO93Zk25vNTv92azLNtVq1b3V6vlJZtlgM93Swp1QqgPnI4sINqAaDNEG+BOUjIHAgghFlJ6pGRTK0BpahDQjC7OInqEvqt3nbtTSnm6lCaHJqrmAKALotogQA+9VzcatMskhe/36za3M1GqGSHVcQWy0ohjSummdf2GiNyODrVIYh4AtBDLlSQ9oCXQ85gd+EEuee8b/X6/SURI0/SQlBJSSnS73aq1dm+apgdLpRKklNBaLxTSiFysJnk0AlPdRd6EwNBSLGuNZSHQ8RlP9lx2s0KcSRUdVIiztpvv9M7OlMvlewoxi0L1hsAJg+eYyRKibZ87d2utNrJPa4MQ7aJgbiRIm94GnOu291VLciUWjlJ2Azv5PP2xKDDM8KwJYgNmA+ZEgOZWz65du2ls5BZVyFPOxeBrHIPpZLxXCmopKRZe7PwSF05V3vn5SKKtTbootURm/T6Xu+ng1Z15nu+QglqJVkfLpeSABBfKWhyQmmRxKLH4feowi2DLpNALtM8YfYxs3xrfvlWr/o04+cyN/V4XqjIGHpm8m8tjh7wwHY7BSNfbJYKfTFT5s5DpQh4VEtGd4wc/+fEHP/cpbLr0Clz+A7PA2DUfzmT5swS3fdBhtoqE6aYlRJujXgYXTt8vM2G+7LWQCFUNwtSZkUift0ZMZvDsgx/9SvPjcJ1V7Pqh24Crb/osxOjhPsxhBiFhO89EuaV0MbKa5X4+aaRqSSkWBybFjcjRkKAlENDtde5M0uSo1GoJYJAgSFUICbt+Z1+Z/ZTkWC0sjWQrkmgP/2WIjtRJUwxmHtbauTzPd4IZSZIcLaXponf2ZYdNwaGh2G0P3k07H+os1IoypSMqSZsk5HoSC4ELhZDgikqTOBGIVSKyqlQ+HKyHi7EhpG4KbWA9o5/ZO613M7VadVEJLMXAyLPeXoV4vFxKFgUz+v3+HqXTQ8UKxIWFWvH/gXwcCCFww1m/3QU/rZReKZfKB6Uq4F8elDveeuS93l6j9HI5NUuIEcH7YuF52Flu6DBFFEspVKEPRUVnEiLgGQ0IDFRIADVsoTig11690+fZLqNFOy2p40jIhnZ7jlkvq6S6FDxZH8lqkywIJZC7bC4g1iKzkVI/KWTSJCh4D4SIuSTB4hBwYAayXn8+y/q7pJStcrl810Zj4YuLnY3aqy/39Re+f6MkNiTVCki0Ywj1EDmR2jwqknSxvXpuP4RskVTHjUkWpSpMBKxzs97mk2PV0iHvbCOEUCeinJkT7/2klLKVpunhXq+31xhzrFB1Keyf+lm2l4jySq18CP32nUAx0hgmTB68R4iOKpWbwUdkzjVc5O1MIoEQiMw1xIBaou8yqriAXAiAN2KM1Rj8VAihnqbpA4PrNfS8TC6SdqsORMEtEeU+xBozG22SQ0JrBGvXNViHS4DWOuTO7gkh1mojoweYeb1rlFK2SqVSc124I03X1y0GimCzIYT6gD/SRgh1JWVLGrMopEKAgI/DWSE3nLPb00QfSpQAcYC3/TkEN620bEHpwyFzu4viAgA4oQvuIspVWlpsr67uD5HN2Pj4nSDCmTNn7pJSrYyOjR3Ms14DF0GtzxMyLXw6G4Iv9OuNJNpelQ5LY9DpZrvb7bW5+sTEbGIU+v28IaVsciFe84Lnl8CQRMjzfE8AkJYqh6TWyD1gXdgdgVqlJA+GAHjn5yTxYnT5rM37NyohOpVK5a7iWtH3L2EqKeACo+tpf6WS7Ocsg8jOHk5LfhLdM7eiWn0SUZ5GLB3pITkadWlFK7mUkANimI1r3VuFTh+w0C0jujfiob/80NHP/zU2XXoFJn/gvcDoVX/sROVuATcdwMYJtQKiXLKfUhBt6fQysXyFnpR4WT/vSTX72swHoL4xYR79mz+D667ije98D3DNW49AjB0aJkwDNxdB1ooyYhQ1mbHRRJYE2hBYGgZwFgBLNFzEdpMU0ELPY3+3372VCaZULh8ZEbTX9M/ulRzqEKINyBaEbEUUsAgTIcvtLIOMkKqjtW5qJcCR4ZyFtXZOa7348gNmhGS7R0rZglKLHBhZ7nbbEOoM0RZSdQShraRYKtJWnBWINcRQJ7AJkZNOr39jqVJb1Noczn2YZZLWlEpNIiC3seG9nwRHKCVXFKFJHGCkQIwBvV5/n07KB4rdwYuRjvNd4VAqSyldyMmFgH4/m+1n2Y0qMSsAEIOvJdocrVYqS+w9ep3uHnBMkiQ5OEyWBUyF9YQZIWseYtIHnmImo5RYSQyOgoE8w07bz2bGR9LdLotzIc+v1YS8ZPQxYdRSkchy9LsrR0u10r0Q6QMhjzVmc0yZ0lLkiG6vt0cnciUO9gyFUCuCdAHdxkI60vv+LAlecs7t9t5PVSqVu9K02ME8c+bMvnK5fOB7tmvGEb7fPlhKzTHS5hiYTXBuOkY2gWONGShVqvtjZHjv53yINSLRllotKqUhwDh3tvWRkVr1U6T1ks+y3ZEBkySHASDPsj1JpXqou7a2z1o7U63WPqHTtBlDQJ7lczG46dSIdtEVFX6Wg2TZiVQYs3sfZ0ECQsklMdDrHWiUgWKE63d3Cy5GIkP3CgIbKWVLSrnkfHjJ5fYs69+YpqUj2pglAAjeI4QwF2OsxRhrUhRFQIyxVjh7qONa68NSF366eW6RWzcvhGgbY5bOC4Qzsqwg5iVJsmCMGe7irqvgCGYIAaBY8t+TWTfNJDpCmePK6MNCEJLEIMv6yLPefkmxlmh1XCvR5uCnchfqwlTuZsglrOtRx1naoNlqrb3WGPOolHIxMkADXzAXArLc7tFp6VAxzy+U0YbIGq+ny6E1G2+AaMOcQKgzyLYzP6XT0l3GmPV7s9Np7wGA0dGxQ1mWveRIQBEQQphjBiDVIoRCACFGnmWQiTHWvLNTRMirpfSA0RLgCJ9nDefcdqGTQ9/XhBmDm1dJaaHraK+UsqWjXSihvwe9Ewef/fpDZm31HK7Z8QaoS6/9GefVwlrm7yyX0rsS2Nm8254rmfQB6PRgHiUSXtvvH/zkbx79/F9j02VX4bJ33AaMzfx+Lip3C4R6AJuCJSsg4Y1iQHmy9Ep76pd5vTyppUwlswFclyFvVXU2jWcf/L2Hmx+H667iDcUM8wGI8d/vIzkcQQ0DZxhkc1Guxki1EuGwiEVnss7YHVL9ReE24mKcjuCqVLKlNFYYMDZghrNeMqHiPSr6SZBsRSrmDxFUjDoHLN7hDRiDRwx+njlWlRAdKWXrlZE+IuDtHo5hU4RoK6WXtTFLhWJPIQouhICSBMERMfg5jn5KAJCCchBZmPSwz+1ciJwonSz4Qt1oD4OSUrl8EACctXNpYha1kuh32nPe5TtLaXJUSLXo4vMUUjdymMEcGwLUHMptMccG8yAgCLIkRFMbjX6vP8cx1ipp+XC/35/31k3Xxsfv8lm+TiIqOkysk368oMkc2MlSGilka9hiEmAVyeOGcNj23e5EqsNGULHMHAB4P4/IVRa2Q6mte/hJ78iSSI4KkS72+nZPZE5GRqsHnc/B7BsENhzZIJCNgeqStJVKLkjNCMGCmRtE1GTGuoIJSbG0UV/1ux4UEJEYBQSPPLd7nHPTxphjplQ6DGbk/f6eEDnRWi9LKZdijI0QYnUDdJ4kiVlw1s6HEOpKqeNS6cWhSEOMbISUi5G5IaRsAgTn3KzSZklrDWdzMIfG4NVurisVEYGBRoEshLoQok0EC44IwdcJnAtBVguxRIOOjYis1nqBiOC9ny2so2RroMnc5BcJFsNEZq2F935ea7WQJAm8c+h1u3dWyuW7hhriQ0YmMzestTPWuumR8Yl9nW5vXmu9UCqV0Ov1kGXZviRJHk6SpOmcg5QSMUZYa+eJKNd6cI1svictmPGWpFqBEE3IgiBknUPu8j0AoLVa0UosCeIGx1Dn6CeZQ51JL3ukhyLJxtCtZoNpfaMo0sSS936+EMyQLRJyKQzWQ1hoOIg5BiWSQ0twaIqBy806GxYKTKJRGFbzgATkIeDnCYA06UKe21khxFKMcdZaN12tVQ+SlDjTat1VqVTvfLHzS2BEl+/RSrZIyMViVYULQp5UTakKR5XCio2RZ32wd7uVJKtkASMHvDKW+HecMDm6+bRcW+hHQgg8J0O2WDaxgdNP/M09f/XnWDm+gptvfQ+m3viO90OUF7s2NgjcVKG/mwjwJFteJsZCXztG3QdWv/Bnf/P1f/xbXHLVqzD91vcgL0/f0RMjieDQBgQ8ySkGjGS0JHxLiqxN8JMvQXtPvlcVNkO0XZC1clo6KEMOlZ26F2uP3/j43/0ljj/1ON72oz8NXH3TkUjjv99H0mIIk8BaBjVzkc5FoIaQITXyMBEhz7J570JdK70sSS5x4MKxfJhJBweVGMX8kRgu5LNCy6Wimg6zJIQ1SdLkojqcFURLg8qxIGkwNwixOqzKA8nFly/vxxdBe7Ths3QBdDL83RjocIpB0mLaSDYgO6S3b4QLab1ejRfMkhhkAxV/O71QDbRupFsQNQYfm3UIiTgZQk/FfwtYryjAhgG40C88T/pZZ1Y3ouCqh53SWi0TyDprtwsGtFIrEmLJW7dbkWwJJktxsEzPZKjAqk0QsdPj3g6Z6mXnqBaDrCVpqSgSHHZLiRaK4LJECA3BbASTJRZNwbIBAJF8k2mjxBfZCzVgh38HvUA5gZc9v35eYbIhmdBFHf7zf+vzsYCLq9fhd/Z6vX2lcuWA1ho+nFdtISL4EBCBhgthO5GwJtGHqZCinY2MmpJY8C7OEzgnjlYgLBXrDXFWcKHyUnSk64Sh5nkdXXres+Z1xaSX3LPZcF75Igich24wjUGb2IwXrfN/Zx0+Q3FsEBf3Ag+66ki0zhjfUNwMoNNYo8E9EEm2bEwSSAMBbheavdESx6YgRrE/ObDZomF3KYq6METYiD1eJFPG4BjbYNhlpmTEISkI1vnZAGmgUgSiOqMw2pbMLcluUcJDcJgbntmXc34JDMl+dhgLXk78iIP48X0j/XjvJ7O8D0/JvJSyFayf4zzfSUpiamoKaZIUrtqrq3u4RFbo8lLhX0eWJOUucs1xnA4KdSLVZCngOcCHAHCAUmpFCwEZaQkgSMIsM4xiLBIpRGHAJBsvv0rGy2bYCmawz/YJF3aL6Kbh853wFhwDhJCAMgBEezBPLKTFGHaA53cicY1EtC643URkhQLSQbIUTIjgpejsLIEgmAwxJcQwgoQFeD4KapNKl6IUiIxGEL4eY6z53E8KIdoghQieFRSXBnR7YEBaII5VEBnCK3EcKJh0GxPLhgM9eE24OfQqjMTNImhQg6k4tBuJUBuDy/CGuHjmtvGmWg90L9xgbvjC8N/hHKqY1zCzOS/sXCRNgA0T2XX6NNFFmjjnz43g2NDgHDafQeRExVCXQrQNkyWK81ICIdiZCNEGyRZDdJgKBiIgEIkaJNJjpMySIDEXHOqOsTtG1ECAFGjFKGpgMSsQlwCeHRQcDWIyAIOGalXr14PNhQHoe/c28A95wSSy0ZJtYyrkiz73wsHq/HmqjIwdAIDcx4ZzbjsAiBA7RJTHGGsmSQ/D8x4feYot72FBiXNhOsRYl4J2Ga0eFVx0/YOrPis51gQXqxSeyEaSTTw/ta2//sPzPJQEZJB5kY7HghhD8wYeJNCNKXgwa29+d64/EAfoybBgjYQLpCc2XOdmEQCosZ4woRZVauAD5p3naQSGILQFYw6ExchhVojC75eZEDk2GGwGrkdLxshD3mF/ZFS1kk8KUk0J35AAjBRLWeDZSKgN38/fk3KOOCwSkSW+OA58Z+d3Q7HzHceP7+V98qJuJcbo5cBxlhGNlLIZwfPMsUYjtU/NXDtzG0gA1QlErZfzAQZeCOLGqpACWgJM/jixyAVlu2XogVwH0reB0IF0a7cb4kUdwx5AdAJMm1hAsp9nojwjbYNQ5kWTGlHnpU4cA42XmzQFLGqSLDjbBckGiWhDokoDRwUEAMVu0lKEnB98tlNUOHFJMOYk6cXgeY4BKFnMdsBAGOgpMmEJXLgLEA0ZYqJ47oJgY5iPviAeCKXaiIxCkJhrSsrjzNEUN3tRPRN/lwNmwcZtDFdILoStihsUhCazOF+nEzc3dp9YX3F4fnWPF2J3Fn9DsWxNfBFURuvrQsPXobhZRJNR7IJtTLTnkyVZLn6BBUTzvPYqnhfi1/EFFk3BBtGHOXCsKWkeFQDYxZpnPwlBloVoRxKdQIRAYnsgcWckUY0kaoK5LZzvJD5AkOpojeUQUY+MGhHygVaxYSIDLroGDOFkivY8L/38jc8gC9rAHv4eQrKDPc5GhKi+WOLY8LkLEsj5YuTFtZgZMEqKpTz3cyGEupCqo6RYGH5dS4lEAlLLQ7Fwk0YgNKSQLYY0QqDtPaZ4+Dx4fU+zOBt0fu9w43PauDZ2cYIsPqYXfb6FQwwMg2aL61AUV+t9J18I7hL4ZZPueLDORRf09EOx/Isb1+F3iHXv0Ag5GzzqIaIOBqSULS3psByYX3DkpYLBLwtLtchNF3k2RNQjaJ4Ecq2wHD1qgkJTsW+w7dxGWq0ooevs/SSpZBkkEVEUgQHYJECd8zffRR3ld3B+B39rE4yXFT8uhNq/Tx2mSfSiCwzr4x7v4ywzG6HVccDOQClASKBavVuoyt3SySXr/SzHaDSJjiTRJoo1jh6IaEFmuxLOURUWVcqA0AZE7xZDog34KTBZBfMoCkPTOhHZEullQLZeogtKvuXskgvNze+8wXLTCN1bEfMd0HoZwk+CPaQUUDoZDLzV8UAKkUV1qA5CHGsSAWCxqKQBB1hmNoI02BFC8GAwlJKwzs4RkRWEJQKdv59p4ETOyNnHOoSESpJFoQkWYi7GWBsaSWMDbDqALnIUiS5/5YDceZbx+QB5QWXX3NipgfF8uHaQQPlbDJTPV/0D+Ox5q0z0grBeESnjerCgASTGF0FBAJ1PlCw2PM75Hc+NPUjxPQkAtlLisNYSHC1y29sTOdakFm2IAgZjEm1GTBjCRIhaANUJbDX8Mc7yGaFxIDUJbECDqAi6zmFaSRxncMLEDeZ1CNsyr8PETaaNiZ0uCpHfu2T5Yt0Wg9YTx4ZPNy5OSOcT0Is+uvUugGNIpKBWYtSiIIJ3DjEGSALs2TN3KUlWSr0chGwFJssgQ0pbUtoKju3hfTcgoSwBmMV5ktCLwqxFokPj/M+/OJB8QbHwUgjWRabIr/QVinQxpPtiIDtd0OcPCTnOumkhZFsrsawIi0WyDIjeznEMdRaiEym0ScolIgkl5RIIsz7yZHRxMk3EARfCbklZQ4X+jeT7N0KZYyBA+nwHUDkQWO4hKkRUCMgLlCmCwIZJdIYm5S/n/Bav3yuJH/T9TZjW2nmSaoERE+fstOAIEFlk2a7Hvv4oVo4fx+uuf9uttStf98fMQIihrpU6rIUGITY4tzOmSAjHATddhkcNOfjcCrD8VWTPrU5aKu3R0UIyg6FADOjoQfCD9asXV6uhl5o5vMJsEUmjzwm6DtBJUk/hIDvPod9tQ2qNyAKC1EogNRuATZLp9JCFJ+BnwXqJHEFzYgBARIAZDRFFlSQWlZAIgjugaEjwHFGskWDDHGsYLGvX0spdbAHn7Rz5oivVzIs8MNU8X9UORvpUVLt0vjt5ZSGTBzDrt7igz/s9QxiJ4wVf+1YztYJIcPEMlRvnYS7acCPhovlqHMA1PICnuDG4aZobRFWLQmejCR8VP7v+aMwAcSNCNh2JWZYwkdCIEU0RFaRMnkyVfhKamvDZPlCsRYq1WLBrbSRajiSOSuYkSVCDy3YhYB8CHWAvmgQJoQl97/eShCVwzoCJQ5sviGYUAmBCpAsLBn6J1IZvI6x+5xhDtBcHnRdyF/o2Uu9FiaaA8iUJkMCCIAaCQ4gB0bt5jrEqKWzSxl4LYgMVazJSbphsgGwFjssc4xIxNc4n8EL5GeClwWvfxPO6Pv4WIxv6ltfkW098N3aYrwySfZ7wysYOnl/sORe/WQBLRqAmJVqKYhPBI7hsHtFPqgGZSAi2ztsZ5/hOJnla6OSQUmZJCIEYeZYcoyzcYQ23B8JNIwEg/RRAtmzI+mjnopArkVWNgUQAbQHflvDzxLEaL+BQfKfn90Lv3+88fny37oPvaIbpprVS0FovCyGXyIYGYGdiuz15fGUFj33zMVx61atR2x5rSimoKFekFGAHOOcnCxp9ukAgwPduASvEAJx87gRO9+7Dc2EUjhIYziA5ACwhmKHZQbIFkRtQD1/2DPNlH1pHBjGpo+MIkAYaHjX0kPfWoMqjyJxHmdTxQIX8lgDaRbMSa5KLIxtCmJNCFp5vMcwqwUswAKIF+tm+kuYE5CchYg3wk+BQB/up4l/ZQq9/I6nyPUaJNtvsLhc4EVIvk9TLEaJYL9lg6VS4OXx3ICHCCxMcXnzeRc87pkxiA1lifRHkJYLNxnlpfJEQRi8AzQwemeKG5EcXzK4KXWBx/lTQhT/7PLCHGIFQZwnjHaZEcJOp8C2jYwHTd7sfAvwk4KcEYlUMk9t5qy0LkxxFd20XTG0npGgrywkJ01K6suApLg86XMNUzM/ioCsiyEHREV/4AL9EEvju9ZeAYG7ySz0+fcu7q3EBEsF8wbmUBCgBxOAb3rvtUpAtJ/pwIVPTvRO2dzNsv45eBFgBSeVhWaouSSFbwefzDLUQaSgsIgZzvw1gNkcIii9xrV5eH/JirNrvBTzOA8SEUOz+nn/taUMhSxd0mUUNzdDEC4Id4AMohjlDoS4T0YZSK8PZuE5kS+d+0gZOYvRzCLRIQkEBSz7r7S5VzGFk/ZuwdvLnAVvg3Sq9GaNbDilnr1Wk7gosdzORkexbkr2V7KYxiNzF6/Odn1/eSMR6OfGD+Xt2f7xowlRKHWfmBghQVBi9sPeToly227dvN2MjY9i2bRuKPUFAStHkCHjv52KQYF1tRQ30HfaqOLIoRy79+S3TO5C7DJ2oUC9vgyONNPYg2QMgSA7Q7CCYEUjjlZg4i1d4rXwIqIUI6BKiyzEiNdSmMVAyglK5CkB0IjDFQDKEqIjZgGINsHuCcFZoswj2c+zynVLQTkgA3TO/lp94ut5fPYWEHQwcJLsikQYHRIeIZHI5S2/bevWO2yqXXPZZErJlfKiDYxUAXKA9LPSThe0RDejdha/hsKqXHJZeidIPXaAR+aLfaeOA7bZeGxbw4vkZVnEvN4u540v8xg0rA1if3rApAu/FnSINoeBGoQUbzbpTHRVEkPO/TIAhTHEjiWGwsYPbrHlhwOFG8RoGBHBdSmpJzluKu9OJDDNw3Vv909/ctfLNRzCeEEy0UOwhOGAoJAAGotTmrEh3rUWF7Ve+eoe4PL1JMOUihBXAQEWLyHIpUqHHyqAEJECQc4AcPEey5wuADR3eYHYG/l5NaZ5fBr3IoO1bnC5qXjh54gvOFbtYk1K0OdgZ8nbGpMnDkNxAyCdx6vi/bX/17+HOnsBq30FWx7HtylftSKav2YGk9gnfD3VVGYOHWCiwBdEoSDIYEG8iiilgHAbp553lAUEmOc+w/rbujCGpJOeLiCUXz+j4FfeZ60Vj8+JBBA2uP10Aw9J6+VcYbHtwcLsphrpWZKEoB/spdNpzwdprQwh1k5buRVL+rDF6OUbABjfHMS4KACrmMwDvDqee/fnHjn4R6K9CEDCx7VJM3PCOnWBOFOv5wHIlQlQlu0XFfrdgtx0QnYEYyOzLPb9M1NhQ3H5n8YOGCNn3rcMkCJEcznI7b2N/Wqbpku11b1XId+hq9VOXv+4N7wMJC1O+B7Z/Yx7cNCW1/cMEb0qlw2s59gmP7ZnDrpIsHZSXvAbjoyNAOQEioRC+F0DMAPjBVYoAuwGzIy2qR/YbOgcBkMQwqBQXPV406xLPhzC+47dQ4KhgIK0AWb94njECeQQmr3kgkmwKYFIyWoLRLobTYjtAFsSGJBuo2Agu1H0MdS3MMSDUsXa6vvbEw/jyZz6JcuwhoWI/KkAghoDoLToiwQlTx+tiwM7NW3agtum3ikQsTwNkg/dTlKgVptAAxWaEqgYyxYCf0RIcl9TAqNuTGhBl4obOr9CDlBwhODSYqOlJIZJoAAzJoak51DEQlAgkmoAoFqo5ghDmQH6KAEjQdmbZAtRigIQTco6JEsGxzSATSNQB7JEILYmwOHweccCApsFitCgg3ML3kIavY5hlilWAQJEKsGnA8IigRpEMqZAwFBYEbyVHQwzDGO4q8kDRBw2muG6WLIAOGBBM63xgQqiD/CRAeyl6q3R5RWrZNCJpQNgZnO3sWn70y7j/7/4aVXIohwxlnyGJFioW1zsIgY4qY4VqkJu2o1zbjK3Tr8qhySKwATNsRI1Iz0XimoBvDyClpIC2QltwwRwvzjkPm96Laml6Xtd93qMwovCYYQSS68Fk2O0Vi+Y82MsbjiHEhtX04voLZggEMAhWJLMMYQRCR7JvSnazABBILUUSzyPUFGcsNiX7BiFWmUQngppRiGYhqM5zJMQSCdpLiDWwm4a3M/bpxz648rUv4sQDn8G5U8/huR5h9NKroUbquOTKGQtNecLqeAAbhkAgNTeABGcFeIkHq068Pqoo9jcJcYnW/+bYEGBDfH4ViTEUNxgm0PMJNUK2AhXuP8P1lcHKvg0kmwUgGGYJcS4OVhoiZIMhDLG0BcGLTVHMRSs4LsnIg9M8PJ9FNyl4mHS5EQmIkI0IUYx2iJdEsSIyK7CR6DeY0w+KPgBgKZqByQoh2hCig+gn/ZkTv9l64qtoHV+G9x6bLrni1s1XvfZWXb/kDiF0S0Q2DG5IQU0hyILZHD/xHI7cdwTu9FPQSuDq178Zb33D9btAyVHBoj2AtucKtwrRBmINVKz8CeYlxQ4ANwLpZiA5y5CGwLMKbqkoaM6fXQJDcAATwUNVmUQiObbOj54GLP0CthvEjjgg6p1PrMAr0xJ/GQlTwHmBxIwsmOCgCw2iaa3JgkU7O9HCuXNnzdbtV9yKkU2HynDTPnbuhDKPOg71PPRnjSkfiyxqZY17AmIjliY/INKJnSA2gGh7oZcZgOBYK0SCh7dZLGjK2jyKvHcL8nO39597GlIAZvIyQI18ArrSDLHYqxNsZ8B+qjg3os1kjjFEW7Cf+vYrx+fVNwYYunaTRRUACtkqQLSZ9bLzDEVuRYJaBLaBCQz95DpQIqjpHOBjOg9dPdIjtZD0O3Ny86V3h1OfvHVr5wmMiw4gFeTIFpyRYxDVCZw5expbt25DSZdQ3zqKUBr//Yixg+z680bKFpRskrbo+2xfuVo60O2vHRSm+gBJUzgCRBzS1s9JFWzWbs/l6di9yUjpkIwRzrmGJz0ZI2olQQdd5+y+SkUfc53uAVPfsq/tsN35OD2R6qZod6chRTum6eEMcl+IqAuPThrcA5oChPKTwfVuUSxb8LKl5GjHRarairgWAqBOyLUxy6sOeyJQG9XyY2VB4LwzL5RsqSRtWo8532/vHauUDvp+Z493sZZWxw70rWtorZu5czXSoR6c26eCXk61WBQGWOuc2y2T0koIqh6DqBLBCpVZSdku7dnIKNo+ip2eAW3SB1xkA62WTJKi7/J5ZhhiaSUTdERDRlRBAaB8B0S2SwIQsnQkz1Ht+2RvpPRYWYmDcOL3opRIRksIuYeRBpsAxDOr2DKWYK3fRyepQCgFEzTGt03BpaNAP2xCpXwPHNAN1OBK1XiJSQMc434wCHmNlGoL4g7lnZmSNg0SlWaWx3mlxAIYDQFACDSDd3My0YuIjOjDbGQypOSii2hYj0mSsJVULEjn4YPdvWbdtCxXWkxsEqOhiJprZ1p3VSS1yknyMJRs5mvtu3JSK2mterDb6+wtV0YOdrtxXyLVw5VUNdvnOvvceAmdHLMTqTwgvAR1zt6mUnNMJWWsZn5vcfvJXCjZsdbPSKFacN2ZchnHkPVvQqm2b+XM2mFdrS8Lpdo1hQOts6fuqiTmWDo2+rFs5cm/SauM/rHP4Ruf/jjGyOK6q6+F7NeAiWlUt10BQK0g+ilIdTy3fio3Ym80qMWIagk4gmAhKCCEMNfNw05KqtZJtT1J8DADO/J+2GkkHRPs2jLa1kipdDjvdfb5wAlLtSKlXpJgMPtZplhLE3Mo63b2Q5cO9mS6z3lMT6TYm3f6MEos9a2bT0ZSZJZ3c/fUziQRbdalI9Ap+o5vFEK0O6uYHRnDAiShk8tZLcRyScQa5RkSKVvWZTPCiLYuJ4f7ve6dtmtvr07Ud8P2Jzs21NORiQNnu+EuFjIZKWHJdXtzFS0XRcj3cHTT1vkpgPKkWjWw+U4EO4O0fE80I+j3qS4FWgwswLk7k9Hyw+2HP73j9Jf/HlIQzMwuTF19LaJ106KUHiKKSI2Gy7I5ZdIH0O/dsumqmc7E9unqWm8F1UqCzVdPA8ocA1c/5XI5HRMxC6XgInYrKQ8DvVuybntOjdTRa3f2lnW2C2DTdcmukIwctyRnlKCVkiCQd/MeshUgmwFijjjYCrk6pFrJhKz1bbyxInB3zN1uQdJWamZhLcN2IlhJsuVsd0+1rA/Bu4bP8x2pMccQQj04PxWT0l2BxPcnYTII1vMek+AQQYK8bZQS8yhKagXnTt113/0P4tlnn8EP/lCKrbWJGmKsxWhnTFK6CypBL3PzEr4lQO0hLbsnyy2gfM8LNLMrz0/XvKRB0Fq2Vp996vZ7//5eSALe9s4fRuXySxZzThdyoecJnBvO71Ts5gE2AWrFitQwhJHs7hIXQVrf7TfJ4YJZWcRw74shODYKlRKJAFUHYV6glEt0liUzajJgVDJWbY7J178Jk9e9DahuKaqGsgE6q8DENFw6uj9nmlW6vBA4QsQADT+fGDcN5IcN1m5HtPd0An7fruUzaSL2QJHF/93ev8bYdZ75nejvva619rWqdrHIKlKsEikVJZm0ZZdvpC1TjhNWd0fs0zAzZ0YMZswgAxoIrPlgNXBgTQDTOMdqICcKgqZxAulM0AwykU46h85MSsm4NOmO3O4Wu23TN1K3kigVb1W81K7bvq3b+77nQ1F2dzLXPul2PtTvWwEE9ube71rPXs/zf/5/yom4El/Mhep2e8WzEellqVUHJdCapayTnmpavUgYHDYV16LbfmZIyk7Zuf01pWqHCIPDqMp3jVft9UIfKspoKtHqNSHNPL7ElcWJyMoOIlhcsPhivKKic3ngdNpPZ3Yl5cuEIo+r1Y8X956VXJYTfDmutX2xvdE5W0mSV2smtEXonjaqe9zcM9uu+nIcYceN6B1DuxbaLpC653zBCSc5b+P4XOrCaSFlrmFZBvJEFzNCF1NbLyQ7OphFjeyg82ktgu3n3ec73RBJFV2qJ0PPFQOH8vLne4+g8iBUOwi97KWvKyXySKjzIdgTwWEREQyNfeOBg49+vTlkaNUidL4JV9/m2h/9Wzrrd/HWMP3oEfSjjxGyGkVtL2J0/0WSxov4YiqEEDlcKzhj/SCvW+PnLOvPYwElvkueHkF0n0BFlyGfjuPoLCjy3FknozkTKXJhzpdZfsIocd67rCWDt1bq2diY+VgFytIdl73B0/jNJ3USXR5NKq+i3LkCzeZg8IzWZnxkpPVMGPRmKYtJKE5HFqJYZIjuU1Z2n8C5VlRrnvHd9acpiyfqPjvUCc2zztHa6HGq4vOp4XrtZfLB4bzXOWWCaNci2UHLOQiz2HARfB2ZztBb/W2sXcDLzq7R1ql19FOFZ+ruxsaLu4ZHTnbXV86aopiKdzS/zWD5i8uXX6NRrrBrxxB7fvVz7Bn9GGlHY6ojbWzlVYSvkxVTlerISbzAlxyPpZvToXsK1z0PxSTKXE0a1XmkeyH3gn7G6VLIca3VktR0fKnqZVaO5yqcFC47VDV6CetahPI0eX4An0+jgUH51djlB7CAjM9sBp7r9YrT0vncVBM2+um0S3mqYsLZqKmeIaQzhGIq5P2jg4GvN5s7z4zUea6zWTzVDcUM2mMSvRhL8aJNFISADUyXLp9OS3nC2/iidNHbWb88EVVr50LRPeVcIFbhIpToEii6R2RkW3RXnxaJXYgivbT1hJnOQDGFgDzLDvXL7um8dNOj9cpTqsxOUFEr5IODe0yXslzGKMUu04XEI5MQUWw+Z3R8EeSLwZUT6OgsUs4kO3Y8c/TzR3+78dhDW32ZkftAiAwnMCZedFrM5YHTLvejwjqIgo1rqg3rzzX04DAynUHITjUyiyh/Lg+w2e2fccqdkPhaEKotpEArcz5REvzgacgONWV5qUp5VQtdR7kWKrpMKWn6/GrhwcuAc1m9LPwJGe611t3WQ47SZvEv6s7/v1IwAyjInUO4nESLeYQ6iPB1733NCQnKkJUCStlB2gWBWXTBUvgPWmqBraXsP5dCk+DcLMK1BB5fFluJ8sFD8DXvilmhdPYfRRL7FyKa8LPSF5MSTocQrgqhMoHMAQuym4mIrqihpGUxzbhv50HY/9hVRHUepdr0N04xKTsQXe6k/mknadU0c8KDKAcnhd/4EncXjjG4C4N12LPvWK15/0zNli0Gq9DPoDIOw3t/pW7svB/kp5UrWzKQZUU5oYReqVeiF8h6z3Br4Wus3eT2++/QqkJ59y10s/EEuz8Eux78oh6bOrrTDH+r69UreIUSIEOEEvFFenefLZau2Gy1jZaVJ+P7Hvidamv8H9RDf4a3f3Sa7iZ9OYwcvo/Knn1fzr3IS7GlcG7UkqcSBcWtm2Fw622S9BYYCbsePEzmCKt3GAzWqdQ03HfgGGZqRtrRb/hg8TKihAklaVvFucQ7yNZ+h7s3xsuVVdL2Jn51QFSrIieGMLt3kDSH0CK5KJ1ZVFmGKqMTBBmVkk6u9PlSyeNOmrYX1YuCMtNlHmkpkIJu8LTIi+NE8UV534Pf3jnW+iJWQr4JAeSPL9LrdfAiRo/uhf0fQagxLEMveBdfLLzITQiRwNcScozPctJbX3Pvv/11+stQjWF4z2k6HVi7gcv606G164t6fOq3GdqzICr18x2hDuVCTRcxU5nSB+OQnW7G/p/UGcwI132GsjtJyNGiBApYbcPaxsz6evdLadL6naGHP3nVJqNnsoIpZwwhyHntw1Ok/ceza29+UQzuYGSBqFVg775jhOrX5Z2rUAeIqNM8F1ebhzb64Uyc2LOU+XFKX48opqJItUlvPc+dqzV3Y5G82+burUWGGgkheJpTj0ynQw98PZ7+9AUpdCcELPfavTUdrMx6x+jnlncvs7a0SM04pM0hKqChiHUFH1dfCSq+KLxrealWKMrjFennSDefoLP8r1j8CeXye3TWVsmEmqG164utyQeet5P7sbXRC8HXXt700VLp7ITWaskk8Tlr/CzB1/3N178mNm4RBpvIoWHYtROu3sSvrSC1gNH7vh7v/tjh2LZmKcNsiOx8URYIfF5TxVmTtp93V/7otOzdxiNR45O0dt0Pvc0nQbXrytfrUXQJrZcJYjp00x+6u+0ZlVRgaOifaJO81gl6wpmkZess9AYcjAJRIaKJOiWRzbsUvWP0e2d0unkQk3SpBEv7xrS/c4u1Tp+Os4wf+CjRrgdElrkT3mVTNZnnymdnB4tvfEUMOsTZLejepWlBUuI3bsGl7+Fqe756d2PAroMzMLy7Jnx2MOT+ma20mGBjX8Dm2tZ4TFZheHgGTS6UmHcinPDB1StWPGtCepLVm6fZuM7G6z896NI+aZoSTKVV2Tn5teGpD33NThz4B6P15tNuUJ5ERi/cG6sgfYEfrD8r777xtfzue4iQYYaGYOphKAJsZFv2lMZgh0cvUqp2rO1C5mXHSXMVrV8ceGa1tPNCCPzPA+L/MlqyAmxiXuj3e2ekLztJXHkulK7lu/3HVbP5Tz79mc9+qcgKkmqzTQlE8UVjKnP9zM/2i+JwpWLP4PNfDN3/zwp2COBdC58faO4cW/5rX/j8uBQBs2tsmbKYIqi2UCH/31CyRb/kkjmPEKf4+UTVnRdBon16CtIZ5fpUlKMeCcaHa1sTmJBNopI6+eAI3rXI7ELm1EoO00ETlZoTRnE+5NlB1b177LXf/e/wd9+BbJPJ6UOIsUdavW6PevcG6+ub7Dj0eXZ89AvfEbsf/pWqki8oJU/54OuqSFeUd7my/qneG3/4zbsXv8Pd937G3dU2O0dr5O0rZHmOGb2f5gOPMv6Jx1utA5/+eqNSFfmWcHlWWzlPMIuDW7fsm9/9Divvv029NsLMX/t17FDtBLGvLb/2L1l993VWRZPRD32Wh3/tv3zO1nc+JaVeLrLspA+Qpuunb/zsNd77g/O0Ou9SMYrk/o+znnp667cJ2SZDiWD6I0ewDxw9zIHPHJXazpeD/KQ2dkkEciOBcv0Zrr0+fvPSBd5fvMZgs0++MaBSiZENxe4DD3D/ozPYyQ/NoKqv9DY6z9k4fsVB10vmveC4E7JVCjlRCsYFUZ6XJRUdjmvBHIITzrmWytzWqEANvYJ3LVw+Qy5IvcJUGqTasp4KhlIFSXLBlard8yHSGrTUS0L4usHXcJ0Tr7/8j+3qG9+j0l+i3mgS7znIereP6t5ms9OmNrGbiQ99nNYjn502Ux89klB7fD3NFmUcdapGvmI9C3VZTInu7a+kVy+xdv1NGKxTtZKGsWR31rhx9RpXl5ZJ6+McGRmdHHpoZ7sY0Or286drUj+HFBlrK1+8/Nr/THb9IpEYMLJnkol9B7i2tMrmnSUeaQl0vYX5cP93zANHbOT0JV/Es2meT8dSdtCA75zgvR/W7l78d1x76ydIEbjbSWk0myifId58Hbdjmv2D9DuVfTMv1Bo7vyybMf31lRcrjcqrhP7jP/lXvzvtr/+EIb9JQ/bJVvtc/x++zTv8kNqDn+HgZ351xlSqrwQXrLHVS3mazkSxnGb13dODS9/j/ddepli/Qy8tKHVEbhOaYzv56Mc+hj74qcNi16O2ae1vtQd9QohsUQ6e9mk6U64sfvFH3/kXFO//AJ1uMjy2m1179nLlvffZaN9mOPLUd06y8xNPHKt/5PEQVONiKivHUsxiUomeNbqkuPbu6cuv/HPK2++QJBX2H/woyfSjrF673hrRrsXIMCS18WxjwJ+8e4POZp/74oTR5jATH/v4l9j3yJQNjRc3imhaG7mkLO0s52Azks9QrpxjdfFLLL3HZvs2690+wbvafbtGWX5/geUrb7DR6zOwLYabNaLx/UgbdyMvLldDUcdvnHrrj/8tdxbfYbhoM9a7Qk1uqZTv3HiPN//1v2BVNhl4za+PjqCaOw4IKbsOX1PC10Wve/ytH32fwQ/mCWXOzqO/xv2Hx2FIzJch0C/Sx62RC4kxsL72lfLSH7Py1mu8f/n7BAS3BxIR12g0hxjZ/SMe+syvfjU+eLimMFeDjJBsJdVIIO+tn26/8QNuXpwnLtvUanV2Tn+K1U5J1utRpgN2jo0wPP2hGQ58AmrjC8rLrlfRvAiCdFBOlkqfkIKuJMyLD7Qxf/EzzHtDaBkIwUeBQO5cSwRQ2i4kzeHvJi5YdHSJYK4GL3IRJGLLoTAPWzOXeYmf/fM9oQWrJeBci9gsRqMj40gBkV0gdy0pRe4/MAv4D9vJ9hdL6r+ccrmlUTPLQsh5wpbAxnqP8p3DuJWjw/kyof02iYKdFnj1d+j+7DXK2o4nV9fa+OYe7vvsf3E07Hj48UYlolvyXBY4pFU4ryWotEM9baP6d5BZF3Hrfa4u91jd2GDKriHzHu+98j6qf5eRI1/8jhnb/y2k7IQgu3XlO0oOHufqT5+8/Yf/H7Irf0Kc9/nckVlqj34alKZz/X3+5Pf/DfnN9witHQxP7EdWJ09oT7fb41hImYmqYVH0NhjcXECsvE8kS2xFgFUr+HTSdJdRty9jqaLHWuB7NYJraWkWyzI/UDVmkURkozbn9mCZsfwGZa+ge2uUW5slIr1L1XUY9FZYznqwnjE5tvtrjDy4GDudl0JfVYp5XXZPhttvffP2n/we1y5dQFaHePChh5BDDUK/x60f/gl3/+d3aLx/g7HHCnj0r0wRJRfaFfHFQjAVO380cu6y9ZzT3symkhknaSlTaQtJrj0oxXmBOuEJedeLy3mQeS02C3Hgq5RyppeVVJEEFZHKCsQjlC6+OBCVi8rqrjF6PoQSX2Ynhcunpeseq3YWkd13aclN8s1VVq8bbq722FUJNIsu/vUfkK+v01srqcbjRysjI8eHNovz2keXGjHnhANuXgv917/HtZ/8ASuLr+P760RWExmDMYYs67LLONbzQOK6IHzdGrPgg6prKbbcj8qUzu1FKqtXUKHLnWyDG++9RzmQqM073GYZGVVodGCoMfZ8vTb1jdTrC9LGz2HCbOi3vyZ6N46+/YNXuPvmHxH7Lvd/5LN8+CN/g34G+eIP+PEfzpPfvkXiuny4rk+TPHwAmbyWrrefrDTq51Fm8e7S9enk1ntMuTvUsgEdWWHpnRssdbvsifYTz/i6jFU7LSEodT5KIijaX1tZ+GPe//E860uX+Nijh6iMP4iN67hel0s/uMA7v/8O+zZuEf3V0RnGmhOxCJn3Zbter75A4Z61OsD6MrvcHRLZY3Ml563laxTBUJeOpHeH7ru3UUmN+q6diH0zE4k1i0pUzmqpIG2f9RvL0F6k2l0ivZOxnG9y98cXGKws81HTodlM6GC5Xhh6roorBGkoue0Dzf47VM2vH63uPDRTCPdbyrfaOrAsQzpnZfcMSz/+UvHHL3Pt9R+wudlh1cfcXe/yRiWiIVNG/BqtyNLObtPsvw/56vOC4S87wYnS+bp2vcnQW8V3V3DlBnmWkjuH0VuZnKLs4wqHkAnCZeBB2OQ1bUVO3jlBmk7K3iZyYxXhCuygtyWKdMUpp+NzQWKNEYuU/ePcePvwnR/9AStv/xFTY02G9z7IerIXHVfpXX+Dd17/Hu+FnIelPy32feK7QscX8Vv3SJvEUI0vRmXnWLr0JhONnLtLm7Q3cm5vOoaMpNi8S57AypUf8WCjCQ8Mz0BywQV53Eg550QYFYrcB+o6yFn1H8mq8P+occF0kiQXKPUHbvq5bTTPkaczP734o6Pra+t85KMfPzw0Mfk3fFaOF/3+KZtUzkkj5vMinFDKI/6cohsRgpVSZCjZYeXu4Xd/9kOkgH0f+cRRRva+JsOf3kH6TxFBQNkQOC5hToqAogSfHSJkKDdg50iMcinKw90b7/Pu+6u46igrK3eIJx5h58dOsJXJCDLQSYtsJjL6RJwkF6hVaWqBcBlGSXbt2EUy+hEGrmQkvUL7yk8olm/Qe+8iww8+ihjbPYMzi4WTnTipvbylSMzort4mKvuMNKrUHngQ7p8GabG9HJ00WV1fZfOdd6jteof7qw+ekkn9eKWC1ZI5ZDil/QCTrjKsc0ZiAbUqiPgiZXYojqxtVTQNLVH0ocwpBtkhFau2FiLLe+unregeNUUXendpMCAVIEfG2NFqcN/wQWqDO2xc/mPSjRWuvfkj9nz0MVSy47TVrd8S2eZBUzGQ3vn7dxZ+wM0f/wGm0+bDn/wk9onjEBkoMsZ7bd678H1W37pMtTFO9YFPHau2Rk+uCeZKmEBmF5XPbRTC6RDiFzxxLYcDUptO6YpxleXHhfMtJXyO0ue9rZx2glbHFwfjqPEScTIjRCC4nDyTFB6Iqt8Nrv6UFJVZJcI8AgqvcF52rDSLUsh8d0Pb236DxBd4JWjsGKcYjhmvK7Kb72JdSXn3DtcuX+bhR25D46F6A4FxoUMnPYXqHMre/CkLf/j7DG6/x1i9zuieSaRNKINDiIKVpXcYSzJ8PkCWA3DFlJbRsy4wO+h3T1ZjYLhJI9EMxR4rFNG+/cihvTRqOzFrN+n+8F/Q2Vihd+N1hu5egeG9dSvEfCE0aDVfuvB12e2wsnwd199gdEeNoelpePgg9UyAWWfizT9hY3ONwcpNejcXqcbDR2lNXqoMj33Ll+a8NPXWxw9/7ph4O0dcfB0NxJUmhz72BfZX9uF3PYKsVl9BqTnl5WyeF6fiqmpz+9bM4ps/orNygx1jLVp/9Vdg7ww4hequsPvaFdav/IiVd3/GxEPvI3YcGFcBKnH1uaLbOWOKzgmkIKQdVG+FSJZUGmPokQmo7GDvjgbZe3/IlStv896lH+Iau3hgeM94XjdP5rFdFFLOSYKNGhXG6gmxq7DhA41qDTmyG9Gsot75Hu56F1+FRz78SR559AuUt9rc/cH3uHt1kduXS/bdfz9MPFQbiqNLvUGZB6+sFh7c4DDv/5Rbl/+Q/o13GBnbw9jehxjpOWItqBdtxPW7VEWBjgxUBLhiykl5IpfqgPB6qWYryx/+2CfGeehBdLlJ58f/lpX336DwMPXQh5h66Ah5bugUEjk6Dti3vUnOZ753KtIiI7HtHbWklcWWMi0Z0gqSGIrskKw0sTJe0BRzdNuvrbzzM/qLl2m6AeMHjsBn/zq7djwKSjD63X/G1UsXWH/3BywND7N736EZRDkuHKdKB6ESnxNJcqGR6GNV5agqj965gx2HP0fXV2mScvVH3yW0r5CuXmPz7Z/R2P2hw07XzxfKtYwQSEJHa5bznGn4D7Uxf6FrJTiPCmo+hJLgwiktVBshctfvP768dJPlpSX279/P0J776kq6Vlk4ZDBoqXFkXYmb/fOqVLeUssGiZCftdrjy7jsoKdj7wCPoHaotymCBnP+Ey6UkzHGv1SB/vhIjctD0ZcJaF5pacbe0jOz7ODuGpumbIeIiJW5OYKIGMk9PexVekL7oSCU7BWHKSfucrjbb1satQRFQqgJ7P0zrsZNQSZZ579+NLy1fZ3SkoL+6zGDtNhUdLA6KUnbRtTmTq7nVfvLVm26IimswVRmB1Q3YbEM1Jhpr8vjf+jtQOIgTaO2FauVVypKs1ONZOThTbWZ1XBeydSJyQlGAU6Su9nKs7UJPNP5+LhMkkjQdgBPkQbWr2p4ri+6zthpfhOxgtRq3jBQkkcbEI+z81DEmJ2dA9OD9H9O7ep2wuUZWFniXorLODKo6Y/L+41TjKXo3xzevX4KVa4w1a1gl4HYbsgDS03MFqlWl0ym4trrMw5sbLYYlFc+rTvpWJfS7ie8/KYOvE/IDsTOviKAuZSIc8qWrm7K0wvs6IuReiuMlYsJL6v1BeHxHLF7AlWifEZOTOSjTLpTFVBCCwodJfD4bhJh3Qh8PKrFOhnOa5JSJ46NZVtAToHfvYeoL/zlTEx+CioTXvsPCd/4ZLi+5WwgezEq0lB1lwiKRO09n7UX6t5+8e/NNbt++ymizyfSRz8HBj0N1DIocbr3D0r/8f9Ppv09eFlsrW961lHD40s/j8jM4kZNUvhtF8VHvHWkI7HngUXjs18FZuLtA98orpPkanc4yzetvUrvv0a/k2r5dEHUjY180JBdIRg+3oha5GSFfzeHd6zD2BhgLNc8js38FVAVa98PER9skE3+zX5j50LSzaxnPtGz87PBHj54gzo4tX/63FPkam6bBvk8eobL7I+AbXYxe8qE4KYx5UeT+KfJ8unv3Np1bt6jImOGhUWg+BPrAVZAdlD0YauNU68P0ez3u3F5h5yA/ILxeEhKMUW3Qy4yMTtXrQ1bdVTghmHj4k9jP/mfgR6AZof91Sr1b0C0kg3QA9Tq2Un1lbZAfc0G0mtpcpTUG0rI58IRomNGPPM7oX/0v4OYVihfXSW9cZhA1aI5MwqOPod96l3jhLWr1NlnaJ2uvEAWBw855pU8EQeREDBvdY7fee4/V1VXqzRaTjx6Bo/8Vu0N9Sxi48Me8+8+v0N9YQg9JiCtAdLmMzUQJ487V8poO39IHj3wTUUK5RuXmFdJr17bs+/Y+DJ/4K9g8oqUqEI++1PXJspf6pE9dKzJuFBEiGxx5r4vrdpBZBtZALjJHoKScCBSzZJ3Dg7s3kGvLDA0lOL0DteOjUH1Y4LpPYeu/XbMCVa6TLS9Ar13DDh3SyiyGwtezAmIvcnFPH3N9dYPR/dOoz/5faCZjy6xfG69efYds430cJdevvs+H8gw0BFdaKT0Wv2iFmc8KDgr9l7iHKQJEOjpbpOWJUBRRPbbnROmfYpAdEj5EO0ZGth7PFVu/gqxejvD1Im0/74Rq2yi+6LbMrrt/vrVpCL6cEGorl67RaCClQFsL90JbkXT5TxnvZ+XWAq0VW9Zn8wjZQVh6MiFNdlBvJuSZZfQL/xmjD32+Syo7KJFTigw99AL4XLnBqZrVl6XWHRfcaL/ITzZKX5dSI4ShDBZ8DNQvourfRtS/eatbsDc42reuU72zRCW4UaS8KJRe8gI6Tp/e8ejhvzn59o//2erFO7R7A372r/8NUwtXSCqKalJneGgv8QMPwd5xsDF0N06VQuQqGj5rawmUty6VIUUpRy3WVLUCL1ClzDGV50TU+PtZMPgspRzkYGKiavNplCYriildZIekLVt4T+48WelJC0GlthN2PfwrkM70b9755tVehJFN1NAuTLMF0kCeH0Cy9cSeb+C7KzR1ybAVvPv6z3jrj3+Kr43RrFh6V37AsAkImZCnXYpeD1N6bGDB4VsmFIdlyA5trQ3JjgnFqy6oucyHQ1LKTmT0VRm8JZR1icd76k7RqlajV/A9G7rrlN01KkkBUURsAOFrWkmEE3nwzqIUKEkIRCXMRiWgDMJYVCRxySjU74PG/f8Nsphalju++nYaMVQfYdDYTbfSZMiYuSxLTyUqB5POsHGLfu82uesiqi3YsRN23AfViZfwvo7Pn+gU0BSS4WYT02hA8DV8eVKh2lGzfobe2vNkvaPOB7TWbHS6bObQkLUckgvI+tG1bk5FKqQvSbvr1IzsxNXqC1lfnPISvIov6mpzOR7aMe7XhrmzdA377hW67/13NOoVWrpP9cEHYOd+GN8LpWqvb2QHQ706nRbM5I7pxPNsxdsFTOOYS0boDLrcGnj2lWIrGSgNtijyA4VQbWMtURydpSyeK9MBPk2JpME5A10Bteo8jdEv010JuaqQl4HVzjpqkEJSeVWnwea9/lM21ktlu3tUxyVlkCibUJYFLhqG8YcWMJMHcOnsu+vyO+uuQkgqFCqGuHq1CLIT14YXiyydcmk+paSmcILNXo6t1mHXfrC7vkUl/8qaHCKq7GAlLendXGW/rMOuKdqbfay1eAGDXpeo1yMkgaIIU0aLRRNJet0ey0tL9DqbNHeOQqUJw7tBj36DMjvEyJ4v2sYoodgEbaDwDAbFVKiwJCAv0FNpKhdjOfQCRf9xpJtuZzAIW4HrqBqoIfAKmru+gY8u9XJ5zMBiFEeXKfuP431NC0m9UiUCEhuBC2DNYunciYHrHa4a3kYLlC8osj6htKzlmlE98vIm5qTsq05NWoYbNXAZvbVbsHYXansOEscX40gvBQ2gl6TSSBORVMcpKztADYNqnsM2v+Z0vLVlW+Z0N9ZBQGRUO3ehYyhnBWVLhwRR5rnQf4lesgKB9Aor1XmUnA15flxI1SYfHJZKrcx8/uhrdNef3Npvzg+g3CginzYKjNZLpSsnTDJ6KveaoihOeO/rSqm2MWbOb+0DnrTWvhhCQGu55QeQZSe11i9KKRn0uycbsV2g2zkhh4c5/MUTUBQgYyhdK2AW/zee7vIQQvQX64Tyf6Doe18zkT2fDQano3r9hbTXPxHb5AKhcni1UK3UDDHolXTiURAtsGNPZ+jlKLFz5frq8xpfpxgcwfuawC6IEF8EgVEiI44u2SieWXcCqTQkDYjq30bEFwtvMLVhyru3iKymXqtCkU8i41Fj7csDx2kQMEhnHvnrfx0mBLd+/Bp6xLG6vsbG4h2qJsF3X6c1fom9HzvE6ON/DRrNxdDPDnod6BS9U00bbG4CXoNyAVWk0NvE9DtPYJLW5toG2Cp5UbBz9158EShQbG72nm7Uhk7KMHgG5093MzdpKk2E7FDKGJo7GOR6vjStmp789Csf/9tfO0bZgdGd0JwANfIPILqELifI109TqyGFx+cDYtkg21xhbHgvjIwSacnBT32KViQgbsLQPqhUQMr/XddFKUVHIjpiK+GhTnAtqUSmRVhyQbSs4G0GnVNkHUYqmmxtGdF0mKIL5C1fZieFiHKt5NxWIHuoBymsF9QIql0GRYZFBkVaWsYqY2Rq6GzkBww9/Kmvfv7LTWykKer34erjL60FnpL1pKPd5hmjs2nosNa7RdzUpCKlF3KqtQrZIDsU1WpzSPlEnCSYIqJf5IR+H+F9XUiReedr5PkJQoiIk4tK6Zm8cCgTkVTrEPQy1Oa42Tk6TB1TrhG8QWUeTHIhG+SzulZdvjPg+cjYy8O15rmpL/7G13h9lKtv/oTVu23WVtfpdTdY6S2R/+wn2F37uf9wyvDME9ND41PPtQue0ZYlZWinOU9XTHKBpPGVdiejXhlCmDqbt1dp7DMQVV8Z9H3NJGZRSMWg23smiVXbaoMUgqIoyPJ8ywhFqjb34jNKNDKqEEkBJgYvsiKIzETJC6HMTurmyAvQm7XV5qRXMZubfYZ0DLns5EbhssrkQ79+CnqfB62hPoZLZSev1y6vpeU3h+P4W8HZHK9RUYI0Fm0TcBJk9ZUela/0qJCVBioNMhGBtLCyRlZ6Ym1Je5tIAcQR+PyEQS5G2px3BUTWoKSgVq0SRRGU5ZYhS7//OLF9G6lQWlOEew4/zSZJo3lureRJ52klkbyQZUlHyejLJqqcJC2fL3VS88oyKBw0RiHUrpZx40VF7UxhYnDhcTx4XAtjF+iX2KTOSua2bBtNDKUDrdpKivMycNpTTlDkOOe2jCKUQd1LZ1KSdpwk84TwOxsbm0RGUB9rQpKA93WEyLTW59OtAPYJIQQlio3MMRLVQcSXEfFF8kB7s09dKpTyGC2hzECB63YeJ5YdLUTueoPjjSQ+W/r8L8S8QP+v2V6lg/Tp2ESLVqoujhZCdKjVz5Nunixv33qyyPskjSrk8iiDHv1BSmVoCKJaR/d7h7q3N4LW8cVaFF0WUnbyXnYoz/PnjTGLjWr1FQbl80VRTOV5fkBrvdRIkgs4Oe362SGfF5OZSy5ENr5IPjjMxobFuS1PfO1rOrIvluHPxgeJX9hdIQjZL7VYIhAmPu+lpvQpZV7ifIiI1Qpe5JHVDHyB1ZAoB+kalOunIydyCnVaJ75O6UbRagWpl4yUHSt8XQu5pHw5RZ7OCKWR1t6LBHNQZgcR4MsSEQRKG7QNSG23bC/clouNUVyNbZjHZfNs3oFGxK6PPMIuKhDXoMwY3Flh+cdv0F5ZYvFSxui+KXhk54wx9cVMuuOZcIe80ssuTqZTJKsbm8R0wTiw6Qz54PCOesLNIqefO1RcRVZqV43RZKXtZM7PCqFWlEleI6pP5iJiMwuUyZb3SRxHtOGQr+95KXG9Y4gBDI2+4qLhb7kimfN5OB5rd45QTKKap5NGizUPnX6XA4cOon/1b0C8A4yBzg1YuQPObLUER0auUubkWk87KVs6mKs6RJckvg7R5UKY3Ikty70tA/I/a2ahQtHWQS6FMosQriUkGK2xSUyuNL7csjiUwtcEof2BIb7Ed0JQWw5DgDAJIq7jlUDYCi5A6fzxWJu5uLHjW6IRn0DJjtAjz6W61nZCH/KurJelr5uiBKWoGEWKQ+Y9TN4D1yOKojque5woMFQxlCsFg9IjlAIbXdbo84Xzs2VZTGofLCJENopRNsblnnzQwXRWJ6nUplAKpS1eGDb6OXGQ4EHqaH6Qc0ZFtL2L6p21myfrvRR272ZytMJk6qFf2brBr7/L23/8B3SyPotv/YRk8sPErd3P2CJ+O6d6IAtMycJ3kC5HCqI4RguPlZZYJUC0gK6+IkUx5ZzIlRIIqZcI5YStVLHVKln7LnHRBXrA2lN0+o8zWgNXsL7ZQ9ZbNEZGQZmrTviaDwIj9Iuq5KjM0sle7tBeImyCUhIkFIFZEYkXGB5/lrpqoS3YRu6i4bNpsDMqop3DNGk21Qwl2hi0VgRfQH8dfDoTS4cxmqA0/UG6lYMVPMQWay0UAucDwTvIBwTZPS5yd1GbIUqXbpnSlwXdzU2GKwZMAN8F/FG8PozKqCrP3bRP5i1sbECr/7gytXY14hUJnTxwYODVyRL1YkL0lTLowwFJlMQQVcHWz/fT5HLIxSllaGvcsgks+iI/hHYtykCKYaBipNDkMsKioSimUB4pQlcjO9SaC8Pje6fbw7vo5ClxdwU6N5+omh3HkdlJYkOlMYTzkMkEkjpIvUxWTPVLd5okuYoxizJJ0MZSlJ5BmkF34yC2cQCrSZIYFwT9NMcYc68XWU4kRuR8IBL1eSs4+R837/B//wkTtNQdiUAo5l0engr9wSFtKq/SHxy+dOkyN2+8z6c+/XF23L+Xm9evcun11xkZbfHIoUOHa40qNy/M0717a2Zqamqm9alPYTfXefP3fw/v/fhHP/nJw0xOEt56g7cuXWJ4eHhy3yc/dRhrWPvZz3jj2gqN6SMzj37yyG9mGx376vw8kTUc+fwx7M7ay3nqZoMy9s9sYYZg79kI/vvxQ3/53VihZguhJ4PiqtNJlPt7vqjS1+mvj+v0LkNuhWFZ0O2u4C/9j8i7b8yk/ZS4JiGVLMlJ6vtnqE/u/y7V2pwsXUtSjlu55ZcapKCUUBR9KDdBD46gfT3KN3HddbwHU2liq0Ngost41RY+P2CKza4ifS57/Q+PXfuD8/hrFxkZbjB88HPoo5+A+gjJ4hV2LLxN59pN1m+vEzp3ET4bJyQTpSvHS6HGCyqv1ndNHR29/2HSXp+s14G770HUOIzPKVev0e9skDSGGRnfA3F0SWwtFbdL78c3szwarlVelZXhJ4kb9FONDsCgjcjWT0sz1AlGWOpjv4ksJ4p45OkN9JlMcsorag2rWzarvZwkY1PDk48cG+zcw/rmbapFih6ubO02dnvwJz/grX/3BxhZY//nfwMee2gyNCR9xeMFcopQmSPolxIfbCB+IZXqRCGZEiLk0vuOF3JeCn0CQhvAhPIcPpwyogQFReFYGxRUnSIrJSYtGfH3nBoIeCFnZQjzKpRzEnfPJtx9TVXqFDKmzPto79BFl1rotiiLM8Jlh4gaL4F9W/vaCyrXaGjpoJcTX4FQfYLhPdP7R/cirr1PvtJGLr4Fu8ahEybJUoobb+LWbxFLMDbesnUsi8mBy0+h4nPOuZNamUW0ayljDqalx5UFSehDpQS38hXilA1dYOsVur7OfeP3gbILWdgKe69IvhtJMb+yvPrNK//uO6Tv/BFjJqO6az87/87/E1Bd2j+p2cs/w99eYu3dH6M+cRgGe75ZV8MXfPDPdX28aJR7EVE8hyiIlMN3O7hC4Vc7kIscYRestEuZ09Y7gZDmHK44o1stRqf2crt3jf7gNmwuwM5WDVU/zDvvsnF7EU9gfM8koxO7QYj5PIintDQnfoxidQAAHDZJREFUggvdio0vIpIFW6lOOx3hRR9d9sB3Zmye15BmFiO7mEYLU7uMrM2lIummjtmgiUIgUtou4BWR1YiQYxlA2IDsxtdVcZu43EAqR0WV3Neqge9AvoGmxHuHNhG1Wg2sxITsoAjBylIvWiNyWs32vn37Wjfvvo5PO7D0Llz5E+g52Fi1+A10/y4VHTDVBIyCWGTDiqdF2ZsFX/POL2mbvKi1AW8XpNKHpVT3IsgECNVWJmp772uR9HOxLudEcLNOqTZGL9FoWVcdfnJD1UAUjCYNbLX57TAQuZEKG8Tb3rk6pvpKddfU9O2RvbQXf8pHyjb0FiCJA5ubZIsL3N0cMDSxjx37PwbVsQWi5rnSy7mydKdiyTy4pxCCsiyJtCIRDvI1CI0vka8jXUaJREY1hLFb3tuhHDdS5AjZxft6QOR+ywP9L2+GGYC4ol8oc46jQGi1lGVuRhfFVOF8vZtmrKxtkOYOdNx2TrZW2usMcsd9k31qIyP0O5us3r3NUL1Kq8igzNhca5NlGen6KvH++8n6XW7dvI4vMvaFEgrPyu1lbt64hd/Vw6GXu1nJrZU1hpp1yiCxXuRZ4SaVku3/MPk9WEGYE4Tjv2z9bF5yQBq6QulMyIAw5hwinKbTpTdIEWWJkyV5lnF14RK9d96j1+3Q0gPaqeINP8UjxywfnZgctyp+ThTp06HMp7EiR6p8oCLbNQn9rIv3JVK6FiGfpnQMMlhOLaoxShYNY1XyGkJ2pZedwm15xEaPfITR93/Ku1d+xMriEk39Ng/Vd6BHRshuXOX27WsEHRjeOYYYGgYERV5MaquWKzZ+daPozoxWxxh7cIblW20WL7+B+c6/IR/+MUEL2tevISrDTH74COw/BD7YQb97XNqkK7XuZi5qQTjb9eb59dKiiphhXYe0D0X/cWuGXiphHKna+BCtZfK5ruSJIIlkRGcgOTzwmkQ0Xqrue/TYfR8/yvWf/hE/e/c6u//5vyTs2kuv06f71ttsZJ499+2CiT0w1HxZKIUOLAWBxUe4oPNMcM4LM5tLDnhBzeAWBT73WIJQuSB0wEUyuBM6eBKjl0Evd72dXi1jCtmk1A0i1QCV5D8fDyCtF35Wh3JeB398y1RdZF0XsVJE+H6fEafAF6Bci6x3jCydAfs2iDwX4aQTZEERCUGOiOfRtcfxg69W9kyz6+4tFt/6KT/9wQ9pvneNlU5O6R1V4yj7HfJI042qDEqIi3Iic+VEpCVCqjYquozPD6RecWPTIVxgX+ao3rOxzZ3jViclRjGoDFMf3wfCLHrn61l/cCgUSRTVmd+1d99/K/fu/+bCO99nfWOVeLRg/Y9eJfWiNty/wu32GjmaZHgMU2lAHEMQuVS+bkNxLjYa3NZ8f2CH6eUbbBSeO5td9m70DzJm5r0xIMSJ8EGQF7IjRsdfPvCxI0/I3gpXLr7KG//6X8HwjxFRk8F6l/XNLgemP8zEzGdg5wQIgfOhFWlxNiBnhYpewOuThYqmVwcCURgGhcPogBGDuqfs4lxrS7BnF1IdXXbStJRgpcwYN5bFSqV6lr75es8r7vZyaiJiKs9BlpD1ubOZEvqSrmlQGdsLxZb1/43NEpNZRNLEN3aj4kaOjy5T2gWCyLNe/2hUrb7SfOjjT6Zrt7j2xg+5/v1LVG9kdItA2lln70hCcWedLNPIap2pgYTMtUqTod3gsBbBRkJ2rRYEKcBvPXJu5KC1hNSB0EvGmHlf5hgZwLtZV2QH8zydsar6Cl4vrwXLLW8pC089FzS87ASh20ZKrJMLZeZmUNElMf4AjYc/SbcccOnST9lbFNxRv0dnkJPffpcyHmX8w0cZ+dyvg0guoOI5oTXC5flW/RZZmQe6TiNdQV1HW9HdIZsmT+mkJf1cI6OEkeYYeAl5MRWCWcSJzAXVRpu2kHo+bMWF/CUVTBHwCvpFf0qaGFOJzusQT2DNohnd8cz0hz7y2/umD7BjdAREcmHn7gee+MznqiSVKrsmdl/AxBcnP/3rX5n8lCdJEhDVvKi07MO/9rcRQqCbTQj1i9FDn595qPoA1WoNxh/8NoN0pvloZfJzH6/garsuYJIX68M7nv3V478xOdSoY6qN9ub65pNRc+xUHsSprVSKf680hoAQHwQs/5JUssHPW8pJWeqOkqHtg5tFGhDiBUT1eb3rQW5fewuZSPJaQi9q0hdVSAq86hM5GI9209wxTIjr572oEAiXpRA5rhzHq/aGGRrPdkyR2lXueMWuzU4NYaa7g4BoTpEPG+TQOIP6Xuo+vhiCG/VCLw1kpRWMeapS1p8afuxvhv22ztVLF1jtbPC9l1/C9JeoxxE63kHtwCGGDn4Exu+HEF2V2IWaMnMZUPrkjIx2/oPWQ5/9qs0NrqxxrbvB6s2rCC2ZGJtkbHwvjU//NRh/BAoIpDPWmjOlF8RxMu9DRioriJG9EEMysRsqw2DtgvVhTgpBUOF0KUQmg+hEcNkragraAaKgtS29PKd3TH8l/sSxmV2VJquvv83b765y97WrxLUatV3DjB37KLsOPQr7PwJKdrorq2dbydi3HQIv5bwX8nguOVVKJkrBuISOCnlbEmpOaBAi1wCi6ELZEvj66sbqkyMhO9i3o6jxgyjjKExCp7KbQTdYWxO5DG6ulOakDHRUcCcUrgWqjTCLm3oEOXGIiuvSuO8A6Bi2Zu+WOLqEMleR5pyUGgHHkZB7pqVX8wnRJcpomQ99enx09x7srr28denH3Oh0USZmtLWLyT0TrK62udW+S2qHcEkLUW28FBX6RefccS3EHKU/Telrang36r5HkT5lUw9T7UmIqxetbM1UG/vRFESVSVS8A4pgE8WL9dHkxc2BO7WeyjOtWv3M2Ec/9c3e4DY3L/8RC8vX8f/j/wsjArHIcNJQ2/cxxg4+hps8jIru+5VykM7IoNpZkT2lpDirnVkUld2o6aPI4UlascHv2U3b2rZQ6ulSiQklaEvnZ1Xwtt/LDlVNfJH9n3ziQa9oBMva8nXuvn2dVNymOjbO7kdm2P3RD8O+D4GpvuLy/JTYMhUnMnKeIj9V9npHC1PHjT5I3QjEyB7QUY5wLYnI0WaRoG2pKq+WMuloITMtWFKubOucpYCfxakuw7trYtcDuKRKXzWoqCqoJoMdH2Zg2gzihM2RgwwxStaE/thHUGWBrjXYHPkQLTn6jQ2fLIkoyUUQtVzKbqTESfZ95skdqslG40FW332bdS8ICiYefICkWUWMTNLtDChrE7T1HmI59G2voxNaZAuSYkp71xJleiL35XnycrywTeTIJLVmkzIeQQfVDsETisEpj+yEEKIsLyeU0MtlEWyBfdvsnGR85gjBl8T37cdhFl0Q1pYBi+jkXnbQlRfY83B7x2ee+P82xnfx3ve/w43bq1y5cx1dHWLq/gPcN32IkQ8/BkP3fyPt+jraIzQEIW2eFydj3KirjFKfPMS1a+9T8xXY7EGthF7BwA6zanfhVcS+qUNQHQH0kpdmMaCX0+A7Wtp5IRUh+L+QgikGg8H/QktRIIxlc3PzbCWyr1Zie75MeyeNCFZavcygf5Q4ukyazuCCRellhOxgo7MICWl2ijg6h9wKO/ZuS2Eh1ZZ/onNuNk3TmWqt9uzPxTlKkfZ6p7339Up9+LleIWYTw7zsrZwhDA4T2QW8ag9yvaTrQy/0ck4LyGM/OKdDcVIGX/NCdnMRveiFmpXBzYtfYtFUSuG9x3tP4cJJr22tEasXxMbNuc57F59oFMtbv56SYYiGQDdAiq12jihgUEDzPrqVB/5WRm0i9v5S1cg5RAH56otsXn2SbI28u4rdNQWth75BKTt07z7L7Zs26/YYqITGA49+Q9aaZ/Ks+1QpzOK6rz5pY7FAH0YTf4bVhcCNtwh5l86td5FrC9TGRilVC71rH+zaA2NTl8lrc+TxReL6+W63eErV9dlY54hi7Xn6q6dZeg/aN7ndb+O8Z2dzDDU6CbsfuoCuny8z1xImuqy07HQH+XQho7wSmbNu7ealjatvHBwRXaJKDXY8kFPd9eVeaTto2Y1076AQspOH5gs54lQh/ZQXri6l7ChHO/bibOK7Jymv/zM2b1Eur9Jvb9IgJguOQdNgd+8gmdiNkM2XoPYyRfQiqfm5NV4pmSuVP+6ka3nh65KyY0PWEl4vl6HREYFcB+YFBV6lJ7wsJ4yJzppQnKK9/Dus3vsuvaCTjFEb3ydclp10Qb+YysopGUKn4juRohwP0i4IXCu99f7vpO3rDFkPUQVGD3w3RPXzoug/TpK8FjJfdzK+WOp4rpT6eCkYD4FIejrWZ+cSmZ5CDg7jusdZWx7n9k3CoIeIoi1BRVKBNCNb22RTJux45JMXqI8d6ed+1hW+lkiRM+gd0xrSW1e/kvfaKA2yUiMZ3XPZl7U5WQ6OcOV7RzGBrmtSO/DRl5HxRWx80XnXyqU511OVM1b5hYZcH6dcOcPNt2rl1bfpLt9AFQN8mZKM7sbsfRSx/+NXXbTryz2vWyIUmTX6/HpncDZJqhdEIKsbf7689tNAuoKuSkJtlLX69G8OdPNICNgocKnuet+NQjmeDfLpWIocWY7D4Ah33zvI3WXodEFbchNhJ3ZvqYd15QIuvpiK+GIhVAcgkj6SxeCwLgeH29evzCQhpRLZrR8uO/deyEX9vJeqHYfBYYRe7qvhMwXqlHJ5W/kit0rOF0V+KoRgEzk4wtLPvjS4ex2nI2oTUzAyvkxajvvl22SDlA0Bo1OT6HrjpaLbO5bdXGr5NGMAtO5/YMGPjh/YzMSZWMYXXU4rjjgnXIolPY3ydTqrT/du3xwfdDfRwjM00oQkgmxAtjmgJyrUdx94iaGJkwUgygGW4qTPBoeVMotpiC5XrJhf/fHvBzlokyQVovsegrFHRO4VZW/1aaNlJ5jkBVc6EqsoivxEaiym7E/Eq9d+G6NgZNc3clU9o3pqVkk1X8rB8awox7WoXY1iPU+xcob1xa/TvwO3r9NfX8dUm5iJ/bDj/mVs67d6ucik0ssoM4eOKFw46ZxrDev8LBtXwuD6ArZWQ5oYMTrRxsYX8a7F9aszYdDFG4NsjCImJv9b79RKgbkagplPM3faRskLW8Y5xbz4/yNP+f9UwXSCWWdkq/DllAphRUFbuKIlXDmhhewYITtSyG6ZleNKmkUhVF4Ubkoq05bKtvvZ4KCK5XNpPnhaKdWu1+vnADY3N0+XZTlhrV0QQmRKqfNCCEIIhBBmvfe1EEIUlM2yYA7VInUmStvPlJ2Vrxslcpqt38IMPdvJ5YlSiAkJncgPzpmQn5LB172QnUJE57xQiOD5ZRVMGTxWh9kyyw4KpZezrRvn08awqIvB+aRYP4fqnKAsatjhl1DNf9JX1XkZIE7bzyA2vkTUncZbVvLd38hC/VBD8GJFc15K8D6l9JvPRYnIst7aU9jaXKp2vpJ2y5md0r+C7x9C94/ifZ1k55EyKIqif8qpqL2aR0+bSCzWNHM1x3mRrZ8mFFPY2jP44iTl+mlMsEjZwSQX+uglSfyCzAV6IE5JY89la/3zrhbN5SG3sfbLsSVHZAehdwy/cax0AS1Hvo0ZOTEICf2CZ+q6fNaKbJas80UXYLPUy0m1fiY2AnwJoTgFerk3kNbLyIayiLQqOsr0jmkpclVWXvXe10s2n8xDdkhHlVelqs2VWXJeELC287SSroWLLpO5FlJkuHtm7Fp2nZSdfuFaeRFscDKv2cYZ5dWsCsLK4Cwiz4NMp4PMDgXhWgHZcdReTmnYELA6sCwJc8j+bJDleJq7iQiyWllMIYNFiRwvO3dlDaxl2PUvCh+inmoAUHUbVuHrhUrOBmHQSm5FcIX+aYLsdoo489rWfdqv12N9Nut1nkGILCi74JWtB2VtENgt2y86wuW5KAbjIes/Xo3NIrFZBF/HB0ueT+PKCeLkAiq6hDJzHkmn3z9FCFaHEFWNXvL9wREZJ68h9XlsjBeCFPBw/G6XZ8cSfrPqVg8S0hlU4yWEmfOdteelUW3XWT+thsZ+sxc1lzf6fCnxvQvDCQvQO0Zv80kqjZfIe8cImwfJBlAfW0DVz3tZf6bdTZ+1Wi3ESf1cu5e/aBO7UBRMjUacMm7jFK5zYstIvPJqV+58pSc5Jh2dqCguN/zaDEpkRI1nev1yNvdiOjHqbEx2krx/FEKEjS6hVBtlziENWV5SOndcSpEbLeaLrH9Gh2LKSJERRZfxgIrPgqJI8+MZip7Qx4Qkr4TsVSn1XCrip3FQLTaXo7J/lFgvk7tWKpMLUWxeFLL/DPgasvJdUPNpd/XFCNkRtvll0Fu9PBnI3eCUzLNDWkWXCMES3CjWLJbAIHOtum2cLbq9U1oWE4NscDjo+KJNqmdMFG+J+9LOU4R8miKdwZpFjF3YqguqTZCd0gfbL0JURhVrtVqw+cYhicj6VJbrlfhF1pbPiapZpPR1RHTJxc1zJRD6vVmh5HwZJ7NbaRkD+mnv8KBSG6/G6pV6sXYELbJc1p7ZyMpnd4TaM6T5aaJiuZR6rpfHp4LAGjO4Klx/JnK+por+48SuhVRtRP08dvi5PoK84HRN+hdcnhJ0jJeSvOR0osILkeyeIB8cIRl6uig9rts9o8py3AiRo+0CcXQWrQllflxE8VwnTU8IFeUIQ5aFQ7ERF8uCcavKc38R1njq7/7dv/u/pPq5kvviWGyjn0opBr4sh4zWN5Q2N7xDCanWQ1AbQtl/Km3yJkItFJ5HTBT/U2HFFeflhBd+b7Ve+6c2in/S76ez/f7gCyaKXkgq1Ve1MZcQ8s2y9MeFlAsIgXPhkSiO/wdj7aU0K/5qpRb9vWyQnY4U13W9fh6p7xRpeV/qhCqCmJBKdUQIucJdkoT9QmzNNbxQb36gTPxlzTEFfla4YtKVxf3G2gWp7YKXaqJwTJWlO5LU6v83hO6GQg1S2fzvO9Qe7gm+XEgeywqzbqW8KIv+MbzqumjHCzZWCwZ+tyw4njt3ICi1UGobIZN/NECJYJvfC8JGudcHlDR/zwQxBkWLNPtoie130uIIAkyUvFR6OaMVyz5juLPR+b/WKsn/g7j+e3f74tmuTParavM/74m66ng96KKHNpz4Da/iA27gD1CEURPp72llKiaR54Q2F720C4Pcf4ogr3qpl/Ko8iNn6t9FDP0dJxNWUuaKwP5GLP97ivyRIu0dM3Hy/Sip/ZYLgiwrZvPcP+qxL+VEVzZz8UxS1b8VKX1JS7/gKT8lfIhUkB0h/JAS+cNauNHgfU0Ec6Ms1Sja3p9L2R8UIhchOZdnPOJKV9Emuoyu/iMf7PdyJ78vZPSqtrE2NroRAg9AmJeE+7cKZqkE5X1CFPslwYK+44VdcEQiCKyAXAj2ClHOC9ifJPUX8twdEEF2tUq+T9B3MNV/WCbxfS7IVuyLqyKEqBQmEwSnQ5kLIXInzKVSGtb7xXNZySGjzLe6g/JQP9gvJIn8QeH1lHN+fyWJz2qtLwgpF4TgEiHs3xqhCBWCqOTOHxAmbsuo9n2VVP9xGexPNrrFY0EkzylbfxkRvZTncmwjl49gk+91B/nTrix3JtZcVgK0jX5XBCZQ9qW8lLOrmfjbAym/sDYI/7DU4j4RkaUFMzovLrhBMeVV5e9lWXGiLLJHTWKvyFrlD0HfyX0ECqGkbQcvzysnRVC1/2ngK2fTUruo0vhuvpEeU9XWC5vtzZNRbfgfBqEqRZ4/YKPke7kXj2sj7vR67tcEoqKLgVZ5eR9FsD6T3T7VgVSiE8NPtS/Pm3JwAiF8P3WHMmHHSCqqMPqIN9HVfoj6ma5ccTp5LyvAEb25kXOmEOaIUvqOJPybyEiEd4eMlF2k2qAM0XonO9Qt9KPeVOqdjMd1NV5CK4RUuQjClU485oIaM4IbFVHeERpFkR9AqnbQyT/sl+GEDLKde3O1Q+XhzcydbFZr//XGRvdvxbbxu6vrvbPBxv9TN8+fKr3DaLvge+nHFXoZHyxCdvtpOoP3Q5GNXwlZ/zdUpNaNsVd0pfH3+gUnewXHgtQXChe+H9AVZeIfOSc7IZirzqu2UNE/Lp171AiUNva9LKgxbc2yISz7gOpl7mFt49/r9AaPJZXGM8j4lU6/eKxbiF9TSkfSu3mPwGn9Ke8YsiGcV1q9qipJJITKy17nYJG7nZmJ6kKYXOVhZ54OPi61WNJJ5U2k+EkeeFxY7bCV6yGq/qPCJzeMsT/ByU6vsO/lKp7KBbMEtBXh+/mg95RH7NTGLBSlP5IX+WPahzslZvF2P/yW08kD1ib/dx1VXi6E0cJW/2nqNZkTx722c4UP9Abp31HarEulBsGLitG86Er3qJLhJ+IvqyUbtjZLCCLMisAvktPDL1S0H3i1ij8VafuL9PqtUNQ/bw85IAhCboUcUyKCPy4IdiuwVc/5Ldcctpx0PAKPCPfe8z33+19mO/aDZPmtP8S8R+KFIiBmRfDzEocO5QmAUujzTuhZh24JyFQoz2vyWUU645GdQlTOevRxFcKcCFuuEgF/7/P1QJgNQuIxNRFErkKY075Ek5+EYAthzm0F/AaCEDj08a1wX3KJn1ehBARbAdLi+NYqhb/3OsF6IeoiiEx7cV5tmefMAjgp5oP4wKAwIHAE/KyXvgYgvT4fUJRCnwDQoTgvccjgTrAVvDv3wQ+bP/29e6FmRWB+K5rNgXDHRQhWBtmFYBFboqUgRB6CagfM3NZ5udf2DwIRxD3j/3vvTnxwpn9xKrb+DciwlY5zL9z3eBBbuacB2fGo8x5LQM4Kwr0Wj7v32Wy9jgoBeW+s4IUgl+Z4EMFaX5wXbO0CAvfO8VZQ879/fre6Ono2IOxWwHCYF1sBuffCde+dKvGnQ6P/bLD0Lz7BD7oc96KUhbw35r8X0xvCz6/lD65jj8QJhRfieBDYgIw8oiZD6EYhfVEGP+vFVnSdDG5W4GuCEHlUuxB23gt5XIawpQK+NzvyQgEeHYqTAl8LyG4QsuNQcx/8P7ainuXx8EFAMr5rQjGvgjshgq97odq5iOa8UMdl8HMShwrFcUGwTqjzDoUX6vgHAqutgOw//blwLxQdBH7+Xng0gjArfh4SLfKAnPOoe+HqWyHYXoiaIOQybCUuedRxSZjTvkDiTogQoiBkxwk15/ngvAncvWB0RbkVlB3kvSDrrXviB9+BCmH25/esLT3OB+d3/l4u8PGt+52cD8h762Mf3O/+7P0l/KkzIUL4wFlq69yF8p6/tQIEErd13u+dJ7cl50bea186oWcBtC/nEVDeC5XXW+kftpQqJwi0F/MyQBCeIAQefe8a8/dWsuS8DB4diuMQrBPm3vcljwvIVSjnt4K+5Z8NkL73Psp770MGPy//1BH/xTUcPtiA/MU1ET4IUA9/6vr/SyiY22yzzTbbbLPNvzdu2/4Ittlmm2222Wa7YG6zzTbbbLPNdsHcZpttttlmm+2Cuc0222yzzTbbBXObbbbZZptttgvmNttss80222wXzG222WabbbbZLpjbbLPNNttss812wdxmm2222Wab7YK5zTbbbLPNNtsFc5ttttlmm222C+Y222yzzTbbbBfMbbbZZpttttkumNtss80222yzXTC32WabbbbZZpvtgrnNNttss8022wVzm2222Wabbf7j8v8D3RQ5SxpuC7cAAAAASUVORK5CYII="
                alt="DataPattern - Ensure Transformation"
                className="h-[42px] w-auto select-none object-contain"
              />
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
                      onClick={() => {
                        setIsProfileOpen(false);
                        window.localStorage.removeItem('dp_profile_name');
                        setSignOutMessage('Signed out successfully.');
                        window.location.href = '/api/auth/logout';
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

          {activeView === 'screening' ? (
            isScreening ? (
              <ScreeningProgressView
                jobTitle={jobTitle}
                candidates={candidates}
              />
            ) : (
              <ScreeningView
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
                          <div className="truncate text-sm font-semibold">
                            {
                              candidate.file.name
                            }
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
                            {result.candidateName || 'Not available'}
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
