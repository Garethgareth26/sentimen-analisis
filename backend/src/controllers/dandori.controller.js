import { dandoriService } from '../services/dandori.service.js';
import { dandoriSchema } from '../validators/dandori.validator.js';

export const dandoriController = {
  getMasterParts(_req, res) {
    res.json({
      ok: true,
      masterParts: dandoriService.getMasterParts()
    });
  },

  getCurrentPart(_req, res) {
    res.json({
      ok: true,
      activePart: dandoriService.getCurrentPart()
    });
  },

  changeover(req, res) {
    const parseRes = dandoriSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({
        ok: false,
        error: parseRes.error.errors[0]?.message || 'Data Dandori tidak valid'
      });
    }

    const { qrCode } = parseRes.data;
    const operatorName = req.user?.name || req.body.operatorName || 'Operator';
    const parsed = dandoriService.parseKanbanQr(qrCode);

    if (!parsed.part_number) {
      return res.status(400).json({
        ok: false,
        error: 'QR Code Kanban tidak dikenali sebagai Part Number yang valid.'
      });
    }

    const lockedPart = dandoriService.lockPartNumber(parsed, operatorName);
    const updatedConfig = dandoriService.getSystemConfig();

    return res.json({
      ok: true,
      message: `Dandori Sukses! Part Number ${lockedPart.part_number} berhasil dikunci.`,
      activePart: lockedPart,
      settings: updatedConfig
    });
  }
};
