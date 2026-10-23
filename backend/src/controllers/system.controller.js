import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isSidecarReady, sidecarPost } from '../services/sidecar.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');

const INPUT_DIR = path.join(BACKEND_ROOT, 'input');
const OUTPUT_DIR = path.join(BACKEND_ROOT, 'output');
const LOG_DIR = path.join(BACKEND_ROOT, 'logs');
const MODEL_DIR = path.join(BACKEND_ROOT, 'models');
const CONFIG_PATH = path.join(BACKEND_ROOT, 'config.json');

for (const dir of [INPUT_DIR, OUTPUT_DIR, LOG_DIR, MODEL_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function isModel(file) { return /\.(pt|onnx)$/i.test(file); }
function isImage(file) { return /\.(png|jpg|jpeg|bmp)$/i.test(file); }

export const systemController = {
  health(_req, res) {
    res.json({ ok: true, sidecar: isSidecarReady() });
  },

  sidecarStatus(_req, res) {
    res.json({ ready: isSidecarReady() });
  },

  getImages(_req, res) {
    const files = fs.readdirSync(INPUT_DIR)
      .filter(isImage)
      .map((name) => {
        const st = fs.statSync(path.join(INPUT_DIR, name));
        return { name, size: st.size, modifiedAt: st.mtimeMs, url: `/input/${encodeURIComponent(name)}` };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
    res.json({ files });
  },

  uploadImages(req, res) {
    const files = (req.files || []).map((f) => ({
      name: f.filename,
      url: `/input/${encodeURIComponent(f.filename)}`
    }));
    res.json({ files });
  },

  getModels(_req, res) {
    const files = fs.readdirSync(MODEL_DIR)
      .filter(isModel)
      .map((name) => {
        const st = fs.statSync(path.join(MODEL_DIR, name));
        return { name, size: st.size, modifiedAt: st.mtimeMs, path: path.join(MODEL_DIR, name), url: `/models/${encodeURIComponent(name)}` };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
    res.json({ files });
  },

  async uploadModel(req, res) {
    if (!req.file) return res.status(400).json({ error: 'Model file belum dipilih' });
    const modelPath = path.join(MODEL_DIR, req.file.filename);
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    cfg.measurement_method = 'yolo_keypoint';
    cfg.ai_model = cfg.ai_model || {};
    cfg.ai_model.enabled = true;
    cfg.ai_model.model_path = modelPath;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');

    if (isSidecarReady()) {
      try {
        await sidecarPost('/reload-model', { model_path: modelPath });
        console.log('[Sidecar] Model di-reload:', modelPath);
      } catch (err) {
        console.warn('[Sidecar] Gagal reload model:', err.message);
      }
    }

    res.json({
      ok: true,
      model: { name: req.file.filename, path: modelPath, url: `/models/${encodeURIComponent(req.file.filename)}` },
      settings: cfg
    });
  },

  getSettings(_req, res) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    res.json(cfg);
  },

  updateSettings(req, res) {
    const current = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const merged = { ...current, ...req.body };
    if (req.body.storage) {
      merged.storage = { ...(current.storage || {}), ...req.body.storage };
    }
    if (req.body.plc) {
      merged.plc = { ...(current.plc || {}), ...req.body.plc };
    }
    if (req.body.standard) {
      merged.standard = { ...(current.standard || {}), ...req.body.standard };
      if (merged.active_part) {
        merged.active_part.min_distance_mm = Number(merged.standard.min_distance_mm);
        merged.active_part.max_distance_mm = Number(merged.standard.max_distance_mm);
      }
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');

    const runtimePath = path.join(BACKEND_ROOT, 'config_runtime.json');
    if (fs.existsSync(runtimePath)) {
      try {
        fs.writeFileSync(runtimePath, JSON.stringify(merged, null, 2), 'utf-8');
      } catch (_) {}
    }

    res.json({ ok: true, settings: merged, activePart: merged.active_part });
  },

  getLogs(_req, res) {
    const p = path.join(LOG_DIR, 'measurement_log.csv');
    if (!fs.existsSync(p)) return res.type('text/plain').send('');
    res.type('text/csv').send(fs.readFileSync(p, 'utf-8'));
  }
};
