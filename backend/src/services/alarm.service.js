import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dandoriService } from './dandori.service.js';
import { trayService } from './tray.service.js';
import { historyService } from './history.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_PATH = path.join(__dirname, '..', 'config', 'users.json');

function getUsers() {
  try {
    const raw = fs.readFileSync(USERS_PATH, 'utf-8');
    return JSON.parse(raw).users || [];
  } catch (_) {
    return [];
  }
}

let isInterlocked = false;
let activeAlarm = null;
const alarmAuditLogs = [];

export const alarmService = {
  getStatus() {
    return {
      isInterlocked,
      activeAlarm,
      totalAlarmsCount: alarmAuditLogs.length,
      lastAlarm: alarmAuditLogs[alarmAuditLogs.length - 1] || null
    };
  },

  getAuditLogs() {
    return alarmAuditLogs;
  },

  triggerAlarm({ stationId, measuredValue, fileName = null, reason = 'IC Chip Position Tolerance Out' }) {
    const activePart = dandoriService.getCurrentPart();
    isInterlocked = true;

    activeAlarm = {
      alarmId: `ALM-${Date.now().toString().slice(-6)}`,
      alarmName: reason,
      stationId,
      stationName: `st${stationId}`,
      fileName,
      measuredValue: Number(Number(measuredValue).toFixed(3)),
      standardRange: {
        partNumber: activePart.part_number,
        minMm: activePart.min_distance_mm,
        maxMm: activePart.max_distance_mm,
        toleranceText: `${activePart.min_distance_mm} - ${activePart.max_distance_mm} mm`
      },
      triggeredAt: new Date().toISOString(),
      leaderVerified: false,
      verifiedLeader: null
    };

    console.log(`[POKAYOKE INTERLOCK] ⚠️ Alarm Terpicu pada st${stationId} (${measuredValue} mm)!`);
    console.log('[PLC I/O] Sinyal Digital Output: NG_STOP => HIGH (Mesin Fisik X-Ray Dibekukan)');

    alarmAuditLogs.push({
      event: 'ALARM_TRIGGERED',
      ...activeAlarm
    });

    return activeAlarm;
  },

  verifyLeader(qrCodeString) {
    const input = String(qrCodeString).trim();
    const users = getUsers();

    // 1. Ekstraksi NPK dari string QR Denso
    // Format bisa: '8021', 'TL8021', 'DENSO:TL:8021:SUGIMOTO', 'ADM001'
    let matchedUser = null;

    // Coba match exact NPK
    matchedUser = users.find((u) => u.npk.toUpperCase() === input.toUpperCase());

    // Coba match substring jika format DENSO:ROLE:NPK:NAME
    if (!matchedUser && input.includes(':')) {
      const parts = input.split(':');
      for (const p of parts) {
        const found = users.find((u) => u.npk.toUpperCase() === p.toUpperCase());
        if (found) {
          matchedUser = found;
          break;
        }
      }
    }

    // Coba match prefix TL / ADM
    if (!matchedUser) {
      const cleanNum = input.replace(/\D/g, '');
      if (cleanNum) {
        matchedUser = users.find((u) => u.npk === cleanNum);
      }
    }

    if (!matchedUser) {
      throw new Error('QR Code ID Card tidak terdaftar di sistem master Denso');
    }

    // Validasi Role: Hanya TL (Team Leader) atau Admin yang boleh me-reset POKAYOKE
    if (matchedUser.role !== 'tl' && matchedUser.role !== 'admin') {
      throw new Error(`Otorisasi Ditolak! Karyawan ${matchedUser.name} (${matchedUser.npk}) berstatus ${matchedUser.role.toUpperCase()}. Reset alarm NG wajib dilakukan oleh Team Leader (TL) atau Admin.`);
    }

    if (activeAlarm) {
      activeAlarm.leaderVerified = true;
      activeAlarm.verifiedLeader = {
        npk: matchedUser.npk,
        name: matchedUser.name,
        role: matchedUser.role,
        department: matchedUser.department,
        verifiedAt: new Date().toISOString()
      };
    }

    alarmAuditLogs.push({
      event: 'LEADER_VERIFIED',
      leader: matchedUser,
      timestamp: new Date().toISOString()
    });

    return {
      leader: matchedUser,
      activeAlarm
    };
  },

  manualOverride({ stationId, manualValueMm, leaderNpk = '8021', notes = '' }) {
    const activePart = dandoriService.getCurrentPart();
    const val = Number(Number(manualValueMm).toFixed(3));
    const isOk = val >= activePart.min_distance_mm && val <= activePart.max_distance_mm;
    const judge = isOk ? 'OK' : 'NG';

    // Update stasiun di trayService
    const currentTray = trayService.getCurrentTray();
    if (currentTray?.stations) {
      const target = currentTray.stations.find((s) => s.id === stationId);
      if (target) {
        target.value = val;
        target.judge = judge;
        target.method = 'manual_measurement';
      }
    }

    const logEntry = {
      event: 'MANUAL_OVERRIDE',
      stationId,
      manualValueMm: val,
      judge,
      leaderNpk,
      notes,
      timestamp: new Date().toISOString()
    };
    alarmAuditLogs.push(logEntry);

    // Catat / perbarui log pengukuran manual ke CSV harian Denso
    try {
      const users = getUsers();
      const leader = users.find((u) => u.npk === leaderNpk) || { name: 'Sugimoto-san (TL)' };
      historyService.updateOrLogInspectionRecord({
        station: `st${stationId}`,
        dimension: val,
        judgment: judge,
        method: 'manual_measurement',
        operatorName: leader.name,
        npk: leaderNpk,
        partNumber: activePart.part_number,
        sequence: currentTray?.trayId || 'TRAY-MANUAL'
      });
      // Sinkronkan cumulative metrics setelah revisi manual
      trayService.getMetrics();
    } catch (_) {}

    // Jika hasil ukur manual valid (OK), lepaskan interlock otomatis
    if (isOk) {
      this.releaseInterlock({
        leaderNpk,
        action: 'manual_override',
        reason: `Pengukuran Manual Terverifikasi OK: ${val} mm (Batas: ${activePart.min_distance_mm} - ${activePart.max_distance_mm} mm)`
      });
    }

    return {
      stationId,
      value: val,
      judge,
      isOk,
      isInterlocked,
      message: isOk
        ? `Pengukuran manual ${val} mm memenuhi standar (${activePart.min_distance_mm} - ${activePart.max_distance_mm} mm). Interlock dibuka.`
        : `Pengukuran manual ${val} mm tetap NG di luar standar. Interlock tetap aktif.`
    };
  },

  releaseInterlock({ leaderNpk = '8021', action = 'release', reason = 'Verifikasi Leader Selesai' }) {
    const prevAlarm = activeAlarm;
    isInterlocked = false;
    activeAlarm = null;

    console.log(`[POKAYOKE INTERLOCK] ✓ Interlock dilepaskan oleh Leader (NPK: ${leaderNpk}). Tindakan: ${action}`);
    console.log('[PLC I/O] Sinyal Digital Output: NG_STOP => LOW (Mesin Fisik X-Ray Siap Melanjutkan Operasi)');

    alarmAuditLogs.push({
      event: 'INTERLOCK_RELEASED',
      leaderNpk,
      action,
      reason,
      clearedAlarm: prevAlarm,
      timestamp: new Date().toISOString()
    });

    return {
      isInterlocked: false,
      message: 'Interlock POKAYOKE berhasil dilepaskan. Sinyal PLC normal, mesin siap beroperasi.'
    };
  }
};
