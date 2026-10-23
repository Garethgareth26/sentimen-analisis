import { z } from 'zod';

export const dandoriSchema = z.object({
  qrCode: z.string().min(3, 'QR Code Kanban tidak boleh kosong'),
  partNumber: z.string().optional(),
  partName: z.string().optional(),
  minTolerance: z.number().positive().optional(),
  maxTolerance: z.number().positive().optional()
});

export const calibrationRegisterSchema = z.object({
  scale_mm_per_pixel: z.number().positive().max(1.0, 'Skala mm/px tidak realistis (> 1.0)'),
  ref_mm: z.number().positive().optional(),
  measured_px: z.number().positive().optional(),
  calibrated_by: z.string().optional(),
  is_day_shift: z.boolean().optional()
});
