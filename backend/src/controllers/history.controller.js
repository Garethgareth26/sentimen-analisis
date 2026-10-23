import fs from 'fs';
import path from 'path';
import { historyService, formatDateIso } from '../services/history.service.js';

export const historyController = {
  /**
   * Mengambil riwayat log inspeksi harian dengan filter
   */
  getLogs(req, res) {
    try {
      const { date, judgment, station, search, page, limit } = req.query;
      const data = historyService.getDailyLogs({
        date: date || formatDateIso(),
        judgment: judgment || 'all',
        station: station || 'all',
        search: search || '',
        page: page || 1,
        limit: limit || 100
      });
      res.json({ ok: true, data });
    } catch (err) {
      console.error('[HistoryController] Error getLogs:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  /**
   * Mengambil daftar tanggal yang memiliki riwayat log
   */
  getAvailableDates(_req, res) {
    try {
      const dates = historyService.getAvailableDates();
      res.json({ ok: true, dates });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  /**
   * Download / Export file CSV harian langsung
   */
  downloadCsv(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || formatDateIso();
      const csvPath = historyService.getCsvPathForDate(targetDate);

      historyService.ensureDailyCsv(csvPath);

      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ ok: false, error: 'File log CSV tidak ditemukan' });
      }

      const fileName = path.basename(csvPath);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      const fileStream = fs.createReadStream(csvPath);
      fileStream.pipe(res);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  /**
   * Eksekusi transfer data ke PC Server QC/PED (Fitur 7)
   */
  transferData(req, res) {
    try {
      const { date, targetPath, includeImages } = req.body || {};
      const result = historyService.transferToQcServer({
        date,
        targetPath,
        includeImages: includeImages ?? true
      });
      res.json({ ok: true, result });
    } catch (err) {
      console.error('[HistoryController] Error transferData:', err);
      res.status(500).json({ ok: false, error: `Transfer gagal: ${err.message}` });
    }
  },

  /**
   * Mengambil riwayat audit transfer server QC
   */
  getTransferStatus(_req, res) {
    try {
      const audits = historyService.getTransferAuditHistory();
      res.json({ ok: true, audits, lastTransfer: audits[0] || null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
};
