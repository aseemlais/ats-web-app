import { apiFetch } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Users,
  FileText,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoredCandidate = {
  id: string;
  candidateName: string | null;
  email: string | null;
  skills: string[] | null;
  jobRole: string | null;
  originalFilename: string | null;
  createdAt: string | null;
};

export type StoredCandidateDetail = StoredCandidate & {
  resumeText: string | null;
  storageObjectPath: string | null;
};

export type ListResponse = {
  candidates: StoredCandidate[];
  total: number;
  limit: number;
  offset: number;
};

export type DownloadResponse = {
  signedUrl: string;
};

export type DeleteResponse = {
  message?: string;
  error?: string;
  warning?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// API helpers — always call Node.js proxy, never HF Space directly
// ---------------------------------------------------------------------------

export async function fetchCandidates(
  query: string,
  offset: number,
  limit: number = PAGE_SIZE,
): Promise<ListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const url =
    query.trim()
      ? `/api/candidates/search?q=${encodeURIComponent(query.trim())}&${params}`
      : `/api/candidates?${params}`;

  const res = await apiFetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ListResponse>;
}

export async function fetchCandidateDetail(id: string): Promise<StoredCandidateDetail> {
  const res = await fetch(`/api/candidates/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<StoredCandidateDetail>;
}

export async function fetchDownloadUrl(id: string): Promise<string> {
  const res = await fetch(`/api/candidates/${encodeURIComponent(id)}/download`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as DownloadResponse;
  if (!data.signedUrl) throw new Error('No download URL returned.');
  return data.signedUrl;
}

export async function deleteCandidate(
  id: string,
): Promise<{ status: number; body: DeleteResponse }> {
  const res = await fetch(`/api/candidates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const body = (await res.json().catch(() => ({}))) as DeleteResponse;
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function skillChips(skills: string[] | null) {
  if (!skills?.length) return null;
  const shown = skills.slice(0, 5);
  const remaining = skills.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span
          key={s}
          className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
        >
          {s}
        </span>
      ))}
      {remaining > 0 && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
          +{remaining} more
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

function DeleteModal({
  candidateName,
  onConfirm,
  onCancel,
  loading,
}: {
  candidateName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center gap-2 text-red-600">
          <AlertTriangle className="size-5" />
          <span className="font-semibold">Delete candidate?</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          This will permanently remove{' '}
          <strong>{candidateName ?? 'this candidate'}</strong> and their stored
          resume from the repository. This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

function CandidateDetailDrawer({
  candidate,
  onClose,
  onDelete,
  onScreen,
}: {
  candidate: StoredCandidate;
  onClose: () => void;
  onDelete: (id: string) => void;
  onScreen?: (candidate: StoredCandidate) => void;
}) {
  const [detail, setDetail] = useState<StoredCandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCandidateDetail(candidate.id)
      .then(setDetail)
      .catch((e: unknown) =>
        setError((e instanceof Error ? e.message : String(e)) || 'Failed to load.'),
      )
      .finally(() => setLoading(false));
  }, [candidate.id]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await fetchDownloadUrl(candidate.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: unknown) {
      alert(
        'Download failed: ' +
          (e instanceof Error ? e.message : 'Unknown error'),
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Candidate Details
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Loading&hellip;
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {detail && !loading && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Name
              </p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">
                {detail.candidateName ?? '\u2014'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Email
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {detail.email ?? '\u2014'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Job Role
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {detail.jobRole ?? '\u2014'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Skills
              </p>
              <div className="mt-1">
                {detail.skills?.length
                  ? skillChips(detail.skills)
                  : <span className="text-sm text-slate-400">\u2014</span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Resume file
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {detail.originalFilename ?? '\u2014'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Added
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {formatDate(detail.createdAt)}
              </p>
            </div>

            {detail.resumeText && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                  Extracted resume text
                </p>
                <pre className="max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700">
                  {detail.resumeText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download
            <ExternalLink className="size-3 text-slate-400" />
          </button>

          {onScreen && (
            <button
              type="button"
              onClick={() => onScreen(candidate)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Sparkles className="size-4" />
              Add to Screen
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDelete(candidate.id)}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CandidateRepositoryView
// ---------------------------------------------------------------------------

export function CandidateRepositoryView({
  onSelectForScreening,
  selectionMode = false,
  selectedIds = new Set<string>(),
  onToggleSelect,
  onSelectAll,
  onClearSelection,
}: {
  onSelectForScreening?: (candidates: StoredCandidate[]) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (candidate: StoredCandidate) => void;
  onSelectAll?: (candidates: StoredCandidate[]) => void;
  onClearSelection?: () => void;
} = {}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCandidate, setSelectedCandidate] =
    useState<StoredCandidate | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  // Internal selection state when not controlled externally
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const effectiveSelectedIds = selectionMode && onToggleSelect ? selectedIds : internalSelectedIds;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCandidates(debouncedQuery, offset);
      setData(result);
    } catch (e: unknown) {
      setError(
        (e instanceof Error ? e.message : String(e)) ||
          'Failed to load candidates.',
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, offset]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  async function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    setDeleteMessage(null);

    try {
      const { status, body } = await deleteCandidate(deleteTargetId);

      if (status === 200) {
        setDeleteMessage({
          type: 'success',
          text: body.message ?? 'Candidate deleted successfully.',
        });
        setData((prev) =>
          prev
            ? {
                ...prev,
                candidates: prev.candidates.filter(
                  (c) => c.id !== deleteTargetId,
                ),
                total: Math.max(0, prev.total - 1),
              }
            : prev,
        );
        if (selectedCandidate?.id === deleteTargetId) {
          setSelectedCandidate(null);
        }
      } else if (status === 207) {
        setDeleteMessage({
          type: 'warning',
          text:
            body.warning ??
            body.message ??
            'Resume file deleted but candidate record could not be fully removed. ' +
              'The database row is retained \u2014 you can retry deletion safely.',
        });
      } else if (status === 409) {
        setDeleteMessage({
          type: 'error',
          text:
            body.error ??
            'Storage deletion failed. The candidate record has been retained so you can retry safely.',
        });
      } else if (status === 503) {
        setDeleteMessage({
          type: 'error',
          text:
            body.error ??
            'Candidate deletion is currently disabled on this server.',
        });
      } else {
        setDeleteMessage({
          type: 'error',
          text: body.error ?? `Deletion failed (HTTP ${status}).`,
        });
      }
    } catch (e: unknown) {
      setDeleteMessage({
        type: 'error',
        text:
          (e instanceof Error ? e.message : String(e)) || 'Deletion failed.',
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTargetId(null);
    }
  }

  function handleDeleteRequest(id: string) {
    setDeleteMessage(null);
    setDeleteTargetId(id);
  }

  function toggleCandidateSelection(candidate: StoredCandidate) {
    if (onToggleSelect) {
      onToggleSelect(candidate);
    } else {
      setInternalSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(candidate.id)) {
          next.delete(candidate.id);
        } else {
          next.add(candidate.id);
        }
        return next;
      });
    }
  }

  function handleSelectAllPage() {
    if (!data?.candidates) return;
    if (onSelectAll) {
      onSelectAll(data.candidates);
    } else {
      setInternalSelectedIds(new Set(data.candidates.map((c) => c.id)));
    }
  }

  function handleClearSelection() {
    if (onClearSelection) {
      onClearSelection();
    } else {
      setInternalSelectedIds(new Set());
    }
  }

  const deleteTargetCandidate =
    data?.candidates.find((c) => c.id === deleteTargetId) ??
    (selectedCandidate?.id === deleteTargetId ? selectedCandidate : null);

  const selectedCandidatesList =
    data?.candidates.filter((c) => effectiveSelectedIds.has(c.id)) ?? [];

  return (
    <div className="relative flex h-full flex-col">
      {/* Delete confirmation modal */}
      {deleteTargetId && (
        <DeleteModal
          candidateName={deleteTargetCandidate?.candidateName ?? null}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeleteTargetId(null)}
          loading={deleteLoading}
        />
      )}

      {/* Detail drawer */}
      {selectedCandidate && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setSelectedCandidate(null)}
          />
          <CandidateDetailDrawer
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onDelete={(id) => {
              setSelectedCandidate(null);
              handleDeleteRequest(id);
            }}
            onScreen={
              onSelectForScreening
                ? (c) => {
                    setSelectedCandidate(null);
                    onSelectForScreening([c]);
                  }
                : undefined
            }
          />
        </>
      )}

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Users className="size-4" />
            Candidate Repository
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Stored Candidates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse, search, and manage candidates persisted in Supabase. Select candidates to screen against any job description.
          </p>
        </div>

        {/* Action bar for screening selection */}
        {onSelectForScreening && effectiveSelectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-2.5">
            <span className="text-sm font-semibold text-blue-900">
              {effectiveSelectedIds.size} candidate{effectiveSelectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              type="button"
              onClick={() => onSelectForScreening(selectedCandidatesList)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Sparkles className="size-4" />
              Screen Selected
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Search bar + selection controls + refresh */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, job role or skills&hellip;"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Select all on page button */}
        {onSelectForScreening && (data?.candidates?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={handleSelectAllPage}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <CheckSquare className="size-4 text-slate-500" />
            Select Page ({data?.candidates.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => void loadCandidates()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {data && !loading && (
        <div className="mb-4 text-sm text-slate-500">
          {debouncedQuery
            ? `${data.total} result${data.total !== 1 ? 's' : ''} for "${debouncedQuery}"`
            : `${data.total} candidate${data.total !== 1 ? 's' : ''} stored`}
        </div>
      )}

      {/* Delete status banner */}
      {deleteMessage && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
            deleteMessage.type === 'success'
              ? 'bg-green-50 text-green-800'
              : deleteMessage.type === 'warning'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-800'
          }`}
        >
          {deleteMessage.type === 'warning' ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex-1">{deleteMessage.text}</span>
          <button
            type="button"
            onClick={() => setDeleteMessage(null)}
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-10 text-slate-500">
          <Loader2 className="size-5 animate-spin" />
          Loading candidates&hellip;
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Failed to load candidates</p>
            <p className="mt-0.5 text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadCandidates()}
              className="mt-2 font-medium underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data?.candidates.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center text-slate-500">
          <FileText className="mb-3 size-10 text-slate-300" />
          {debouncedQuery ? (
            <>
              <p className="font-medium">No candidates match your search.</p>
              <p className="mt-1 text-sm">
                Try a different name, email, job role, or skill.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">No candidates stored yet.</p>
              <p className="mt-1 text-sm">
                Upload resumes in the Setup tab to populate the persistent repository.
              </p>
            </>
          )}
        </div>
      )}

      {/* Candidate table */}
      {!loading && !error && (data?.candidates?.length ?? 0) > 0 && (
        <div className="flex-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                {onSelectForScreening && (
                  <th className="w-10 px-4 py-3 text-center">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Job Role</th>
                <th className="px-4 py-3">Skills</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data!.candidates.map((c, i) => {
                const isSelected = effectiveSelectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${
                      isSelected
                        ? 'bg-blue-50/40'
                        : i % 2 === 1
                          ? 'bg-slate-50/30'
                          : ''
                    }`}
                  >
                    {onSelectForScreening && (
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleCandidateSelection(c)}
                          className="rounded p-1 text-slate-400 hover:text-blue-600 focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-blue-600" />
                          ) : (
                            <Square className="size-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedCandidate(c)}
                        className="text-left font-medium text-slate-900 hover:text-blue-600 hover:underline"
                      >
                        {c.candidateName ?? (
                          <span className="italic text-slate-400">Unknown</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.email ?? <span className="text-slate-400">\u2014</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.jobRole ?? <span className="text-slate-400">\u2014</span>}
                    </td>
                    <td className="px-4 py-3">
                      {skillChips(c.skills) ?? (
                        <span className="text-slate-400">\u2014</span>
                      )}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-500">
                      {c.originalFilename ?? (
                        <span className="text-slate-400">\u2014</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="View details"
                          onClick={() => setSelectedCandidate(c)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <FileText className="size-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete candidate"
                          onClick={() => handleDeleteRequest(c.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
