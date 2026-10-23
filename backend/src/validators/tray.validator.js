import { z } from 'zod';

export const trayInspectSchema = z.object({
  trayId: z.string().optional(),
  images: z.array(z.string()).max(18).optional(),
  partNumber: z.string().optional(),
  force: z.boolean().optional()
});

export const singleStationInspectSchema = z.object({
  stationId: z.number().int().min(1).max(18),
  fileName: z.string().min(1, 'fileName harus diisi'),
  force: z.boolean().optional(),
  trayId: z.string().optional()
});

export const batchFinishSchema = z.object({
  trayId: z.string().min(1),
  stations: z.array(z.any()).min(1).max(18)
});
