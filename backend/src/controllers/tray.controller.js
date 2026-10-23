import { trayService } from '../services/tray.service.js';
import { getLocalDayString } from '../services/history.service.js';
import { trayInspectSchema, singleStationInspectSchema, batchFinishSchema } from '../validators/tray.validator.js';

export const trayController = {
  getCurrentTray(_req, res) {
    const data = trayService.getCurrentTray();
    res.json({ ok: true, data });
  },

  getMetrics(_req, res) {
    const metrics = trayService.getMetrics();
    res.json({ ok: true, metrics });
  },

  resetTray(_req, res) {
    const data = trayService.resetTray();
    res.json({ ok: true, data });
  },

  getMode(_req, res) {
    const mode = trayService.getTrayMode();
    res.json({ ok: true, mode });
  },

  setMode(req, res) {
    const { mode } = req.body || {};
    const updated = trayService.setTrayMode(mode);
    res.json({ ok: true, mode: updated });
  },

  getNextSequence(req, res) {
    const currentMode = req.query.mode || trayService.getTrayMode();
    let sequence = [];
    let isFallback = false;

    if (currentMode === 'live') {
      sequence = trayService.getLatestLiveImages(16);
      if (sequence.length === 0) {
        // Fallback aman jika folder input kosong saat trial
        sequence = trayService.getNextTrayImages(15);
        isFallback = true;
      }
    } else {
      sequence = trayService.getNextTrayImages(15);
    }

    const trayId = `TRAY-${getLocalDayString()}-${Date.now().toString().slice(-4)}`;
    res.json({
      ok: true,
      trayId,
      sequence,
      mode: currentMode,
      isFallback
    });
  },

  finishBatch(req, res) {
    const parseRes = batchFinishSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Data batch tray tidak valid'
      });
    }

    const { trayId, stations } = parseRes.data;
    const operator = req.user ? { name: req.user.name, npk: req.user.npk } : null;

    try {
      const result = trayService.finishTrayBatch({ trayId, stations, operator });
      return res.json({
        ok: true,
        message: `Batch Tray ${trayId} (15 Pocket) Selesai Dicatat.`,
        data: result.currentTrayState,
        metrics: result.metrics
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: `Gagal mencatat batch tray: ${err.message}`
      });
    }
  },

  async inspectTray(req, res) {
    const parseRes = trayInspectSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Payload inspeksi tray tidak valid'
      });
    }

    const { images, trayId, force = true } = parseRes.data;
    const operator = req.user ? { name: req.user.name, npk: req.user.npk } : null;

    try {
      const result = await trayService.inspectFullTray(images, trayId, force, operator);
      return res.json({
        ok: true,
        message: `Inspeksi Tray ${result.trayId} (15 Pocket) Selesai.`,
        data: result
      });
    } catch (err) {
      console.error('[TrayController] Error inspeksi tray:', err);
      return res.status(500).json({
        ok: false,
        error: `Gagal memproses tray: ${err.message}`
      });
    }
  },

  async inspectSingleStation(req, res) {
    const parseRes = singleStationInspectSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Data stasiun tidak valid'
      });
    }

    const { fileName, stationId, force = true } = parseRes.data;
    const operator = req.user ? { name: req.user.name, npk: req.user.npk } : null;

    try {
      const result = await trayService.inspectSingleImage(fileName, stationId, force, operator);
      return res.json({
        ok: true,
        message: `Inspeksi Stasiun st${stationId} Selesai.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: `Gagal memproses stasiun st${stationId}: ${err.message}`
      });
    }
  }
};
