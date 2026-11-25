import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  ChevronRight,
  ArrowLeft,
  CheckSquare,
  Square,
  Loader2,
  RefreshCw,
  X,
  AlertCircle,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface SharePointItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  last_modified?: string;
  extension?: string;
}

interface SharePointFolderData {
  current_path: string;
  parent_path: string | null;
  count: number;
  items: SharePointItem[];
}

interface SharePointStatus {
  status: string;
  mock_mode: boolean;
  mcp_url: string;
  identity: {
    authenticated: boolean;
    mode?: string;
    account?: string;
    display_name?: string;
  };
}

interface SharePointBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCandidates: (
    candidates: Array<{
      fileName: string;
      resumeText: string;
      candidateId?: string;
      candidateName?: string;
      jobRole?: string;
    }>,
  ) => void;
}

export const SharePointBrowserModal: React.FC<SharePointBrowserModalProps> = ({
  isOpen,
  onClose,
  onImportCandidates,
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [folderData, setFolderData] = useState<SharePointFolderData | null>(null);
  const [status, setStatus] = useState<SharePointStatus | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMessage('');
      fetchStatus();
      loadFolder('');
    }
  }, [isOpen]);

  const fetchStatus = async () => {
    try {
      const resp = await apiFetch('/api/sharepoint/status');
      if (resp.ok) {
        const data = await resp.json();
        setStatus(data);
      }
    } catch (e) {
      console.warn('[SharePointModal] Failed to fetch MCP status', e);
    }
  };

  const loadFolder = async (path: string) => {
    setIsLoading(true);
    setError('');
    try {
      const url = `/api/sharepoint/folders?path=${encodeURIComponent(path)}`;
      const resp = await apiFetch(url);
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Failed to list folder');
      }
      const data: SharePointFolderData = await resp.json();
      setFolderData(data);
      setCurrentPath(data.current_path || '');
    } catch (err: any) {
      setError(err?.message || 'Error loading SharePoint folder.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFile = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const resumeFiles = (folderData?.items || []).filter(
    (item) => item.type === 'file' && ['.pdf', '.docx', '.txt', ''].includes(item.extension?.toLowerCase() || ''),
  );

  const areAllCurrentSelected =
    resumeFiles.length > 0 && resumeFiles.every((f) => selectedPaths.has(f.path));

  const handleSelectAllCurrent = () => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (areAllCurrentSelected) {
        resumeFiles.forEach((f) => next.delete(f.path));
      } else {
        resumeFiles.forEach((f) => next.add(f.path));
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedPaths.size === 0) return;
    setIsImporting(true);
    setError('');
    setImportProgress(`Importing ${selectedPaths.size} resume(s)...`);

    try {
      const pathsArray = Array.from(selectedPaths);
      const resp = await apiFetch('/api/sharepoint/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: pathsArray }),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Import failed');
      }

      const result = await resp.json();
      const successfulItems = (result.items || []).filter((it: any) => it.success);

      if (successfulItems.length === 0) {
        throw new Error('None of the selected resumes could be parsed.');
      }

      const importedCandidates = successfulItems.map((it: any) => ({
        fileName: it.filename || 'SharePoint Resume',
        resumeText: it.resumeText || '',
        candidateId: it.candidateId,
        candidateName: it.candidateName,
        jobRole: it.jobRole,
      }));

      onImportCandidates(importedCandidates);
      setSuccessMessage(
        `Successfully imported ${successfulItems.length} resume(s) from SharePoint!`,
      );
      setSelectedPaths(new Set());

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Error occurred while importing resumes.');
    } finally {
      setIsImporting(false);
      setImportProgress('');
    }
  };

  if (!isOpen) return null;

  // Breadcrumbs calculation
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-[620px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-[#f7fbfd] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#033c67] text-white shadow-sm">
              <Cloud className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#033c67]">
                  Browse SharePoint Resumes
                </h3>
                {status?.mock_mode ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    Mock Mode (Ready for Testing)
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Connected (Resource MCP)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5b7890]">
                Select candidate resume folders or files to import directly into the ATS pipeline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Breadcrumbs Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-600">
            <button
              type="button"
              onClick={() => loadFolder('')}
              className={`hover:text-[#033c67] hover:underline ${!currentPath ? 'font-bold text-[#033c67]' : ''}`}
            >
              SharePoint Root
            </button>
            {pathParts.map((part, index) => {
              const subPath = pathParts.slice(0, index + 1).join('/');
              const isLast = index === pathParts.length - 1;
              return (
                <React.Fragment key={subPath}>
                  <ChevronRight className="size-3 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => loadFolder(subPath)}
                    className={`hover:text-[#033c67] hover:underline ${isLast ? 'font-bold text-[#033c67]' : ''}`}
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {folderData?.parent_path !== null && (
              <button
                type="button"
                onClick={() => loadFolder(folderData?.parent_path || '')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition"
              >
                <ArrowLeft className="size-3" />
                Up
              </button>
            )}
            <button
              type="button"
              onClick={() => loadFolder(currentPath)}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition"
            >
              <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content Explorer List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="size-8 animate-spin text-[#033c67]" />
              <span className="text-xs">Loading SharePoint folder contents...</span>
            </div>
          ) : !folderData || folderData.items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <Folder className="size-10 text-slate-300" />
              <p className="text-xs">This folder is empty.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {resumeFiles.length > 0 && (
                <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 text-xs font-semibold text-slate-500">
                  <button
                    type="button"
                    onClick={handleSelectAllCurrent}
                    className="flex items-center gap-2 hover:text-[#033c67]"
                  >
                    {areAllCurrentSelected ? (
                      <CheckSquare className="size-4 text-[#033c67]" />
                    ) : (
                      <Square className="size-4 text-slate-400" />
                    )}
                    Select All Resumes in this Folder ({resumeFiles.length})
                  </button>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {selectedPaths.size} total selected
                  </span>
                </div>
              )}

              {/* Folders first */}
              {folderData.items
                .filter((item) => item.type === 'folder')
                .map((folder) => (
                  <div
                    key={folder.path}
                    onClick={() => loadFolder(folder.path)}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3 hover:border-[#b9d5e6] hover:bg-[#f7fbfd] transition shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#033c67]">
                        <Folder className="size-5 fill-blue-100" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {folder.name}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-slate-400" />
                  </div>
                ))}

              {/* Files */}
              {folderData.items
                .filter((item) => item.type === 'file')
                .map((file) => {
                  const isSelected = selectedPaths.has(file.path);
                  return (
                    <div
                      key={file.path}
                      onClick={() => handleToggleFile(file.path)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition shadow-xs ${
                        isSelected
                          ? 'border-[#033c67] bg-[#eef6fa]'
                          : 'border-slate-200/80 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFile(file.path);
                          }}
                          className="text-[#033c67]"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4" />
                          ) : (
                            <Square className="size-4 text-slate-300" />
                          )}
                        </button>
                        <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {file.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Document'}
                          </div>
                        </div>
                      </div>

                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase">
                        {file.extension?.replace('.', '') || 'DOC'}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-[#f7fbfd] px-6 py-4">
          <div className="text-xs text-slate-600">
            {selectedPaths.size > 0 ? (
              <span className="font-semibold text-[#033c67]">
                {selectedPaths.size} resume file(s) selected
              </span>
            ) : (
              <span className="text-slate-400">No resumes selected</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedPaths.size === 0 || isImporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#033c67] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#022f50] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              {isImporting && <Loader2 className="size-4 animate-spin" />}
              {isImporting
                ? importProgress || 'Importing...'
                : `Import Selected (${selectedPaths.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
