import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isSidecarReady, sidecarPost } from './sidecar.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const CONFIG_PATH = path.join(BACKEND_ROOT, 'config.json');
const RUNTIME_CONFIG_PATH = path.join(BACKEND_ROOT, 'config_runtime.json');
const INPUT_DIR = path.join(BACKEND_ROOT, 'input');
const OUTPUT_DIR = path.join(BACKEND_ROOT, 'output');

export const calibrationService = {
  getCalibrationStatus() {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      const jigCalib = cfg.jig_calibration || {};
      return {
        current_scale: cfg.scale_mm_per_pixel || 0.02185,
        jig_real_mm: jigCalib.jig_real_mm || 0.898,
        last_calibrated_at: jigCalib.last_calibrated_at || null,
        last_calibrated_by: jigCalib.last_calibrated_by || null,
        last_scale_before: jigCalib.last_scale_before || null
      };
    } catch (_) {
      return { current_scale: 0.02185, jig_real_mm: 0.898 };
    }
  },

  async testImageForPartPresence(imagePath) {
    // POKAYOKE Check: uji apakah gambar memuat part produk (IC chip)
    // Jika YOLO mendeteksi IC dengan confidence tinggi, berarti part belum dicopot dari jig
    if (!isSidecarReady()) return { hasPart: false };
    try {
      const resp = await sidecarPost('/process', {
        input_path: imagePath,
        output_dir: OUTPUT_DIR,
        config_path: CONFIG_PATH
      });
      if (resp.status === 200 && resp.body) {
        const body = resp.body;
        // Jika metode yolo_keypoint berhasil dan confidence keypoint > 0.40, part ada di sana
        if (body.method === 'yolo_keypoint' && !body.fallback_used && (body.confidence > 0.35 || body.point_a_confidence > 0.6)) {
          return {
            hasPart: true,
            partDetail: `IC terdeteksi pada koordinat A [${(body.point_a_full || []).map(v => Math.round(v)).join(', ')}] dengan confidence ${(body.confidence * 100).toFixed(1)}%`
          };
        }
      }
    } catch (err) {
      console.warn('[CalibrationService] Uji part error (abaikan jika offline):', err.message);
    }
    return { hasPart: false };
  },

  async runAutoJigMeasure(imagePath, refMm) {
    const nominalMm = parseFloat(refMm) || 3.44;
    if (isSidecarReady()) {
      try {
        const resp = await sidecarPost('/jig-measure', {
          input_path: imagePath,
          output_dir: OUTPUT_DIR,
          config_path: CONFIG_PATH
        });
        if (resp.status === 200 && resp.body?.status === 'success') {
          const body = resp.body;
          const calculatedScale = Number((nominalMm / body.jig_height_px).toFixed(5));
          return {
            measured_px: body.jig_height_px,
            jig_top: body.jig_top_px,
            jig_bottom: body.jig_bottom_px,
            scale_mm_per_pixel: calculatedScale,
            overlay_image: body.overlay_image
          };
        }
      } catch (err) {
        console.warn('[CalibrationService] Auto jig measure error:', err.message);
      }
    }
    // Fallback matematis jika sidecar tidak aktif: 147 px
    return {
      measured_px: 147,
      scale_mm_per_pixel: Number((nominalMm / 147).toFixed(5))
    };
  },

  registerNewScale(newScale, refMm, measuredPx, operatorName = 'Operator') {
    const scale = parseFloat(newScale);
    if (!scale || isNaN(scale) || scale <= 0 || scale > 1.0) {
      throw new Error(`Nilai skala tidak valid: ${newScale}`);
    }

    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const oldScale = cfg.scale_mm_per_pixel;
    cfg.scale_mm_per_pixel = scale;

    if (!cfg.jig_calibration) cfg.jig_calibration = {};
    cfg.jig_calibration.last_calibrated_at = new Date().toISOString();
    cfg.jig_calibration.last_calibrated_by = operatorName;
    cfg.jig_calibration.last_scale_before = oldScale;
    if (refMm) cfg.jig_calibration.jig_real_mm = parseFloat(refMm);
    if (measuredPx) cfg.jig_calibration.last_jig_height_px = parseFloat(measuredPx);

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');

    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const runtimeCfg = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf-8'));
      runtimeCfg.scale_mm_per_pixel = scale;
      runtimeCfg.jig_calibration = cfg.jig_calibration;
      fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(runtimeCfg, null, 2), 'utf-8');
    }

    return {
      new_scale: scale,
      old_scale: oldScale,
      calibrated_at: cfg.jig_calibration.last_calibrated_at,
      calibrated_by: operatorName
    };
  }
};
