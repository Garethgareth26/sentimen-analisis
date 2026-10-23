import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import apiRouter from './src/routes/index.js';
import { errorHandler } from './src/middlewares/error.middleware.js';
import { startSidecar } from './src/services/sidecar.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(__dirname, 'input');
const OUTPUT_DIR = path.join(__dirname, 'output');
const MODEL_DIR = path.join(__dirname, 'models');
const LOG_DIR = path.join(__dirname, 'logs');

for (const dir of [INPUT_DIR, OUTPUT_DIR, MODEL_DIR, LOG_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();

// ─── Security Baseline (DNIA DX Starter Kit Vol 1 & Vol 3) ──────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow image viewing in frontend
}));

// CORS Allowlist dengan dukungan Credentials (HttpOnly Cookie)
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback dev
  },
  credentials: true, // Wajib true untuk HttpOnly Cookie (DNIA Standard)
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files Server ─────────────────────────────────────────────────────
app.use('/input', express.static(INPUT_DIR));
app.use('/output', express.static(OUTPUT_DIR));
app.use('/models', express.static(MODEL_DIR));

// ─── API Routes (Layered MVC Architecture) ──────────────────────────────────
app.use('/api', apiRouter);

// ─── Central Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AI X-Ray] Backend API running at http://0.0.0.0:${PORT}`);
  // Jalankan FastAPI Sidecar Engine
  startSidecar();
});

export default app;
