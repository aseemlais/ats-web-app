import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';

export const sharepointRouter = Router();

// Apply auth middleware to capture user session if logged in
sharepointRouter.use(authMiddleware);

function getPythonBase(): string {
  if (process.env.PYTHON_ATS_URL) {
    return process.env.PYTHON_ATS_URL.replace(/\/$/, '');
  }
  if (process.env.API_PROXY) {
    return process.env.API_PROXY.replace(/\/invocations$/, '').replace(/\/$/, '');
  }
  return 'http://localhost:7860';
}

async function proxyToPython(
  path: string,
  options?: RequestInit,
): Promise<{ ok: boolean; status: number; data: any }> {
  const base = getPythonBase();
  const url = `${base}${path}`;

  const resp = await fetch(url, options);
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

// ---------------------------------------------------------------------------
// GET /api/sharepoint/status
// ---------------------------------------------------------------------------
sharepointRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const result = await proxyToPython('/api/sharepoint/status');
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[SharePoint Proxy] Error fetching status:', err);
    return res.status(502).json({
      error: 'Unable to reach ATS Python service for SharePoint status.',
      detail: err?.message || String(err),
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/sharepoint/folders?path=...
// ---------------------------------------------------------------------------
sharepointRouter.get('/folders', async (req: Request, res: Response) => {
  try {
    const folderPath = encodeURIComponent(String(req.query.path || ''));
    const result = await proxyToPython(`/api/sharepoint/folders?path=${folderPath}`);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[SharePoint Proxy] Error listing folders:', err);
    return res.status(502).json({
      error: 'Unable to list SharePoint folders from ATS Python service.',
      detail: err?.message || String(err),
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sharepoint/import
// ---------------------------------------------------------------------------
sharepointRouter.post('/import', async (req: Request, res: Response) => {
  try {
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'Please provide a non-empty array of file paths to import.' });
    }

    const result = await proxyToPython('/api/sharepoint/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });

    return res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[SharePoint Proxy] Error importing resumes:', err);
    return res.status(502).json({
      error: 'Unable to import resumes via ATS Python service.',
      detail: err?.message || String(err),
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sharepoint/fetch-resumes
// ---------------------------------------------------------------------------
sharepointRouter.post('/fetch-resumes', async (req: Request, res: Response) => {
  try {
    const { sharePointLink } = req.body || {};
    if (!sharePointLink || typeof sharePointLink !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid SharePoint link string.' });
    }

    const result = await proxyToPython('/api/sharepoint/fetch-resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharePointLink }),
    });

    return res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[SharePoint Proxy] Error fetching resumes from link:', err);
    return res.status(502).json({
      error: 'Unable to fetch resumes from SharePoint link.',
      detail: err?.message || String(err),
    });
  }
});
