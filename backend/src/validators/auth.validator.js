import { z } from 'zod';

export const loginSchema = z.object({
  name: z.string().trim().max(80, 'Nama terlalu panjang').optional().default(''),
  npk: z.string().trim().min(1, 'NPK operator wajib diisi').max(30, 'NPK terlalu panjang'),
  role: z.enum(['operator', 'tl', 'admin']).optional()
});

export const qrLoginSchema = z.object({
  qrCode: z.string().trim().min(1, 'Data QR Code tidak boleh kosong')
});

/**
 * Middleware validator pembungkus skema Zod sesuai standar DNIA DX Starter Kit
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.validated = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues || err.errors || [];
        return res.status(400).json({
          ok: false,
          error: issues[0]?.message || 'Validasi data gagal',
          details: issues.map((e) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      next(err);
    }
  };
}
