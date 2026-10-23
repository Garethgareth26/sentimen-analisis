import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { calibrationService } from '../services/calibration.service.js';
import { calibrationRegisterSchema } from '../validators/dandori.validator.js';
import { getShiftInfo } from '../services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const INPUT_DIR = path.join(BACKEND_ROOT, 'input');

export const calibrationController = {
  getStatus(_req, res) {
    const shift = getShiftInfo();
    const status = calibrationService.getCalibrationStatus();
    res.json({
      ok: true,
      shiftInfo: shift,
      calibration: status
    });
  },

  async measureJig(req, res) {
    const { fileName, ref_mm, allowPartBypass } = req.body;
    const shift = getShiftInfo();

    // 1. Shift Policy Warning
    const shiftWarning = !shift.isDayShift
      ? 'Perhatian: Berdasarkan SOP Denso, kalibrasi master jig dijadwalkan pada Day Shift.'
      : null;

    // 2. Tentukan file gambar
    let targetFileName = fileName;
    if (!targetFileName) {
      const files = fs.readdirSync(INPUT_DIR).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
      const foundJig = files.find((f) => f.toLowerCase().includes('jig') || f.toLowerCase().includes('calib'));
      targetFileName = foundJig || files[0];
    }

    if (!targetFileName) {
      return res.status(400).json({ ok: false, error: 'Tidak ada citra kalibrasi di folder input' });
    }

    const imagePath = path.join(INPUT_DIR, targetFileName);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ ok: false, error: `File tidak ditemukan: ${targetFileName}` });
    }

    // 3. POKAYOKE Check: Apakah ada part produk terpasang?
    if (!allowPartBypass) {
      const partCheck = await calibrationService.testImageForPartPresence(imagePath);
      if (partCheck.hasPart) {
        return res.status(422).json({
          ok: false,
          code: 'PART_ATTACHED_ERROR',
          error: 'POKAYOKE INTERLOCK: Part produk terdeteksi terpasang pada jig! Kalibrasi dibatalkan. Harap kosongkan jig kalibrasi sebelum register.',
          detail: partCheck.partDetail,
          fileName: targetFileName
        });
      }
    }

    // 4. Kalkulasi Skala Otomatis (Menggunakan algoritma deteksi tepi persis sistem lama)
    const refMm = parseFloat(ref_mm) || (targetFileName.includes('3.44') ? 3.44 : 3.44);
    const autoResult = await calibrationService.runAutoJigMeasure(imagePath, refMm);

    return res.json({
      ok: true,
      status: 'success',
      input_file: targetFileName,
      ref_mm: refMm,
      measured_px: autoResult.measured_px,
      scale_mm_per_pixel: autoResult.scale_mm_per_pixel,
      overlay_image: autoResult.overlay_image,
      jig_top: autoResult.jig_top,
      jig_bottom: autoResult.jig_bottom,
      shift_warning: shiftWarning,
      is_day_shift: shift.isDayShift
    });
  },

  registerScale(req, res) {
    const parseRes = calibrationRegisterSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Data registrasi skala tidak valid'
      });
    }

    const { scale_mm_per_pixel, ref_mm, measured_px } = parseRes.data;
    const operatorName = req.user?.name || req.body.calibrated_by || 'Operator';

    try {
      const result = calibrationService.registerNewScale(scale_mm_per_pixel, ref_mm, measured_px, operatorName);
      return res.json({
        ok: true,
        message: `Skala kalibrasi baru berhasil diregistrasi: ${result.new_scale} mm/px`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
};
