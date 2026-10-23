import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const SIDECAR_SCRIPT = path.join(BACKEND_ROOT, 'python', 'inference_server.py');

const SIDECAR_PORT = 5001;
const SIDECAR_HOST = '127.0.0.1';

let sidecarReady = false;
let sidecarProc = null;
let heartbeatInterval = null;

export function isSidecarReady() {
  return sidecarReady;
}

export function checkSidecarHealth(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`http://${SIDECAR_HOST}:${SIDECAR_PORT}/health`, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 && json.ok) {
            sidecarReady = true;
            return resolve(true);
          }
        } catch (_) {}
        resolve(false);
      });
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function sidecarPost(endpoint, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: SIDECAR_HOST,
      port: SIDECAR_PORT,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30_000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Sidecar timeout on ${endpoint} (>30s)`));
    });
    req.write(payload);
    req.end();
  });
}

function startHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    const ok = await checkSidecarHealth(1000);
    sidecarReady = ok;
    if (!ok && !sidecarProc) {
      startSidecar();
    }
  }, 3000);
}

export async function startSidecar() {
  if (sidecarProc) return;

  // 1. Cek apakah sidecar sudah aktif sebelumnya (misal nodemon restart atau python jalan terpisah)
  const isAlreadyUp = await checkSidecarHealth(1200);
  if (isAlreadyUp) {
    sidecarReady = true;
    console.log(`[Sidecar] Inference Engine sudah aktif dan siap di port ${SIDECAR_PORT}`);
    startHeartbeat();
    return;
  }

  const condaPy = 'C:\\Users\\LENOVO\\AppData\\Local\\anaconda3\\envs\\ai_vision\\python.exe';
  const py = process.env.PYTHON_BIN || (fs.existsSync(condaPy) ? condaPy : 'python');

  console.log(`[Sidecar] Menjalankan: ${py} inference_server.py`);
  const defaultModel = path.join(BACKEND_ROOT, 'models', 'best.pt');
  const args = [
    SIDECAR_SCRIPT,
    '--port', String(SIDECAR_PORT),
    '--host', SIDECAR_HOST,
    '--preload-model', defaultModel
  ];

  sidecarProc = spawn(py, args, { cwd: path.join(BACKEND_ROOT, 'python'), shell: false, windowsHide: true });
  sidecarProc.stdout.on('data', (d) => process.stdout.write(`[Sidecar] ${d}`));
  sidecarProc.stderr.on('data', (d) => process.stderr.write(`[Sidecar] ${d}`));

  sidecarProc.on('close', async (code) => {
    sidecarProc = null;
    const isUp = await checkSidecarHealth(1000);
    if (isUp) {
      console.log(`[Sidecar] Child process keluar (code ${code}), namun port ${SIDECAR_PORT} tetap aktif merespons.`);
      sidecarReady = true;
      return;
    }
    sidecarReady = false;
    console.log(`[Sidecar] Berhenti (exit code ${code})`);
    if (code !== 0 && code !== null) {
      console.log('[Sidecar] Restart otomatis dalam 5 detik...');
      setTimeout(startSidecar, 5_000);
    }
  });

  startHeartbeat();
}

export function killSidecar() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (sidecarProc) {
    console.log('[Sidecar] Menutup proses sidecar...');
    sidecarProc.kill();
    sidecarProc = null;
  }
}

process.on('exit', killSidecar);
process.on('SIGINT', () => { killSidecar(); process.exit(0); });
process.on('SIGTERM', () => { killSidecar(); process.exit(0); });
