import { alarmService } from '../services/alarm.service.js';
import {
  verifyLeaderSchema,
  triggerAlarmSchema,
  manualOverrideSchema,
  releaseAlarmSchema
} from '../validators/alarm.validator.js';

export const alarmController = {
  getStatus(_req, res) {
    const status = alarmService.getStatus();
    res.json({ ok: true, data: status });
  },

  getAuditLogs(_req, res) {
    const logs = alarmService.getAuditLogs();
    res.json({ ok: true, data: logs });
  },

  triggerAlarm(req, res) {
    const parseRes = triggerAlarmSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Data trigger alarm tidak valid'
      });
    }

    try {
      const alarm = alarmService.triggerAlarm(parseRes.data);
      return res.json({
        ok: true,
        message: `Alarm POKAYOKE aktif untuk st${parseRes.data.stationId}. Interlock terkunci.`,
        data: alarm
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  verifyLeader(req, res) {
    const parseRes = verifyLeaderSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'QR Code Leader wajib diisi'
      });
    }

    try {
      const result = alarmService.verifyLeader(parseRes.data.qrCode);
      return res.json({
        ok: true,
        message: `Otorisasi Leader Terverifikasi: ${result.leader.name} (${result.leader.role.toUpperCase()})`,
        data: result
      });
    } catch (err) {
      return res.status(403).json({
        ok: false,
        error: err.message
      });
    }
  },

  manualOverride(req, res) {
    const parseRes = manualOverrideSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Data pengukuran manual tidak valid'
      });
    }

    try {
      const result = alarmService.manualOverride(parseRes.data);
      return res.json({
        ok: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  releaseAlarm(req, res) {
    const parseRes = releaseAlarmSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Data pelepasan alarm tidak valid'
      });
    }

    try {
      const result = alarmService.releaseInterlock(parseRes.data);
      return res.json({
        ok: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
};
