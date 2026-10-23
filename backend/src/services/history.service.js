import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');

const OUTPUT_DIR = path.join(BACKEND_ROOT, 'output');
const LOG_DIR = path.join(BACKEND_ROOT, 'logs');
const CONFIG_PATH = path.join(BACKEND_ROOT, 'config.json');

// Pastikan direktori wajib ada
for (const dir of [OUTPUT_DIR, LOG_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const TRANSFER_AUDIT_FILE = path.join(LOG_DIR, 'transfer_audit.json');

function getSystemConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (_) {
    return {};
  }
}

function getStorageSettings() {
  const cfg = getSystemConfig();
  return {
    storage_path: cfg.storage?.storage_path || OUTPUT_DIR,
    save_option: cfg.storage?.save_option || 'all', // all | ng_only | ok_only
    image_format: cfg.storage?.image_format || 'jpg', // jpg | png
    qc_server_path: cfg.storage?.qc_server_path || 'C:\\QC_Server_Backup\\XRay_History'
  };
}

/**
 * Menghitung tanggal siklus produksi Denso:
 * Hari kerja / produksi baru di lini Denso dimulai tepat pukul 07:00:00 (Day Shift).
 * Inspeksi yang terjadi antara pukul 00:00:00 s/d 06:59:59 secara administratif
 * adalah kelanjutan Night Shift dari tanggal produksi hari sebelumnya.
 */
export function getProductionDate(date = new Date()) {
  const d = (date instanceof Date) ? new Date(date.getTime()) : new Date(date);
  if (d.getHours() < 7) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

export function getDailyCsvFilename(date = new Date()) {
  if (typeof date === 'string') {
    const clean = date.replace(/[^0-9]/g, '');
    if (clean.length === 8) {
      return `${clean}_denso_inspection.csv`;
    }
  }
  const d = getProductionDate(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_denso_inspection.csv`;
}

export function getLocalDayString(date = new Date()) {
  const d = (date instanceof Date) ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Format YYYY-MM-DD tanggal lokal aktual
 */
export function formatDateIso(date = new Date()) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = (date instanceof Date) ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format HH:mm:ss waktu lokal aktual
 */
export function formatTimeIso(date = new Date()) {
  const d = (date instanceof Date) ? date : new Date(date);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${min}:${ss}`;
}

const CSV_HEADER = 'Date,Time,Operator Name,NPK,Part Number,Sequence,Station/Pocket,Dimension (mm),Judgment,Method,Image Link\n';

export const historyService = {
  /**
   * Mengambil path file CSV harian
   */
  getCsvPathForDate(dateStr = null) {
    let filename;
    if (dateStr) {
      const clean = dateStr.replace(/[^0-9]/g, '');
      if (clean.length === 8) {
        filename = `${clean}_denso_inspection.csv`;
      } else {
        filename = getDailyCsvFilename(new Date(dateStr));
      }
    } else {
      filename = getDailyCsvFilename(new Date());
    }
    return path.join(LOG_DIR, filename);
  },

  /**
   * Memastikan file CSV harian terinisialisasi dengan header standar Denso
   */
  ensureDailyCsv(filePath) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, CSV_HEADER, 'utf-8');
    }
  },

  /**
   * Menyimpan citra inspeksi ke folder tersegmentasi (All / NG / OK) sesuai Fitur 5
   */
  routeAndSaveInspectionImage({ imageName, resultImage, judgment, dateStr = null }) {
    try {
      const storageCfg = getStorageSettings();
      const todayFolder = dateStr || formatDateIso();
      const baseStorage = storageCfg.storage_path.startsWith('/') || storageCfg.storage_path.includes(':')
        ? storageCfg.storage_path
        : path.join(BACKEND_ROOT, storageCfg.storage_path);

      const archiveBase = path.join(baseStorage, 'archive', todayFolder);
      const allDir = path.join(archiveBase, 'all');
      const okDir = path.join(archiveBase, 'ok');
      const ngDir = path.join(archiveBase, 'ng');

      for (const d of [allDir, okDir, ngDir]) {
        fs.mkdirSync(d, { recursive: true });
      }

      const sourceFile = resultImage
        ? path.join(OUTPUT_DIR, resultImage)
        : (imageName ? path.join(OUTPUT_DIR, `${path.parse(imageName).name}_result.png`) : null);

      if (!sourceFile || !fs.existsSync(sourceFile)) {
        return null;
      }

      const targetFileName = path.basename(sourceFile);
      const judgeUpper = String(judgment).toUpperCase();

      // Policy: Fitur 5
      // 1. All Images
      if (storageCfg.save_option === 'all') {
        fs.copyFileSync(sourceFile, path.join(allDir, targetFileName));
        if (judgeUpper === 'OK') {
          fs.copyFileSync(sourceFile, path.join(okDir, targetFileName));
        } else {
          fs.copyFileSync(sourceFile, path.join(ngDir, targetFileName));
        }
      } else if (storageCfg.save_option === 'ng_only') {
        // 2. NG Only
        if (judgeUpper === 'NG') {
          fs.copyFileSync(sourceFile, path.join(ngDir, targetFileName));
        }
      } else if (storageCfg.save_option === 'ok_only') {
        // 3. OK Only
        if (judgeUpper === 'OK') {
          fs.copyFileSync(sourceFile, path.join(okDir, targetFileName));
        }
      }

      return `/output/${encodeURIComponent(targetFileName)}`;
    } catch (err) {
      console.warn('[HistoryService] Warning saat merutekan citra inspeksi:', err.message);
      return null;
    }
  },

  /**
   * Mencatat satu baris inspeksi ke CSV harian
   */
  logInspectionRecord({
    date = null,
    time = null,
    operatorName = 'Budi Santoso',
    npk = '1092',
    partNumber = 'DN-XRAY-42890-A',
    sequence = 'TRAY-001',
    station = 'st1',
    dimension = 1.090,
    judgment = 'OK',
    method = 'yolo_keypoint',
    imageLink = null,
    imageName = null,
    resultImage = null
  }) {
    const now = new Date();
    const dStr = date || formatDateIso(now);
    const tStr = time || formatTimeIso(now);
    const csvPath = this.getCsvPathForDate(dStr);
    this.ensureDailyCsv(csvPath);

    // Rute citra ke folder All/NG/OK
    this.routeAndSaveInspectionImage({
      imageName: imageName || path.basename(imageLink || ''),
      resultImage,
      judgment,
      dateStr: dStr
    });

    const safeOpName = `"${String(operatorName).replace(/"/g, '""')}"`;
    const safeNpk = `"${String(npk).replace(/"/g, '""')}"`;
    const safePart = `"${String(partNumber).replace(/"/g, '""')}"`;
    const safeSeq = `"${String(sequence).replace(/"/g, '""')}"`;
    const safeStation = `"${String(station).replace(/"/g, '""')}"`;
    const safeDim = Number(Number(dimension).toFixed(3));
    const safeJudge = String(judgment).toUpperCase();
    const safeMethod = `"${String(method).replace(/"/g, '""')}"`;
    const safeImg = `"${String(imageLink || (resultImage ? `/output/${resultImage}` : '')).replace(/"/g, '""')}"`;

    const row = `${dStr},${tStr},${safeOpName},${safeNpk},${safePart},${safeSeq},${safeStation},${safeDim},${safeJudge},${safeMethod},${safeImg}\n`;
    fs.appendFileSync(csvPath, row, 'utf-8');

    return {
      date: dStr,
      time: tStr,
      operatorName,
      npk,
      partNumber,
      sequence,
      station,
      dimension: safeDim,
      judgment: safeJudge,
      method,
      imageLink
    };
  },

  /**
   * Memperbarui baris inspeksi yang sudah ada (misal hasil Re-check atau Manual Override)
   * atau menambahkan baru jika belum ada.
   */
  updateOrLogInspectionRecord({
    date = null,
    time = null,
    operatorName = 'Sugimoto-san (TL)',
    npk = '8021',
    partNumber = 'DN-XRAY-42890-A',
    sequence = 'TRAY-001',
    station = 'st1',
    dimension = 1.090,
    judgment = 'OK',
    method = 'recheck_yolo',
    imageName = null,
    resultImage = null
  }) {
    const now = new Date();
    const dStr = date || formatDateIso(now);
    const tStr = time || formatTimeIso(now);
    const csvPath = this.getCsvPathForDate(dStr);
    this.ensureDailyCsv(csvPath);

    this.routeAndSaveInspectionImage({
      imageName: imageName || (resultImage ? `${path.parse(resultImage).name.replace(/_result$/, '')}.jpg` : null),
      resultImage,
      judgment,
      dateStr: dStr
    });

    const safeOpName = `"${String(operatorName).replace(/"/g, '""')}"`;
    const safeNpk = `"${String(npk).replace(/"/g, '""')}"`;
    const safePart = `"${String(partNumber).replace(/"/g, '""')}"`;
    const safeSeq = `"${String(sequence).replace(/"/g, '""')}"`;
    const safeStation = `"${String(station).replace(/"/g, '""')}"`;
    const safeDim = Number(Number(dimension).toFixed(3));
    const safeJudge = String(judgment).toUpperCase();
    const safeMethod = `"${String(method).replace(/"/g, '""')}"`;
    const imgLink = resultImage ? `/output/${resultImage}` : (imageName ? `/output/${path.parse(imageName).name}_result.png` : '');
    const safeImg = `"${String(imgLink).replace(/"/g, '""')}"`;

    const newRow = `${dStr},${tStr},${safeOpName},${safeNpk},${safePart},${safeSeq},${safeStation},${safeDim},${safeJudge},${safeMethod},${safeImg}`;

    // Cari apakah ada baris yang cocok dengan sequence dan station ini
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    let updated = false;

    // Cari dari belakang ke depan (record paling baru dari sequence terkait)
    for (let i = lines.length - 1; i >= 1; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.includes(safeSeq) && line.includes(safeStation)) {
        lines[i] = newRow;
        updated = true;
        break;
      }
    }

    if (updated) {
      fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
    } else {
      fs.appendFileSync(csvPath, newRow + '\n', 'utf-8');
    }

    return {
      date: dStr,
      time: tStr,
      operatorName,
      npk,
      partNumber,
      sequence,
      station,
      dimension: safeDim,
      judgment: safeJudge,
      method,
      updated
    };
  },

  /**
   * Mencatat batch tray (18 pocket) sekaligus ke CSV harian
   */
  logBatchInspection({
    stations,
    operatorName = 'Budi Santoso',
    npk = '1092',
    partNumber = 'DN-XRAY-42890-A',
    trayId = 'TRAY-001'
  }) {
    const now = new Date();
    const dStr = formatDateIso(now);
    const tStr = formatTimeIso(now);
    const csvPath = this.getCsvPathForDate(dStr);
    this.ensureDailyCsv(csvPath);

    let rowsToAppend = '';
    const loggedItems = [];

    for (const item of stations) {
      const stationName = item.station || `st${item.id}`;
      const dim = Number(Number(item.value ?? 1.090).toFixed(3));
      const judge = (item.judge || 'OK').toUpperCase();
      const method = item.method || 'yolo_keypoint';
      const imgLink = item.resultImage ? `/output/${item.resultImage}` : (item.image ? `/output/${path.parse(item.image).name}_result.png` : '');

      this.routeAndSaveInspectionImage({
        imageName: item.image,
        resultImage: item.resultImage,
        judgment: judge,
        dateStr: dStr
      });

      const safeOpName = `"${String(operatorName).replace(/"/g, '""')}"`;
      const safeNpk = `"${String(npk).replace(/"/g, '""')}"`;
      const safePart = `"${String(partNumber).replace(/"/g, '""')}"`;
      const safeSeq = `"${String(trayId).replace(/"/g, '""')}"`;
      const safeStation = `"${String(stationName).replace(/"/g, '""')}"`;
      const safeMethod = `"${String(method).replace(/"/g, '""')}"`;
      const safeImg = `"${String(imgLink).replace(/"/g, '""')}"`;

      rowsToAppend += `${dStr},${tStr},${safeOpName},${safeNpk},${safePart},${safeSeq},${safeStation},${dim},${judge},${safeMethod},${safeImg}\n`;

      loggedItems.push({
        date: dStr,
        time: tStr,
        operatorName,
        npk,
        partNumber,
        sequence: trayId,
        station: stationName,
        dimension: dim,
        judgment: judge,
        method,
        imageLink: imgLink
      });
    }

    if (rowsToAppend) {
      fs.appendFileSync(csvPath, rowsToAppend, 'utf-8');
    }

    return loggedItems;
  },

  /**
   * Mengambil daftar tanggal yang memiliki log CSV harian
   */
  getAvailableDates() {
    if (!fs.existsSync(LOG_DIR)) return [];

    const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('_denso_inspection.csv'));
    const result = [];

    for (const file of files) {
      const fullPath = path.join(LOG_DIR, file);
      const st = fs.statSync(fullPath);
      const m = file.match(/^(\d{4})(\d{2})(\d{2})_denso_inspection\.csv$/);
      let dateIso = null;
      if (m) {
        dateIso = `${m[1]}-${m[2]}-${m[3]}`;
      }

      // Hitung baris data
      let totalLines = 0;
      let okCount = 0;
      let ngCount = 0;
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.trim().split('\n');
        // line 0 adalah header
        for (let i = 1; i < lines.length; i++) {
          const l = lines[i].trim();
          if (!l) continue;
          totalLines++;
          if (l.includes(',OK,')) okCount++;
          else if (l.includes(',NG,')) ngCount++;
        }
      } catch (_) {}

      result.push({
        fileName: file,
        date: dateIso,
        total: totalLines,
        okQty: okCount,
        ngQty: ngCount,
        sizeBytes: st.size,
        modifiedAt: st.mtimeMs
      });
    }

    return result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  /**
   * Membaca dan mem-parsing file CSV harian dengan filter
   */
  getDailyLogs({ date = null, judgment = 'all', station = 'all', search = '', limit = 100, page = 1 }) {
    const targetDate = date || formatDateIso();
    const csvPath = this.getCsvPathForDate(targetDate);

    // Jika file belum ada, pastikan dibuat
    this.ensureDailyCsv(csvPath);

    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.trim().split('\n');
    if (lines.length <= 1) {
      return {
        date: targetDate,
        fileName: path.basename(csvPath),
        summary: { total: 0, okQty: 0, ngQty: 0, okRatio: '100.0', ngRatio: '0.0' },
        records: [],
        totalRecords: 0,
        page: Number(page),
        limit: Number(limit)
      };
    }

    const records = [];
    let okQty = 0;
    let ngQty = 0;

    // Header index
    // 0: Date, 1: Time, 2: Operator Name, 3: NPK, 4: Part Number, 5: Sequence,
    // 6: Station/Pocket, 7: Dimension (mm), 8: Judgment, 9: Method, 10: Image Link
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parsing baris CSV dengan penanganan tanda kutip
      const cols = [];
      let inQuotes = false;
      let curr = '';
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(curr.trim());
          curr = '';
        } else {
          curr += char;
        }
      }
      cols.push(curr.trim());

      const rec = {
        id: i,
        date: cols[0] || targetDate,
        time: cols[1] || '',
        operatorName: cols[2]?.replace(/^"|"$/g, '') || '',
        npk: cols[3]?.replace(/^"|"$/g, '') || '',
        partNumber: cols[4]?.replace(/^"|"$/g, '') || '',
        sequence: cols[5]?.replace(/^"|"$/g, '') || '',
        station: cols[6]?.replace(/^"|"$/g, '') || '',
        dimension: parseFloat(cols[7]) || 0,
        judgment: (cols[8]?.replace(/^"|"$/g, '') || 'OK').toUpperCase(),
        method: cols[9]?.replace(/^"|"$/g, '') || 'yolo_keypoint',
        imageLink: cols[10]?.replace(/^"|"$/g, '') || ''
      };

      if (rec.judgment === 'OK') okQty++;
      else if (rec.judgment === 'NG') ngQty++;

      // Filter judgment
      if (judgment && judgment !== 'all' && rec.judgment.toLowerCase() !== judgment.toLowerCase()) {
        continue;
      }

      // Filter station
      if (station && station !== 'all' && rec.station.toLowerCase() !== station.toLowerCase()) {
        continue;
      }

      // Filter search
      if (search) {
        const q = search.toLowerCase();
        const matches = rec.operatorName.toLowerCase().includes(q) ||
          rec.npk.toLowerCase().includes(q) ||
          rec.partNumber.toLowerCase().includes(q) ||
          rec.sequence.toLowerCase().includes(q) ||
          rec.station.toLowerCase().includes(q);
        if (!matches) continue;
      }

      records.push(rec);
    }

    const totalAll = lines.length - 1;
    const okRatio = totalAll > 0 ? ((okQty / totalAll) * 100).toFixed(1) : '100.0';
    const ngRatio = totalAll > 0 ? ((ngQty / totalAll) * 100).toFixed(1) : '0.0';

    // Pagination
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, parseInt(limit, 10) || 100);
    const startIdx = (pg - 1) * lim;
    const paginated = records.slice(startIdx, startIdx + lim);

    return {
      date: targetDate,
      fileName: path.basename(csvPath),
      summary: {
        total: totalAll,
        filteredTotal: records.length,
        okQty,
        ngQty,
        okRatio,
        ngRatio
      },
      records: paginated,
      totalRecords: records.length,
      page: pg,
      limit: lim
    };
  },

  /**
   * Service sinkronisasi / transfer file CSV dan gambar ke Server QC/PED (Fitur 7)
   */
  transferToQcServer({ date = null, targetPath = null, includeImages = true }) {
    const storageCfg = getStorageSettings();
    const destinationPath = targetPath || storageCfg.qc_server_path || 'C:\\QC_Server_Backup\\XRay_History';

    // Pastikan folder target di PC Server QC tersedia
    const targetCsvDir = path.join(destinationPath, 'csv');
    const targetImgDir = path.join(destinationPath, 'images');

    fs.mkdirSync(targetCsvDir, { recursive: true });
    if (includeImages) {
      fs.mkdirSync(targetImgDir, { recursive: true });
    }

    const targetDate = date || formatDateIso();
    const csvFileName = getDailyCsvFilename(new Date(targetDate));
    const sourceCsvPath = path.join(LOG_DIR, csvFileName);

    const transferredFiles = [];

    // 1. Transfer file CSV
    if (fs.existsSync(sourceCsvPath)) {
      const destCsv = path.join(targetCsvDir, csvFileName);
      fs.copyFileSync(sourceCsvPath, destCsv);
      transferredFiles.push({ type: 'CSV', name: csvFileName, path: destCsv });
    }

    // 2. Transfer citra inspeksi
    let imageCount = 0;
    if (includeImages) {
      // Ambil citra hasil inspeksi dari folder output atau archive
      const todayArchive = path.join(OUTPUT_DIR, 'archive', targetDate);
      const searchDirs = [todayArchive, OUTPUT_DIR];

      for (const sDir of searchDirs) {
        if (!fs.existsSync(sDir)) continue;
        const scanFiles = fs.readdirSync(sDir, { recursive: true });
        for (const f of scanFiles) {
          if (typeof f === 'string' && /\.(png|jpg|jpeg)$/i.test(f) && (f.includes('_result') || f.includes('archive'))) {
            const fullSrc = path.join(sDir, f);
            if (fs.statSync(fullSrc).isFile()) {
              const destImg = path.join(targetImgDir, path.basename(f));
              fs.copyFileSync(fullSrc, destImg);
              imageCount++;
              transferredFiles.push({ type: 'IMAGE', name: path.basename(f), path: destImg });
            }
          }
        }
        if (imageCount > 0) break;
      }
    }

    const auditEntry = {
      id: `TRF-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      targetDate,
      destinationPath,
      csvTransferred: transferredFiles.filter((t) => t.type === 'CSV').length,
      imagesTransferred: imageCount,
      totalTransferred: transferredFiles.length,
      status: 'SUCCESS',
      message: `Berhasil mentransfer ${transferredFiles.length} file ke server QC/PED (${destinationPath})`
    };

    // Simpan riwayat audit transfer
    let audits = [];
    if (fs.existsSync(TRANSFER_AUDIT_FILE)) {
      try {
        audits = JSON.parse(fs.readFileSync(TRANSFER_AUDIT_FILE, 'utf-8'));
      } catch (_) {}
    }
    audits.unshift(auditEntry);
    fs.writeFileSync(TRANSFER_AUDIT_FILE, JSON.stringify(audits.slice(0, 50), null, 2), 'utf-8');

    return auditEntry;
  },

  /**
   * Mengambil riwayat transfer server QC
   */
  getTransferAuditHistory() {
    if (!fs.existsSync(TRANSFER_AUDIT_FILE)) return [];
    try {
      return JSON.parse(fs.readFileSync(TRANSFER_AUDIT_FILE, 'utf-8'));
    } catch (_) {
      return [];
    }
  },

  /**
   * Memastikan inisialisasi file CSV harian Denso (bersih hanya dengan header)
   */
  seedInitialDailyData() {
    const today = formatDateIso();
    const csvPath = this.getCsvPathForDate(today);
    this.ensureDailyCsv(csvPath);
  }
};
