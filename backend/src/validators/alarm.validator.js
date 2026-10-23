import { z } from 'zod';

export const verifyLeaderSchema = z.object({
  qrCode: z.string().min(1, 'QR Code Leader wajib diisi')
});

export const triggerAlarmSchema = z.object({
  stationId: z.number().int().min(1).max(18),
  measuredValue: z.number(),
  fileName: z.string().optional(),
  reason: z.string().optional()
});

export const manualOverrideSchema = z.object({
  stationId: z.number().int().min(1).max(18),
  manualValueMm: z.number().positive('Nilai pengukuran harus lebih dari 0'),
  leaderNpk: z.string().optional(),
  notes: z.string().optional()
});

export const releaseAlarmSchema = z.object({
  leaderNpk: z.string().min(1, 'NPK Leader wajib disertakan'),
  action: z.enum(['release', 'remeasure', 'manual_override']),
  reason: z.string().optional()
});
