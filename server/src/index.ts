// Load environment variables FIRST before any other imports
import './env';

import express, {
  type Request,
  type Response,
  type NextFunction,
  type Express,
} from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chatRouter } from './routes/chat';
import authRouter from './routes/auth';
import { storeMessageMeta } from './lib/message-meta-store';
import { historyRouter } from './routes/history';
import { sessionRouter } from './routes/session';
import { messagesRouter } from './routes/messages';
import { configRouter } from './routes/config';
import { feedbackRouter } from './routes/feedback';
import { filesRouter } from './routes/files';
import { candidatesRouter } from './routes/candidates';
import { authMiddleware, requireAuth } from './middleware/auth';
import { ChatSDKError } from '@chat-template/core/errors';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();

const isDevelopment =
  process.env.NODE_ENV !== 'production';

// ============================================================
// PORT
// ============================================================

const PORT = isDevelopment
  ? (process.env.CHAT_APP_PORT || process.env.PORT || 3001)
  : 3000;

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: isDevelopment
      ? 'http://localhost:3000'
      : true,
    credentials: true,
  }),
);

// ============================================================
// COOKIE PARSING
// ============================================================

// Required for reading the reviewer session cookie
app.use(cookieParser());
// ============================================================
// BODY PARSING
// ============================================================

app.use(
  express.json({
    limit: '10mb',
  }),
);

app.use(
  express.urlencoded({
    extended: true,
  }),
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/ping', (_req, res) => {
  res.status(200).send('pong');
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/chat', chatRouter);

app.use('/api/auth', authRouter);

app.use('/api/history', historyRouter);

app.use('/api/session', sessionRouter);

app.use('/api/messages', messagesRouter);

app.use('/api/config', configRouter);

app.use('/api/feedback', feedbackRouter);

app.use('/api/files', filesRouter);

app.use('/api/candidates', candidatesRouter);

// ============================================================
// AGENT BACKEND PROXY
// ============================================================
//
// Local development:
//   API_PROXY=http://localhost:8000/invocations
//
// The Resume Screening UI calls:
//   POST /invocations
//
// The Node server forwards that request to the
// MLflow Agent Server.
//
// IMPORTANT:
// Do NOT silently remove the /invocations route when
// API_PROXY is missing. That was the reason for:
//
//   Cannot POST /invocations
//
// ============================================================

const agentBackendUrl =
  process.env.API_PROXY ||
  'http://localhost:8000/invocations';

console.log(
  `[Agent] /invocations target: ${agentBackendUrl}`,
);

app.all(
  '/invocations',
  authMiddleware,
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      console.log(
        `[Agent] ${req.method} /invocations`,
      );

      const forwardHeaders: Record<
        string,
        string | undefined
      > = {
        ...req.headers,
      };

      // The fetch() call below will calculate the
      // correct content length.
      delete forwardHeaders['content-length'];
      delete forwardHeaders['cookie'];

      const requestBody =
        req.method !== 'GET' &&
        req.method !== 'HEAD'
          ? JSON.stringify(req.body)
          : undefined;

      const response = await fetch(
        agentBackendUrl,
        {
          method: req.method,
          headers: forwardHeaders,
          body: requestBody,
        },
      );

      // Copy status code.
      res.status(response.status);

      // Copy response headers.
      response.headers.forEach(
        (value, key) => {
          res.setHeader(key, value);
        },
      );

      // Stream response body.
      if (response.body) {
        const reader =
          response.body.getReader();

        while (true) {
          const {
            done,
            value,
          } = await reader.read();

          if (done) {
            break;
          }

          res.write(value);
        }
      }

      res.end();
    } catch (error) {
      console.error(
        '[/invocations proxy] Error:',
        error,
      );

      res.status(502).json({
        error: 'Proxy error',
        message:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);

// ============================================================
// SERVE REACT FRONTEND
// ============================================================

const clientBuildPath = path.resolve(
  __dirname,
  '../../client/dist',
);

console.log(
  `[Frontend] Client build path: ${clientBuildPath}`,
);

app.use(
  express.static(clientBuildPath),
);

// ============================================================
// SPA FALLBACK
// ============================================================
//
// Do NOT intercept:
//
//   /api/*
//   /invocations
//
// ============================================================

app.get(
  /^\/(?!api|invocations).*/,
  (_req, res) => {
    res.sendFile(
      path.join(
        clientBuildPath,
        'index.html',
      ),
    );
  },
);

// ============================================================
// ERROR HANDLING
// ============================================================

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error(
      'Error:',
      err,
    );

    if (err instanceof ChatSDKError) {
      const response =
        err.toResponse();

      return res
        .status(response.status)
        .json(response.json);
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: isDevelopment
        ? err.message
        : 'An unexpected error occurred',
    });
  },
);

// ============================================================
// TEST / MSW SERVER
// ============================================================

async function startServer() {
  if (
    process.env.PLAYWRIGHT ===
    'True'
  ) {
    console.log(
      '[Test Mode] Starting MSW mock server for API mocking...',
    );

    try {
      const modulePath =
        path.join(
          dirname(
            dirname(__dirname),
          ),
          'tests',
          'api-mocking',
          'api-mock-server.ts',
        );

      console.log(
        '[Test Mode] Attempting to load MSW from:',
        modulePath,
      );

      const {
        mockServer,
      } = await import(
        pathToFileURL(modulePath).href
      );

      mockServer.listen({
        onUnhandledRequest:
          (request: Request) => {
            console.warn(
              `[MSW] Unhandled ${request.method} request to ${request.url}`,
            );
          },
      });

      console.log(
        '[Test Mode] MSW mock server started successfully',
      );

      console.log(
        '[Test Mode] Registered handlers:',
        mockServer.listHandlers()
          .length,
      );

      const handlersPath =
        path.join(
          dirname(
            dirname(__dirname),
          ),
          'tests',
          'api-mocking',
          'api-mock-handlers.ts',
        );

      const {
        getCapturedRequests,
        resetCapturedRequests,
        getLastCapturedRequest,
        resetMlflowAssessmentStore,
        getLastServingRequestHeaders,
      } = await import(
        handlersPath
      );

      // --------------------------------------------------------
      // TEST: captured requests
      // --------------------------------------------------------

      app.get(
        '/api/test/captured-requests',
        (_req, res) => {
          res.json(
            getCapturedRequests(),
          );
        },
      );

      // --------------------------------------------------------
      // TEST: last captured request
      // --------------------------------------------------------

      app.get(
        '/api/test/last-captured-request',
        (_req, res) => {
          const lastRequest =
            getLastCapturedRequest();

          if (lastRequest) {
            res.json(
              lastRequest,
            );
          } else {
            res.status(404).json({
              error:
                'No captured requests',
            });
          }
        },
      );

      // --------------------------------------------------------
      // TEST: reset captured requests
      // --------------------------------------------------------

      app.post(
        '/api/test/reset-captured-requests',
        (_req, res) => {
          resetCapturedRequests();

          res.json({
            success: true,
          });
        },
      );

      // --------------------------------------------------------
      // TEST: reset MLflow store
      // --------------------------------------------------------

      app.post(
        '/api/test/reset-mlflow-store',
        (_req, res) => {
          resetMlflowAssessmentStore();

          res.json({
            success: true,
          });
        },
      );

      // --------------------------------------------------------
      // TEST: serving request headers
      // --------------------------------------------------------

      app.get(
        '/api/test/serving-request-headers',
        (_req, res) => {
          res.json(
            getLastServingRequestHeaders(),
          );
        },
      );

      console.log(
        '[Test Mode] Test endpoints for context injection registered',
      );
    } catch (error) {
      console.error(
        '[Test Mode] Failed to start MSW:',
        error,
      );

      console.error(
        '[Test Mode] Error details:',
        error instanceof Error
          ? error.stack
          : error,
      );
    }

    // ----------------------------------------------------------
    // TEST: store message metadata
    // ----------------------------------------------------------

    app.post(
      '/api/test/store-message-meta',
      (req, res) => {
        const {
          messageId,
          chatId,
          traceId,
        } = req.body as {
          messageId: string;
          chatId: string;
          traceId: string | null;
        };

        storeMessageMeta(
          messageId,
          chatId,
          traceId ?? null,
        );

        res.json({
          success: true,
        });
      },
    );
  }

  // ==========================================================
  // START NODE SERVER
  // ==========================================================

  app.listen(
    PORT,
    () => {
      console.log(
        `Backend server is running on http://localhost:${PORT}`,
      );

      console.log(
        `Environment: ${
          isDevelopment
            ? 'development'
            : 'production'
        }`,
      );
    },
  );
}

// ============================================================
// START
// ============================================================

startServer();

export default app;
