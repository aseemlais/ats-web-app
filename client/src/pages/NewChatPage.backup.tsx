import { useRef, useState } from 'react';
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
  BarChart3,
  ArrowRight,
  Search,
  Award,
} from 'lucide-react';

type Candidate = {
  id: string;
  file: File;
  resumeText: string;
  status: 'uploaded' | 'screening' | 'completed' | 'failed';
  result: ScreeningResult | null;
  error?: string;
};

type ScreeningResponse = {
  object?: string;
  output?: Array<{
    type?: string;
    id?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  response?: unknown;
  output_text?: string;
};

type ScreeningResult = {
  overallScore: number | null;
  recommendation: string;
  summary: string;
  matchedSkills: string[];
  relevantExperience: string[];
  education: string[];
  skillGaps: string[];
  strengths: string[];
  concerns: string[];
  raw: string;
};

const RESULT_SECTIONS = [
  'Overall Match Score',
  'Candidate Summary',
  'Key Matched Skills',
  'Relevant Experience',
  'Education',
  'Skill Gaps',
  'Strengths',
  'Concerns',
  'Final Recommendation',
];

function extractResponseText(data: ScreeningResponse) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  if (typeof data.response === 'string') {
    return data.response;
  }

  if (Array.isArray(data.output)) {
    const message = data.output.find(
      (item) =>
        item.type === 'message' ||
        item.role === 'assistant' ||
        Array.isArray(item.content),
    );

    if (message?.content) {
      return message.content
        .filter((part) => typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n');
    }
  }

  return JSON.stringify(data, null, 2);
}

function getSectionText(text: string, title: string) {
  const index = text.toLowerCase().indexOf(title.toLowerCase());

  if (index === -1) {
    return '';
  }

  const start = index + title.length;
  const remaining = text.slice(start);

  const nextSection = RESULT_SECTIONS
    .filter(
      (section) =>
        section.toLowerCase() !== title.toLowerCase(),
    )
    .map((section) =>
      remaining
        .toLowerCase()
        .indexOf(section.toLowerCase()),
    )
    .filter((value) => value >= 0)
    .sort((a, b) => a - b)[0];

  return remaining
    .slice(
      0,
      nextSection === undefined
        ? remaining.length
        : nextSection,
    )
    .replace(/^[:\s-]+/, '')
    .trim();
}

function parseListSection(section: string) {
  if (!section) {
    return [];
  }

  return section
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*[-•*]\s*/, '')
        .replace(/^\s*\d+[.)]\s*/, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 8);
}

function parseScreeningResult(raw: string): ScreeningResult {
  const scoreMatch = raw.match(
    /(?:overall\s+match\s+score|match\s+score|overall\s+score)[^0-9]{0,20}(\d{1,3})\s*%?/i,
  );

  const score = scoreMatch
    ? Math.min(100, Number(scoreMatch[1]))
    : null;

  const recommendationMatch = raw.match(
    /(?:final\s+recommendation|recommendation)\s*[:\-]?\s*(strong\s+match|match|review|not\s+recommended)/i,
  );

  return {
    overallScore: score,
    recommendation:
      recommendationMatch?.[1] ?? 'Review',
    summary: getSectionText(raw, 'Candidate Summary'),
    matchedSkills: parseListSection(
      getSectionText(raw, 'Key Matched Skills'),
    ),
    relevantExperience: parseListSection(
      getSectionText(raw, 'Relevant Experience'),
    ),
    education: parseListSection(
      getSectionText(raw, 'Education'),
    ),
    skillGaps: parseListSection(
      getSectionText(raw, 'Skill Gaps'),
    ),
    strengths: parseListSection(
      getSectionText(raw, 'Strengths'),
    ),
    concerns: parseListSection(
      getSectionText(raw, 'Concerns'),
    ),
    raw,
  };
}

export default function NewChatPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeView, setActiveView] = useState<
    'screening' | 'results'
  >('screening');

  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [selectedCandidateId, setSelectedCandidateId] =
    useState<string | null>(null);

  const [isScreening, setIsScreening] = useState(false);
  const [error, setError] = useState('');

  const readiness =
    Boolean(
      jobTitle.trim() &&
        jobDescription.trim() &&
        candidates.length > 0,
    );

  const handleResumeSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    setError('');

    const allowedExtensions = ['.pdf', '.docx', '.txt'];

    const validFiles = files.filter((file) => {
      const name = file.name.toLowerCase();

      return (
        allowedExtensions.some((extension) =>
          name.endsWith(extension),
        ) &&
        file.size <= 10 * 1024 * 1024
      );
    });

    if (validFiles.length !== files.length) {
      setError(
        'Some files were skipped. Only PDF, DOCX, and TXT files up to 10 MB are supported.',
      );
    }

    for (const file of validFiles) {
      const duplicate = candidates.some(
        (candidate) =>
          candidate.file.name === file.name &&
          candidate.file.size === file.size,
      );

      if (duplicate) {
        continue;
      }

      const id =
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const candidate: Candidate = {
        id,
        file,
        resumeText: '',
        status: 'uploaded',
        result: null,
      };

      setCandidates((current) => [
        ...current,
        candidate,
      ]);

      try {
        const formData = new FormData();

        formData.append('file', file);

        const response = await fetch(
          '/api/files/upload',
          {
            method: 'POST',
            body: formData,
          },
        );

        if (!response.ok) {
          const data =
            await response.json().catch(() => ({}));

          throw new Error(
            data.error ||
              'Unable to process the resume.',
          );
        }

        const data = await response.json();

        if (typeof data.resumeText !== 'string') {
          throw new Error(
            'Resume text could not be extracted.',
          );
        }

        setCandidates((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  resumeText: data.resumeText,
                  status: 'uploaded',
                }
              : item,
          ),
        );
      } catch (uploadError) {
        setCandidates((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'failed',
                  error:
                    uploadError instanceof Error
                      ? uploadError.message
                      : 'Resume upload failed.',
                }
              : item,
          ),
        );
      }
    }

    event.target.value = '';
  };

  const removeCandidate = (id: string) => {
    setCandidates((current) =>
      current.filter((candidate) => candidate.id !== id),
    );

    if (selectedCandidateId === id) {
      setSelectedCandidateId(null);
    }
  };

  const screenCandidate = async (
    candidate: Candidate,
  ) => {
    if (!candidate.resumeText) {
      return;
    }

    setCandidates((current) =>
      current.map((item) =>
        item.id === candidate.id
          ? {
              ...item,
              status: 'screening',
            }
          : item,
      ),
    );

    try {
      const prompt = `
You are an enterprise Resume Screening Agent.

Evaluate the candidate resume against the job requirements below.

JOB TITLE:
${jobTitle}

JOB DESCRIPTION AND REQUIREMENTS:
${jobDescription}

CANDIDATE RESUME:
${candidate.resumeText}

Return the assessment using exactly these headings:

Overall Match Score:
Candidate Summary:
Key Matched Skills:
Relevant Experience:
Education:
Skill Gaps:
Strengths:
Concerns:
Final Recommendation:

For Overall Match Score, provide a percentage from 0 to 100.

For list sections, use concise bullet points.

Final Recommendation must be exactly one of:
Strong Match
Match
Review
Not Recommended

Be factual. Do not invent information that is not present in the resume.
`;

      const response = await fetch('/invocations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const message = await response.text();

        throw new Error(
          message || 'Resume screening failed.',
        );
      }

      const data =
        (await response.json()) as ScreeningResponse;

      const raw = extractResponseText(data);
      const parsed = parseScreeningResult(raw);

      setCandidates((current) =>
        current.map((item) =>
          item.id === candidate.id
            ? {
                ...item,
                status: 'completed',
                result: parsed,
              }
            : item,
        ),
      );
    } catch (screeningError) {
      setCandidates((current) =>
        current.map((item) =>
          item.id === candidate.id
            ? {
                ...item,
                status: 'failed',
                error:
                  screeningError instanceof Error
                    ? screeningError.message
                    : 'Resume screening failed.',
              }
            : item,
        ),
      );
    }
  };

  const screenAllCandidates = async () => {
    setError('');

    if (!jobTitle.trim()) {
      setError('Please enter the job title.');
      return;
    }

    if (!jobDescription.trim()) {
      setError(
        'Please enter the job description and requirements.',
      );
      return;
    }

    const readyCandidates = candidates.filter(
      (candidate) =>
        candidate.resumeText &&
        candidate.status !== 'completed',
    );

    if (!readyCandidates.length) {
      const completed = candidates.filter(
        (candidate) =>
          candidate.status === 'completed',
      );

      if (completed.length) {
        setActiveView('results');
        return;
      }

      setError(
        'Please upload at least one readable resume.',
      );
      return;
    }

    setIsScreening(true);

    for (const candidate of readyCandidates) {
      await screenCandidate(candidate);
    }

    setIsScreening(false);
    setActiveView('results');
  };

  const completedCandidates = candidates
    .filter(
      (candidate) =>
        candidate.status === 'completed' &&
        candidate.result,
    )
    .sort(
      (a, b) =>
        (b.result?.overallScore ?? 0) -
        (a.result?.overallScore ?? 0),
    );

  const selectedCandidate =
    candidates.find(
      (candidate) =>
        candidate.id === selectedCandidateId,
    ) ?? completedCandidates[0] ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      {/* HEADER */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              DP
            </div>

            <div>
              <div className="text-lg font-bold">
                DataPattern
              </div>

              <div className="text-[11px] text-slate-500">
                Resume Screening Platform
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() =>
                setActiveView('screening')
              }
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeView === 'screening'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Screening
            </button>

            <button
              type="button"
              disabled={!completedCandidates.length}
              onClick={() =>
                setActiveView('results')
              }
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeView === 'results'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 disabled:opacity-40'
              }`}
            >
              Results
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">
                Resume Screening Agent
              </div>

              <div className="text-xs text-slate-500">
                AI-assisted screening
              </div>
            </div>

            <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">
              RS
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          {/* PAGE TITLE */}
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
                <Target className="size-4" />
                Recruitment Intelligence
              </div>

              <h1 className="text-2xl font-bold tracking-tight">
                Resume Screening Agent
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Screen and rank multiple candidates against one role.
              </p>
            </div>

            <div className="hidden rounded-lg border border-slate-200 bg-white px-4 py-3 sm:block">
              <div className="text-xs text-slate-500">
                Candidates
              </div>

              <div className="text-lg font-bold">
                {candidates.length}
              </div>
            </div>
          </div>

          {/* SCREENING */}
          {activeView === 'screening' && (
            <>
              {/* STEPS */}
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                      1
                    </div>

                    <div>
                      <div className="text-sm font-semibold">
                        Define Role
                      </div>

                      <div className="text-xs text-slate-500">
                        Job requirements
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                      2
                    </div>

                    <div>
                      <div className="text-sm font-semibold">
                        Upload Candidates
                      </div>

                      <div className="text-xs text-slate-500">
                        Multiple resumes
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                      3
                    </div>

                    <div>
                      <div className="text-sm font-semibold">
                        Screen & Rank
                      </div>

                      <div className="text-xs text-slate-500">
                        AI assessment
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                {/* ROLE */}
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                        <BriefcaseBusiness className="size-5" />
                      </div>

                      <div>
                        <h2 className="text-sm font-semibold">
                          Role Requirements
                        </h2>

                        <p className="text-xs text-slate-500">
                          Define the criteria for screening.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Job Title
                      </label>

                      <input
                        value={jobTitle}
                        onChange={(event) =>
                          setJobTitle(event.target.value)
                        }
                        placeholder="e.g. Senior Data Analyst"
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Job Description & Requirements
                      </label>

                      <textarea
                        value={jobDescription}
                        onChange={(event) =>
                          setJobDescription(
                            event.target.value,
                          )
                        }
                        placeholder="Skills, experience, education, technical requirements and other expectations..."
                        className="min-h-[260px] w-full resize-y rounded-lg border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>
                  </div>
                </section>

                {/* CANDIDATES */}
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                          <Users className="size-5" />
                        </div>

                        <div>
                          <h2 className="text-sm font-semibold">
                            Candidate Resumes
                          </h2>

                          <p className="text-xs text-slate-500">
                            Upload multiple candidates.
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                        {candidates.length} uploaded
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleResumeSelect}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="flex min-h-[150px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-slate-500 hover:bg-slate-100"
                    >
                      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
                        <Upload className="size-6 text-slate-600" />
                      </div>

                      <div className="text-sm font-semibold">
                        Upload multiple resumes
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        Click to select PDF, DOCX or TXT files
                      </div>

                      <div className="mt-2 text-[11px] text-slate-400">
                        Maximum 10 MB per file
                      </div>
                    </button>

                    {candidates.length > 0 && (
                      <div className="mt-4 max-h-[330px] space-y-2 overflow-y-auto pr-1">
                        {candidates.map(
                          (candidate, index) => (
                            <div
                              key={candidate.id}
                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                                  <FileText className="size-4" />
                                </div>

                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">
                                    {index + 1}.{' '}
                                    {candidate.file.name}
                                  </div>

                                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                                    <span>
                                      {(
                                        candidate.file.size /
                                        1024
                                      ).toFixed(0)}{' '}
                                      KB
                                    </span>

                                    <span>•</span>

                                    {candidate.status ===
                                      'completed' && (
                                      <span className="flex items-center gap-1">
                                        <CheckCircle2 className="size-3" />
                                        Screened
                                      </span>
                                    )}

                                    {candidate.status ===
                                      'screening' && (
                                      <span className="flex items-center gap-1">
                                        <Loader2 className="size-3 animate-spin" />
                                        Screening
                                      </span>
                                    )}

                                    {candidate.status ===
                                      'uploaded' && (
                                      <span className="flex items-center gap-1">
                                        <CheckCircle2 className="size-3" />
                                        Ready
                                      </span>
                                    )}

                                    {candidate.status ===
                                      'failed' && (
                                      <span className="text-red-600">
                                        Failed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeCandidate(
                                    candidate.id,
                                  )
                                }
                                className="ml-3 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {error && (
                <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <div className="text-sm font-semibold">
                    Ready to screen candidates?
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {candidates.length
                      ? `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} selected`
                      : 'Upload candidate resumes to continue'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={screenAllCandidates}
                  disabled={
                    !readiness ||
                    isScreening
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isScreening ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Screening Candidates...
                    </>
                  ) : (
                    <>
                      Screen All Candidates
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* RESULTS */}
          {activeView === 'results' && (
            <>
              <div className="mb-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Candidates Screened
                  </div>

                  <div className="mt-2 text-3xl font-bold">
                    {completedCandidates.length}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Average Match
                  </div>

                  <div className="mt-2 text-3xl font-bold">
                    {completedCandidates.length
                      ? `${Math.round(
                          completedCandidates.reduce(
                            (sum, candidate) =>
                              sum +
                              (candidate.result
                                ?.overallScore ?? 0),
                            0,
                          ) /
                            completedCandidates.length,
                        )}%`
                      : '—'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Top Candidate
                  </div>

                  <div className="mt-2 truncate text-lg font-bold">
                    {completedCandidates[0]?.file.name ??
                      '—'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Role
                  </div>

                  <div className="mt-2 truncate text-lg font-bold">
                    {jobTitle || '—'}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                {/* RANKING */}
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="size-5" />

                      <div>
                        <h2 className="text-sm font-semibold">
                          Candidate Ranking
                        </h2>

                        <p className="text-xs text-slate-500">
                          Ranked by match score.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[620px] overflow-y-auto p-3">
                    {completedCandidates.map(
                      (candidate, index) => {
                        const score =
                          candidate.result
                            ?.overallScore ?? 0;

                        const active =
                          selectedCandidate?.id ===
                          candidate.id;

                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() =>
                              setSelectedCandidateId(
                                candidate.id,
                              )
                            }
                            className={`mb-2 w-full rounded-lg border p-4 text-left transition ${
                              active
                                ? 'border-slate-900 bg-slate-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                                  {index + 1}
                                </div>

                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">
                                    {candidate.file.name}
                                  </div>

                                  <div className="mt-1 text-xs text-slate-500">
                                    {
                                      candidate.result
                                        ?.recommendation
                                    }
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xl font-bold">
                                  {score}%
                                </div>

                                <div className="text-[10px] text-slate-400">
                                  MATCH
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-slate-900"
                                style={{
                                  width: `${score}%`,
                                }}
                              />
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>
                </section>

                {/* ASSESSMENT */}
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Search className="size-5" />

                      <div>
                        <h2 className="text-sm font-semibold">
                          Candidate Assessment
                        </h2>

                        <p className="text-xs text-slate-500">
                          Detailed screening result.
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedCandidate?.result ? (
                    <div className="max-h-[620px] overflow-y-auto p-5">
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-5">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Candidate
                          </div>

                          <div className="mt-1 truncate text-lg font-bold">
                            {selectedCandidate.file.name}
                          </div>

                          <div className="mt-1 text-sm text-slate-500">
                            {jobTitle}
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {selectedCandidate.result.overallScore ??
                                '—'}
                              {selectedCandidate.result
                                .overallScore !==
                                null && '%'}
                            </div>

                            <div className="text-xs text-slate-500">
                              Match Score
                            </div>
                          </div>

                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <Award className="size-4" />

                            <span className="text-sm font-semibold">
                              {
                                selectedCandidate
                                  .result
                                  .recommendation
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <ResultBlock
                          title="Candidate Summary"
                          content={
                            selectedCandidate.result
                              .summary ||
                            'No summary available.'
                          }
                        />

                        <ListBlock
                          title="Key Matched Skills"
                          items={
                            selectedCandidate.result
                              .matchedSkills
                          }
                        />

                        <ListBlock
                          title="Relevant Experience"
                          items={
                            selectedCandidate.result
                              .relevantExperience
                          }
                        />

                        <ListBlock
                          title="Education"
                          items={
                            selectedCandidate.result
                              .education
                          }
                        />

                        <ListBlock
                          title="Strengths"
                          items={
                            selectedCandidate.result
                              .strengths
                          }
                        />

                        <ListBlock
                          title="Skill Gaps"
                          items={
                            selectedCandidate.result
                              .skillGaps
                          }
                        />

                        <ListBlock
                          title="Concerns"
                          items={
                            selectedCandidate.result
                              .concerns
                          }
                        />

                        <div>
                          <div className="mb-2 text-sm font-semibold">
                            Full Agent Assessment
                          </div>

                          <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                            {
                              selectedCandidate.result
                                .raw
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[400px] items-center justify-center text-sm text-slate-500">
                      Select a screened candidate.
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ResultBlock({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">
        {title}
      </div>

      <p className="text-sm leading-6 text-slate-600">
        {content}
      </p>
    </div>
  );
}

function ListBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">
        {title}
      </div>

      {items.length ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex gap-2 text-sm leading-6 text-slate-600"
            >
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400">
          No information detected.
        </div>
      )}
    </div>
  );
}