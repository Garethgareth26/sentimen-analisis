import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const WORKSPACE_ROOT = path.join(BACKEND_ROOT, '..');

const DEFAULT_EXCEL_PATH = path.join(WORKSPACE_ROOT, 'X-Ray_Hybrid_Keypoint_Measurement-update.xlsx');
const SYNC_SCRIPT = path.join(BACKEND_ROOT, 'python', 'export_excel_sync.py');

export const excelController = {
  /**
   * POST /api/excel/sync
   * Menyinkronkan 1 atau banyak record uji ke sheet OK / NG di file Excel
   */
  async syncToExcel(req, res) {
    const { records, record, excelPath, clearOld } = req.body;
    const targetRecords = records || (record ? [record] : []);

    if (!targetRecords || targetRecords.length === 0) {
      return res.status(400).json({ ok: false, error: 'Tidak ada data pengujian yang dikirim' });
    }

    const targetExcelPath = excelPath || DEFAULT_EXCEL_PATH;

    // Siapkan file sementara untuk transfer payload JSON ke python
    const tmpPayloadPath = path.join(BACKEND_ROOT, 'logs', `sync_payload_${Date.now()}.json`);
    try {
      fs.writeFileSync(tmpPayloadPath, JSON.stringify(targetRecords, null, 2), 'utf-8');
    } catch (err) {
      return res.status(500).json({ ok: false, error: `Gagal membuat temp payload: ${err.message}` });
    }

    const condaPy = 'C:\\Users\\LENOVO\\AppData\\Local\\anaconda3\\envs\\ai_vision\\python.exe';
    const py = process.env.PYTHON_BIN || (fs.existsSync(condaPy) ? condaPy : 'python');

    const args = [
      SYNC_SCRIPT,
      '--excel-path', targetExcelPath,
      '--json-input', tmpPayloadPath
    ];

    if (clearOld) {
      args.push('--clear-old');
    }

    const child = spawn(py, args, { cwd: BACKEND_ROOT, shell: false, windowsHide: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      try { if (fs.existsSync(tmpPayloadPath)) fs.unlinkSync(tmpPayloadPath); } catch (_) {}
      return res.status(500).json({ ok: false, error: `Gagal menjalankan python excel sync: ${err.message}` });
    });

    child.on('close', (code) => {
      try { if (fs.existsSync(tmpPayloadPath)) fs.unlinkSync(tmpPayloadPath); } catch (_) {}
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const result = JSON.parse(lines[lines.length - 1] || '{}');
        if (code === 0 && result.ok) {
          return res.json(result);
        } else {
          return res.status(500).json({ ok: false, error: result.error || stderr || 'Gagal sinkronisasi excel' });
        }
      } catch (e) {
        return res.status(500).json({ ok: false, error: 'Gagal memproses output python', stdout, stderr });
      }
    });
  },

  /**
   * POST /api/excel/clear
   * Mengosongkan seluruh baris data lama dari sheet OK, NG, dan New-OK&NG
   * sehingga file Excel bersih fresh dimulai dari No 1.
   */
  async clearExcelData(req, res) {
    const targetExcelPath = req.body?.excelPath || DEFAULT_EXCEL_PATH;
    if (!fs.existsSync(targetExcelPath)) {
      return res.status(404).json({ ok: false, error: 'File Excel target tidak ditemukan' });
    }

    const condaPy = 'C:\\Users\\LENOVO\\AppData\\Local\\anaconda3\\envs\\ai_vision\\python.exe';
    const py = process.env.PYTHON_BIN || (fs.existsSync(condaPy) ? condaPy : 'python');

    const args = [
      SYNC_SCRIPT,
      '--excel-path', targetExcelPath,
      '--clear-only'
    ];

    const child = spawn(py, args, { cwd: BACKEND_ROOT, shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      return res.status(500).json({ ok: false, error: `Gagal menjalankan script pengosongan: ${err.message}` });
    });

    child.on('close', (code) => {
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const result = JSON.parse(lines[lines.length - 1] || '{}');
        if (code === 0 && result.ok) {
          return res.json(result);
        } else {
          return res.status(500).json({ ok: false, error: result.error || stderr || 'Gagal mengosongkan data excel' });
        }
      } catch (e) {
        return res.status(500).json({ ok: false, error: 'Gagal parse output python', stdout, stderr });
      }
    });
  },

  /**
   * GET /api/excel/download
   * Mengunduh file Excel lengkap X-Ray_Hybrid_Keypoint_Measurement-update.xlsx
   */
  downloadExcel(req, res) {
    const targetExcelPath = req.query.path || DEFAULT_EXCEL_PATH;
    if (!fs.existsSync(targetExcelPath)) {
      return res.status(404).json({ ok: false, error: 'File Excel belum ada atau belum disinkronkan' });
    }

    const filename = path.basename(targetExcelPath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.sendFile(path.resolve(targetExcelPath));
  }
};
