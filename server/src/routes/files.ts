import {
  Router,
  type Request,
  type Response,
} from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { authMiddleware } from '../middleware/auth';

const filesRouter = Router();

// Apply auth middleware to capture caller identity for diagnostics
filesRouter.use(authMiddleware);

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),

    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );

      cb(
        null,
        `${Date.now()}-${safeName}`,
      );
    },
  }),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

filesRouter.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    let filePath: string | undefined;

    try {
      // ------------------------------------------------------
      // Validate upload
      // ------------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          error: 'No resume was uploaded.',
        });
      }

      filePath = req.file.path;

      const originalName = req.file.originalname;
      const contentType = req.file.mimetype;
      const extension = path.extname(originalName).toLowerCase();
      const fileType = (req.body?.fileType as string) || 'resume';
      const userEmail = req.session?.user?.email || 'anonymous';

      console.log(
        `[Files] Upload received: ${originalName} (type: ${fileType}, user: ${userEmail}, size: ${req.file.size}B)`,
      );

      // ------------------------------------------------------
      // Supported resume formats
      // ------------------------------------------------------

      const supportedExtensions = [
        '.pdf',
        '.docx',
        '.txt',
      ];

      if (!supportedExtensions.includes(extension)) {
        return res.status(400).json({
          error: 'Please upload a PDF, DOCX, or TXT resume.',
        });
      }

      // ------------------------------------------------------
      // Read uploaded file
      // ------------------------------------------------------

      const fileBuffer = await fs.readFile(filePath);

      let resumeText = '';
      let pythonResult: {
        candidateId?: string | null;
        isDuplicate?: boolean;
        storageObjectPath?: string | null;
        persistenceStatus?: string;
        candidateName?: string;
        jobRole?: string;
      } | null = null;

      // ------------------------------------------------------
      // Try Python ATS Backend (Supabase Storage + Database)
      // Only for candidate resumes, not for job descriptions
      // ------------------------------------------------------

      if (fileType !== 'job_description') {
        const pythonAtsUrl =
          process.env.PYTHON_ATS_URL ||
          (process.env.API_PROXY ? process.env.API_PROXY.replace(/\/invocations\/?$/, '') : '') ||
          'http://localhost:8000';

        const targetUrl = `${pythonAtsUrl.replace(/\/$/, '')}/api/files/upload`;
        console.log(`[Files] Forwarding resume to Python ATS for persistence: ${targetUrl}`);

        try {
          const formData = new FormData();
          const blob = new Blob([fileBuffer], {
            type: contentType || 'application/octet-stream',
          });
          formData.append('file', blob, originalName);

          const atsResp = await fetch(targetUrl, {
            method: 'POST',
            body: formData,
          });

          if (atsResp.ok) {
            const atsData = (await atsResp.json()) as {
              resumeText?: string;
              candidateId?: string | null;
              isDuplicate?: boolean;
              storageObjectPath?: string | null;
              persistenceStatus?: string;
              candidateName?: string;
              jobRole?: string;
            };

            if (atsData?.resumeText) {
              resumeText = atsData.resumeText.trim();
              pythonResult = atsData;
              console.log(
                `[Files] Resume persisted to Supabase via Python ATS: ${originalName} ` +
                `(candidateId: ${atsData.candidateId}, persistence: ${atsData.persistenceStatus || 'persisted'})`,
              );
            }
          } else {
            const errData = await atsResp.json().catch(() => ({}));
            console.warn(
              `[Files] Python ATS upload returned status ${atsResp.status}:`,
              errData,
            );
          }
        } catch (err) {
          console.warn(
            '[Files] Could not connect to Python ATS backend, falling back to local parser:',
            err instanceof Error ? err.message : err,
          );
        }
      }

      // ------------------------------------------------------
      // Fallback local parsers (for JDs or if Python ATS offline)
      // ------------------------------------------------------

      if (!resumeText) {
        if (extension === '.pdf') {
          const parser = new PDFParse({
            data: fileBuffer,
          });

          try {
            const parsed = await parser.getText();
            resumeText = parsed.text?.trim() || '';
          } finally {
            await parser.destroy();
          }
        } else if (extension === '.docx') {
          const result = await mammoth.extractRawText({
            buffer: fileBuffer,
          });

          resumeText = result.value?.trim() || '';
        } else if (extension === '.txt') {
          resumeText = fileBuffer.toString('utf8').trim();
        }
      }

      // ------------------------------------------------------
      // Validate extracted text
      // ------------------------------------------------------

      if (!resumeText) {
        return res.status(400).json({
          error:
            'The file was uploaded, but no readable text could be extracted from it.',
        });
      }

      // ------------------------------------------------------
      // Logging
      // ------------------------------------------------------

      console.log(
        `[Files] File processed successfully: ${originalName} (${resumeText.length} chars, persisted: ${Boolean(pythonResult?.candidateId)})`,
      );

      // ------------------------------------------------------
      // Return extracted text and persistence metadata
      // ------------------------------------------------------

      return res.json({
        success: true,

        url: `/api/files/download/${encodeURIComponent(
          path.basename(filePath),
        )}`,

        pathname: originalName,

        contentType,

        resumeText,

        candidateId: pythonResult?.candidateId || null,
        isDuplicate: Boolean(pythonResult?.isDuplicate),
        storageObjectPath: pythonResult?.storageObjectPath || null,
        persistenceStatus:
          pythonResult?.persistenceStatus ||
          (pythonResult ? 'persisted' : 'temporary_in_memory'),
        candidateName: pythonResult?.candidateName,
        jobRole: pythonResult?.jobRole,
      });
    } catch (error) {
      console.error(
        '[Files] Resume processing error:',
        error,
      );

      return res.status(500).json({
        error:
          'Failed to process the resume. Please make sure the file is a readable PDF, DOCX, or TXT file.',
      });
    } finally {
      // ------------------------------------------------------
      // Remove temporary uploaded file
      // ------------------------------------------------------

      if (filePath) {
        await fs
          .unlink(filePath)
          .catch(() => undefined);
      }
    }
  },
);

export { filesRouter };
