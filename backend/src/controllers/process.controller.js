import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { isSidecarReady, sidecarPost } from '../services/sidecar.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');

const INPUT_DIR = path.join(BACKEND_ROOT, 'input');
const OUTPUT_DIR = path.join(BACKEND_ROOT, 'output');
const LOG_DIR = path.join(BACKEND_ROOT, 'logs');
const CONFIG_PATH = path.join(BACKEND_ROOT, 'config.json');
const PY_SCRIPT = path.join(BACKEND_ROOT, 'python', 'auto_anchor_measure.py');
const JIG_SCRIPT = path.join(BACKEND_ROOT, 'python', 'jig_measure.py');

function isImage(file) { return /\.(png|jpg|jpeg|bmp)$/i.test(file); }

export const processController = {
  /**
   * POST /api/process
   * Inferensi citra menggunakan FastAPI Sidecar (Fast Mode) atau Fallback
   */
  async processImage(req, res) {
    const { fileName, settings } = req.body;
    if (!fileName || !isImage(fileName)) return res.status(400).json({ error: 'fileName tidak valid' });
    const inputPath = path.join(INPUT_DIR, fileName);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'File tidak ditemukan' });

    let cfgPath = CONFIG_PATH;
    if (settings) {
      cfgPath = path.join(BACKEND_ROOT, 'config_runtime.json');
      fs.writeFileSync(cfgPath, JSON.stringify(settings, null, 2), 'utf-8');
    }

    // ── Fast path: gunakan sidecar yang sudah warm ────────────────────────────
    if (isSidecarReady()) {
      try {
        const resp = await sidecarPost('/process', {
          input_path: inputPath,
          output_dir: OUTPUT_DIR,
          config_path: cfgPath,
          log_dir: LOG_DIR
        });

        if (resp.status >= 400) {
          const detail = resp.body?.detail || 'Unknown sidecar error';
          return res.status(resp.status).json({ status: 'error', error: detail });
        }
        return res.json(resp.body);
      } catch (err) {
        console.warn('[Sidecar] Gagal memproses, fallback ke spawn:', err.message);
      }
    }

    // ── Fallback: spawn Python langsung ──────────────────────────────────────
    const condaPy = 'C:\\Users\\LENOVO\\AppData\\Local\\anaconda3\\envs\\ai_vision\\python.exe';
    const py = process.env.PYTHON_BIN || (fs.existsSync(condaPy) ? condaPy : 'python');

    const child = spawn(py, [PY_SCRIPT, '--input', inputPath, '--output-dir', OUTPUT_DIR, '--log-dir', LOG_DIR, '--config', cfgPath], {
      cwd: BACKEND_ROOT, shell: false, windowsHide: true
    });

    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => res.status(500).json({
      status: 'error',
      error: `Gagal menjalankan Python: ${py}. Detail: ${err.message}`,
      hint: 'Pastikan Python sudah terinstall. Set PYTHON_BIN jika perlu.'
    }));

    child.on('close', (code) => {
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const result = JSON.parse(lines[lines.length - 1] || '{}');
        result.exitCode = code;
        result.stderr = stderr;
        return res.json(result);
      } catch (_) {
        return res.status(500).json({ error: 'Python output tidak bisa dibaca', stdout, stderr, exitCode: code });
      }
    });
  },

  /**
   * POST /api/jig-measure
   * Kalibrasi pin gauge master jig
   */
  async jigMeasure(req, res) {
    const { fileName, settings, ref_mm } = req.body;
    // Cari file jig di input jika tidak ditentukan
    let targetFileName = fileName;
    if (!targetFileName) {
      const allImgs = fs.readdirSync(INPUT_DIR).filter(isImage);
      const foundJig = allImgs.find((f) => f.toLowerCase().includes('jig') || f.toLowerCase().includes('calib'));
      targetFileName = foundJig || allImgs[0];
    }

    if (!targetFileName) return res.status(400).json({ error: 'Tidak ada gambar jig di folder input' });
    const inputPath = path.join(INPUT_DIR, targetFileName);

    let cfgPath = CONFIG_PATH;
    if (settings) {
      cfgPath = path.join(BACKEND_ROOT, 'config_runtime.json');
      fs.writeFileSync(cfgPath, JSON.stringify(settings, null, 2), 'utf-8');
    }

    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    const jigRealMm = ref_mm || parseFloat((cfg.jig_calibration || {}).jig_real_mm || 0.898);

    // ── Fast path: sidecar ──────────────────────────────────────────────────
    if (isSidecarReady()) {
      try {
        const resp = await sidecarPost('/jig-measure', {
          input_path: inputPath,
          output_dir: OUTPUT_DIR,
          config_path: cfgPath
        });

        if (resp.status >= 400) {
          const detail = resp.body?.detail || 'Unknown sidecar error';
          return res.status(resp.status).json({ status: 'error', error: detail });
        }

        const result = resp.body;
        if (result.status === 'success') {
          const mainCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
          const scaleBefore = mainCfg.scale_mm_per_pixel;
          mainCfg.scale_mm_per_pixel = result.scale_mm_per_pixel;
          if (!mainCfg.jig_calibration) mainCfg.jig_calibration = {};
          mainCfg.jig_calibration.last_calibrated_at = new Date().toISOString();
          mainCfg.jig_calibration.last_scale_before = scaleBefore;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(mainCfg, null, 2), 'utf-8');
          result.scale_before = scaleBefore;
        }
        return res.json(result);
      } catch (err) {
        console.warn('[Sidecar] Jig error, fallback ke spawn:', err.message);
      }
    }

    // ── Fallback: spawn Python ──────────────────────────────────────────────
    const condaPy = 'C:\\Users\\LENOVO\\AppData\\Local\\anaconda3\\envs\\ai_vision\\python.exe';
    const py = process.env.PYTHON_BIN || (fs.existsSync(condaPy) ? condaPy : 'python');

    const child = spawn(py, [JIG_SCRIPT, '--input', inputPath, '--output-dir', OUTPUT_DIR, '--config', cfgPath], {
      cwd: BACKEND_ROOT, shell: false, windowsHide: true
    });

    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => res.status(500).json({ status: 'error', error: `Gagal menjalankan Python: ${py}. ${err.message}` }));

    child.on('close', (code) => {
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const result = JSON.parse(lines[lines.length - 1] || '{}');
        result.exitCode = code;
        result.stderr = stderr;
        return res.json(result);
      } catch (_) {
        return res.status(500).json({ error: 'Python output tidak bisa dibaca', stdout, stderr, exitCode: code });
      }
    });
  }
};
