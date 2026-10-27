import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isSidecarReady, sidecarPost, checkSidecarHealth } from './sidecar.service.js';
import { dandoriService } from './dandori.service.js';
import { historyService, getLocalDayString } from './history.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const INPUT_DIR = path.join(BACKEND_ROOT, 'input');
const OUTPUT_DIR = path.join(BACKEND_ROOT, 'output');
const LOG_DIR = path.join(BACKEND_ROOT, 'logs');
const CONFIG_PATH = path.join(BACKEND_ROOT, 'config.json');

// Offset batch untuk rotasi tray berikutnya dari 128+ dataset input nyata
let currentBatchOffset = 0;

/**
/**
 * Mengambil seluruh daftar file citra valid di folder input (mengecualikan jig kalibrasi 3.44.jpg)
 */
export function getAllDatasetImages() {
  if (!fs.existsSync(INPUT_DIR)) return [];
  return fs.readdirSync(INPUT_DIR)
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f) && f !== '3.44.jpg' && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * Membaca mode tray saat ini dari config.json ('live' | 'demo')
 */
export function getTrayMode() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return cfg.tray_mode || 'live';
    }
  } catch (_) {}
  return 'live';
}

/**
 * Menyimpan pilihan mode tray ('live' | 'demo') ke config.json
 */
export function setTrayMode(mode) {
  const cleanMode = mode === 'demo' ? 'demo' : 'live';
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      cfg.tray_mode = cleanMode;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log(`[TrayService] Mode tray diubah ke: ${cleanMode.toUpperCase()}`);
    }
  } catch (err) {
    console.warn('[TrayService] Gagal simpan tray_mode:', err.message);
  }
  return cleanMode;
}

let lastInspectedSignature = null;
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    lastInspectedSignature = cfg.last_inspected_signature || null;
  }
} catch (_) {}

/**
 * Mengambil daftar file citra live terbaru beserta metadatanya (waktu pembuatan/modifikasi dan ukuran)
 */
export function getLatestLiveImagesWithMeta(batchSize = 16) {
  if (!fs.existsSync(INPUT_DIR)) return [];
  const files = fs.readdirSync(INPUT_DIR)
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f) && f !== '3.44.jpg' && !f.startsWith('.'))
    .map((name) => {
      const fullPath = path.join(INPUT_DIR, name);
      try {
        const st = fs.statSync(fullPath);
        // Di Windows, saat file di-copy/paste, birthtimeMs/ctimeMs adalah jam kedatangan file
        const fileTime = Math.max(st.mtimeMs || 0, st.birthtimeMs || 0, st.ctimeMs || 0);
        return { name, fileTime, size: st.size || 0 };
      } catch (_) {
        return { name, fileTime: 0, size: 0 };
      }
    })
    .sort((a, b) => b.fileTime - a.fileTime); // Urutkan paling baru di atas

  if (files.length === 0) return [];
  return files.slice(0, batchSize);
}

/**
 * Menghitung signature unik batch untuk mendeteksi apakah file baru sudah pernah diinspeksi
 */
export function calculateBatchSignature(batchList) {
  return batchList
    .map((item) => `${item.name}:${Math.round(item.fileTime)}:${item.size}`)
    .sort()
    .join('|');
}

/**
 * Menandai signature batch saat ini sebagai sudah diinspeksi
 */
export function markBatchInspected(signature) {
  if (signature === '__RESET__' || signature === 'reset' || signature === '') {
    lastInspectedSignature = null;
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        cfg.last_inspected_signature = null;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      }
    } catch (_) {}
    return null;
  }

  if (!signature) {
    const latest = getLatestLiveImagesWithMeta(16);
    if (latest.length > 0) {
      signature = calculateBatchSignature(latest);
    }
  }
  if (signature) {
    lastInspectedSignature = signature;
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        cfg.last_inspected_signature = signature;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
      }
    } catch (_) {}
  }
  return lastInspectedSignature;
}

/**
 * MODE LIVE (Mesin Kamera X-Ray Riil):
 * Mengambil 16 file citra TERBARU berdasarkan jam/waktu modifikasi (mtimeMs/birthtimeMs)
 * 15 file pertama adalah st1 s/d st15, file ke-16 adalah frame reset blur.
 */
export function getLatestLiveImages(batchSize = 16) {
  const meta = getLatestLiveImagesWithMeta(batchSize);
  if (meta.length === 0) return [];
  return meta
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * AUTO-DETECTION WATCHER:
 * Mengecek apakah ada batch citra baru dari mesin X-Ray / Drive Z: yang siap diinspeksi secara otomatis
 */
export function checkNewLiveBatch() {
  const mode = getTrayMode();
  if (mode !== 'live') {
    return { hasNewBatch: false, mode, reason: 'Mode saat ini adalah DEMO' };
  }

  // Sinkronkan status inspeksi tersimpan di config.json
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (cfg.last_inspected_signature !== undefined) {
        lastInspectedSignature = cfg.last_inspected_signature;
      }
    }
  } catch (_) {}

  const latestMeta = getLatestLiveImagesWithMeta(16);
  if (latestMeta.length < 15) {
    return { hasNewBatch: false, mode, reason: `Jumlah file (${latestMeta.length}) kurang dari 15 pocket` };
  }

  // Cek apakah ada file 0-byte (masih sedang ditulis/transfer oleh Windows Network Share)
  const hasIncompleteFile = latestMeta.some((f) => f.size < 500);
  if (hasIncompleteFile) {
    return { hasNewBatch: false, mode, reason: 'File masih dalam proses transfer jaringan (size < 500 byte)' };
  }

  // Debounce: Tunggu minimal 600ms sejak kedatangan file terakhir agar transfer selesai stabil
  const newestFileTime = latestMeta[0].fileTime;
  const ageMs = Date.now() - newestFileTime;
  if (ageMs >= 0 && ageMs < 600) {
    return { hasNewBatch: false, mode, reason: 'Menunggu transfer 16 file selesai stabil (debounce)' };
  }

  const signature = calculateBatchSignature(latestMeta);

  if (signature === lastInspectedSignature) {
    return {
      hasNewBatch: false,
      mode,
      signature,
      reason: 'Batch ini sudah diinspeksi sebelumnya'
    };
  }

  // Urutkan nama file sesuai urutan pocket st1 s/d st16
  const sortedNames = [...latestMeta]
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return {
    hasNewBatch: true,
    mode,
    signature,
    batchSize: sortedNames.length,
    sequence: sortedNames,
    reason: 'Batch baru terdeteksi dari PC X-Ray / Drive Z:'
  };
}

/**
 * MODE DEMO (Simulasi Dataset Pool):
 * Mengambil sekuens 15 gambar dari dataset pool dengan distribusi acak seimbang
 * (12-13 part OK dengan 2-3 part NG untuk verifikasi Pokayoke).
 */
export function getNextTrayImages(batchSize = 15) {
  const allImages = getAllDatasetImages();
  if (allImages.length === 0) return [];

  // Pisahkan citra ke dalam pool OK dan NG berdasarkan nama file toleransi efektif (0.763 - 1.637 mm)
  const okPool = [];
  const ngUnderPool = [];
  const ngOverPool = [];

  for (const f of allImages) {
    const m = f.match(/^([0-9]+\.?[0-9]*)/);
    if (m) {
      const val = parseFloat(m[1]);
      if (val < 0.763) ngUnderPool.push(f);
      else if (val > 1.637) ngOverPool.push(f);
      else okPool.push(f);
    } else {
      okPool.push(f);
    }
  }

  // Fisher-Yates shuffle helper
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const shuffledOk = shuffle(okPool);
  const shuffledNgUnder = shuffle(ngUnderPool);
  const shuffledNgOver = shuffle(ngOverPool);

  // Komposisi realistis lini produksi (12-13 part OK, 2-3 part NG defect)
  const targetNgCount = Math.floor(Math.random() * 2) + 2; // 2 atau 3 part NG
  const targetOkCount = Math.max(1, batchSize - targetNgCount);

  const selected = [];

  // 1. Masukkan part OK acak
  for (let i = 0; i < targetOkCount && i < shuffledOk.length; i++) {
    selected.push(shuffledOk[i]);
  }

  // 2. Masukkan 1 part Under-gap (jika ada) untuk variasi defect
  if (shuffledNgUnder.length > 0) {
    selected.push(shuffledNgUnder[0]);
  }

  // 3. Masukkan part Over-gap sampai jumlah mencapai batchSize
  let overIdx = 0;
  while (selected.length < batchSize && overIdx < shuffledNgOver.length) {
    selected.push(shuffledNgOver[overIdx++]);
  }

  // Fallback jika pool defect kurang
  let okIdx = targetOkCount;
  while (selected.length < batchSize && okIdx < shuffledOk.length) {
    selected.push(shuffledOk[okIdx++]);
  }

  // 4. Acak posisi stasiun akhir (st1 s/d st15) sehingga lokasi part NG bervariasi alami
  return shuffle(selected);
}

// In-memory state Tray & Metrics saat ini (Standby awal shift: 0 produk)
let currentTrayState = null;
let cumulativeMetrics = {
  totalProduct: 0,
  okQty: 0,
  ngQty: 0,
  lossTimeSec: 0,
  targetCtSec: 1.2,
  actualCtSec: 0
};

export const trayService = {
  getAllDatasetImages,
  getNextTrayImages,
  getLatestLiveImages,
  getLatestLiveImagesWithMeta,
  calculateBatchSignature,
  checkNewLiveBatch,
  markBatchInspected,
  getTrayMode,
  setTrayMode,

  getCurrentTray() {
    if (!currentTrayState) {
      return this.resetTray();
    }
    return currentTrayState;
  },

  resetTray() {
    const activePart = dandoriService.getCurrentPart();
    const metrics = this.getMetrics();
    currentTrayState = {
      trayId: `TRAY-${getLocalDayString()}-STANDBY`,
      inspectedAt: null,
      partNumber: activePart.part_number,
      stations: Array.from({ length: 15 }, (_, idx) => ({
        id: idx + 1,
        station: `st${idx + 1}`,
        image: null,
        resultImage: null,
        value: null,
        judge: null,
        method: null,
        ctSec: 0
      })),
      metrics
    };
    return currentTrayState;
  },

  getMetrics() {
    try {
      const histSummary = historyService.getDailyLogs({ limit: 1 })?.summary;
      if (histSummary) {
        cumulativeMetrics.totalProduct = histSummary.total || 0;
        cumulativeMetrics.okQty = histSummary.okQty || 0;
        cumulativeMetrics.ngQty = histSummary.ngQty || 0;
        if (cumulativeMetrics.totalProduct === 0) {
          cumulativeMetrics.actualCtSec = 0;
        }
      }
    } catch (_) {}

    return cumulativeMetrics;
  },

  /**
   * Eksekusi inferensi AI YOLO secara RIIL untuk 1 stasiun/citra
   * Mengukur keypoint Point A ke Point B via inference_server.py
   * dan mengevaluasi status OK vs NG terhadap standar toleransi yang sedang aktif
   */
  async inspectSingleImage(fileName, stationId = 1, force = true, operator = null) {
    // ── Frame 16: Reset Frame (Blur/Kosong - Penanda Akhir Tray Rotary) ───────
    // Sesuai standar Denso: Frame ke-16 di-ignore dari analisis AI agar tidak memicu False NG
    if (stationId === 16 || /_st16\b/i.test(fileName)) {
      return {
        id: 16,
        station: 'st16 (Reset)',
        image: fileName,
        resultImage: null,
        value: null,
        judge: 'RESET',
        method: 'tray_reset_frame',
        isResetFrame: true,
        ctSec: 0.01,
        note: 'Frame 16 (Reset/Blur) - Akhir Tray Rotary, Di-ignore dari evaluasi AI'
      };
    }

    const inputPath = path.join(INPUT_DIR, fileName);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`File citra ${fileName} tidak ditemukan di folder input`);
    }

    const t0 = performance.now();
    let result = null;

    if (!isSidecarReady()) {
      const ping = await checkSidecarHealth(1000);
      if (!ping) {
        throw new Error('FastAPI Sidecar (Python Inference Server) belum siap');
      }
    }

    const resp = await sidecarPost('/process', {
      input_path: inputPath,
      output_dir: OUTPUT_DIR,
      config_path: CONFIG_PATH,
      log_dir: LOG_DIR
    });

    if (resp.status >= 400) {
      throw new Error(resp.body?.detail || 'Gagal memproses gambar di sidecar');
    }
    result = resp.body;

    const ctSec = (result.ct_sec != null && result.ct_sec > 0)
      ? Number(result.ct_sec)
      : Number(((performance.now() - t0) / 1000).toFixed(3));
    const distMm = Number(result.distance_mm.toFixed(3));

    // Evaluasi Judgement 4KP secara DINAMIS terhadap activePart & parameter resin
    const activePart = dandoriService.getCurrentPart();
    const gapOk = (result.gap_ok !== undefined)
      ? Boolean(result.gap_ok)
      : (distMm >= activePart.min_distance_mm && distMm <= activePart.max_distance_mm);
    const upperOk = (result.upper_ok !== undefined) ? Boolean(result.upper_ok) : true;
    const lowerOk = (result.lower_ok !== undefined) ? Boolean(result.lower_ok) : true;
    const judge = result.judgement || (gapOk && upperOk && lowerOk ? 'OK' : 'NG');

    const outputData = {
      id: stationId,
      station: `st${stationId}`,
      image: fileName,
      resultImage: result.result_image,
      value: distMm,
      judge: judge,
      method: result.method || 'yolo_keypoint',
      point_a: result.point_a_full,
      point_b: result.point_b_full,
      point_c: result.point_c_full,
      point_d: result.point_d_full,
      confidence: result.confidence,
      ctSec: ctSec,
      has_4_keypoints: Boolean(result.has_4_keypoints),
      gap_mm: result.gap_mm ?? distMm,
      gap_ok: gapOk,
      upper_resin_mm: result.upper_resin_mm != null ? Number(result.upper_resin_mm.toFixed(3)) : null,
      upper_ok: upperOk,
      lower_resin_mm: result.lower_resin_mm != null ? Number(result.lower_resin_mm.toFixed(3)) : null,
      lower_ok: lowerOk
    };

    // Update stasiun di currentTrayState jika ada
    if (currentTrayState?.stations) {
      const targetSt = currentTrayState.stations.find((s) => s.id === stationId);
      if (targetSt) {
        const prevJudge = targetSt.judge;
        targetSt.image = fileName;
        targetSt.value = distMm;
        targetSt.judge = judge;
        targetSt.resultImage = result.result_image;
        targetSt.method = outputData.method;
        targetSt.ctSec = ctSec;
        targetSt.has_4_keypoints = outputData.has_4_keypoints;
        targetSt.gap_mm = outputData.gap_mm;
        targetSt.gap_ok = outputData.gap_ok;
        targetSt.upper_resin_mm = outputData.upper_resin_mm;
        targetSt.upper_ok = outputData.upper_ok;
        targetSt.lower_resin_mm = outputData.lower_resin_mm;
        targetSt.lower_ok = outputData.lower_ok;

        if (currentTrayState.summary) {
          if (prevJudge === 'NG' && judge === 'OK') {
            currentTrayState.summary.ng = Math.max(0, currentTrayState.summary.ng - 1);
            currentTrayState.summary.ok += 1;
          } else if (prevJudge === 'OK' && judge === 'NG') {
            currentTrayState.summary.ok = Math.max(0, currentTrayState.summary.ok - 1);
            currentTrayState.summary.ng += 1;
          }
        }
      }
    }

    return outputData;
  },

  /**
   * Menyelesaikan 1 batch tray (15 stasiun aktual): update metriks & catat ke CSV harian
   */
  finishTrayBatch({ trayId, stations, operator = null }) {
    const activePart = dandoriService.getCurrentPart();

    // Pisahkan stasiun part aktual (st1 s/d st15) dari frame ke-16 reset/blur
    const actualStations = stations.filter((item) => !item.isResetFrame && item.judge !== 'RESET' && item.id !== 16);

    let totalCt = 0;
    let okCount = 0;
    let ngCount = 0;

    for (const item of actualStations) {
      totalCt += (item.ctSec != null && item.ctSec > 0 ? item.ctSec : 0.72);
      if (item.judge === 'OK') okCount++;
      else ngCount++;
    }

    const avgCt = Number((totalCt / Math.max(1, actualStations.length)).toFixed(3));

    // Update akumulasi metriks harian (hanya dari 15 part aktual)
    cumulativeMetrics.totalProduct += actualStations.length;
    cumulativeMetrics.okQty += okCount;
    cumulativeMetrics.ngQty += ngCount;
    cumulativeMetrics.actualCtSec = avgCt;

    currentTrayState = {
      trayId,
      inspectedAt: new Date().toISOString(),
      partNumber: activePart.part_number,
      stations: actualStations,
      summary: {
        total: actualStations.length,
        ok: okCount,
        ng: ngCount,
        avgCtSec: avgCt,
        totalCtSec: Number(totalCt.toFixed(2))
      },
      metrics: { ...cumulativeMetrics }
    };

    // Catat batch tray ke file CSV harian Denso (hanya 15 part aktual, abaikan frame 16 reset)
    try {
      historyService.logBatchInspection({
        stations: actualStations,
        operatorName: operator?.name || 'Budi Santoso',
        npk: operator?.npk || '1092',
        partNumber: activePart.part_number,
        trayId
      });
    } catch (hErr) {
      console.warn('[TrayService] Gagal log batch ke history CSV:', hErr.message);
    }

    // Tandai batch saat ini sebagai sudah diinspeksi agar auto-watcher tidak memicu ulang batch yang sama
    try {
      markBatchInspected();
    } catch (_) {}

    return {
      currentTrayState,
      metrics: cumulativeMetrics
    };
  },

  /**
   * Inspeksi 1 Tray Penuh (15 Pocket Aktual) secara berurutan
   */
  async inspectFullTray(imageList = null, customTrayId = null, force = true, operator = null) {
    const batchCount = 15;
    const traySeq = (imageList && imageList.length >= batchCount)
      ? imageList.slice(0, batchCount)
      : getNextTrayImages(batchCount);

    const trayId = customTrayId || `TRAY-${getLocalDayString()}-${Date.now().toString().slice(-4)}`;

    const stationsResult = [];

    // Proses ke-15 stasiun secara riil dengan model YOLO
    for (let i = 0; i < traySeq.length; i++) {
      const fileName = traySeq[i];
      try {
        const inspected = await this.inspectSingleImage(fileName, i + 1, force, operator);
        stationsResult.push(inspected);
      } catch (err) {
        console.warn(`[TrayService] Gagal inspect st${i + 1} (${fileName}):`, err.message);
        // Fallback aman jika salah satu file bermasalah
        stationsResult.push({
          id: i + 1,
          station: `st${i + 1}`,
          image: fileName,
          resultImage: null,
          value: 0.0,
          judge: 'NG',
          method: 'error_unreadable',
          ctSec: 0.08
        });
      }
    }

    const finished = this.finishTrayBatch({
      trayId,
      stations: stationsResult,
      operator
    });

    return finished.currentTrayState;
  }
};
