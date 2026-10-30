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

const filesRouter = Router();

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

      const originalName =
        req.file.originalname;

      const contentType =
        req.file.mimetype;

      const extension =
        path
          .extname(originalName)
          .toLowerCase();

      // ------------------------------------------------------
      // Supported resume formats
      // ------------------------------------------------------

      const supportedExtensions = [
        '.pdf',
        '.docx',
        '.txt',
      ];

      if (
        !supportedExtensions.includes(
          extension,
        )
      ) {
        return res.status(400).json({
          error:
            'Please upload a PDF, DOCX, or TXT resume.',
        });
      }

      // ------------------------------------------------------
      // Read uploaded file
      // ------------------------------------------------------

      const fileBuffer =
        await fs.readFile(filePath);

      let resumeText = '';

      // ------------------------------------------------------
      // PDF
      // ------------------------------------------------------

      if (extension === '.pdf') {
        const parser = new PDFParse({
          data: fileBuffer,
        });

        try {
          const parsed =
            await parser.getText();

          resumeText =
            parsed.text?.trim() || '';
        } finally {
          await parser.destroy();
        }
      }

      // ------------------------------------------------------
      // DOCX
      // ------------------------------------------------------

      else if (extension === '.docx') {
        const result =
          await mammoth.extractRawText({
            buffer: fileBuffer,
          });

        resumeText =
          result.value?.trim() || '';
      }

      // ------------------------------------------------------
      // TXT
      // ------------------------------------------------------

      else if (extension === '.txt') {
        resumeText =
          fileBuffer
            .toString('utf8')
            .trim();
      }

      // ------------------------------------------------------
      // Validate extracted text
      // ------------------------------------------------------

      if (!resumeText) {
        return res.status(400).json({
          error:
            'The resume was uploaded, but no readable text could be extracted from it.',
        });
      }

      // ------------------------------------------------------
      // Logging
      // ------------------------------------------------------

      console.log(
        `[Files] Resume extracted successfully: ${originalName}`,
      );

      console.log(
        `[Files] Extracted characters: ${resumeText.length}`,
      );

      // ------------------------------------------------------
      // Return extracted resume text
      // ------------------------------------------------------

      return res.json({
        success: true,

        url:
          `/api/files/download/${encodeURIComponent(
            path.basename(filePath),
          )}`,

        pathname: originalName,

        contentType,

        resumeText,
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