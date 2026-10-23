import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const CONFIG_PATH = path.join(BACKEND_ROOT, 'config.json');
const RUNTIME_CONFIG_PATH = path.join(BACKEND_ROOT, 'config_runtime.json');

// Master Part Number Catalog PT. Denso Indonesia (3rd Factory)
export const MASTER_PARTS = [
  {
    part_number: 'DN-XRAY-42890-A',
    part_name: 'Fuel Rail IC Housing (Standard)',
    min_distance_mm: 0.7,
    max_distance_mm: 1.7,
    jig_offset_mm: 0.063,
    ct_target_sec: 1.2
  },
  {
    part_number: 'DN-XRAY-42890-B',
    part_name: 'Fuel Rail IC Housing (Tight Spec)',
    min_distance_mm: 0.95,
    max_distance_mm: 1.55,
    jig_offset_mm: 0.063,
    ct_target_sec: 1.2
  },
  {
    part_number: '28438-51001',
    part_name: 'Direct Sensor IC Housing',
    min_distance_mm: 0.80,
    max_distance_mm: 1.50,
    jig_offset_mm: 0.050,
    ct_target_sec: 1.0
  },
  {
    part_number: '197400-0010',
    part_name: 'Airflow Meter IC Housing',
    min_distance_mm: 0.89,
    max_distance_mm: 1.61,
    jig_offset_mm: 0.063,
    ct_target_sec: 1.2
  }
];

export const dandoriService = {
  getMasterParts() {
    return MASTER_PARTS;
  },

  getSystemConfig() {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (_) {
      return {};
    }
  },

  getCurrentPart() {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (cfg.active_part) return cfg.active_part;
    } catch (_) {}
    return {
      part_number: 'DN-XRAY-42890-A',
      part_name: 'Fuel Rail IC Housing (Standard)',
      min_distance_mm: 0.7,
      max_distance_mm: 1.7,
      jig_offset_mm: 0.063,
      locked_at: new Date().toISOString(),
      locked_by: 'SYSTEM'
    };
  },

  parseKanbanQr(qrString) {
    const raw = (qrString || '').trim();

    // 1. JSON Format
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const obj = JSON.parse(raw);
        return {
          part_number: obj.partNumber || obj.part_number || obj.pn,
          part_name: obj.partName || obj.name,
          min_distance_mm: parseFloat(obj.min || obj.min_distance_mm),
          max_distance_mm: parseFloat(obj.max || obj.max_distance_mm)
        };
      } catch (_) {}
    }

    // 2. Format Delimited Denso: KANBAN:DN-XRAY-42890-A:MIN=0.89:MAX=1.61
    if (raw.toUpperCase().startsWith('KANBAN:')) {
      const parts = raw.split(':');
      const pn = parts[1];
      let minVal, maxVal, nameVal;
      for (let i = 2; i < parts.length; i++) {
        const token = parts[i].toUpperCase();
        if (token.startsWith('MIN=')) minVal = parseFloat(token.replace('MIN=', ''));
        if (token.startsWith('MAX=')) maxVal = parseFloat(token.replace('MAX=', ''));
        if (token.startsWith('NAME=')) nameVal = parts[i].substring(5);
      }
      return {
        part_number: pn,
        part_name: nameVal,
        min_distance_mm: minVal,
        max_distance_mm: maxVal
      };
    }

    // 3. Fallback: Cocokkan langsung dengan Master Catalog
    const matched = MASTER_PARTS.find((p) =>
      p.part_number.toLowerCase() === raw.toLowerCase() ||
      raw.toLowerCase().includes(p.part_number.toLowerCase())
    );

    if (matched) {
      return { ...matched };
    }

    // 4. Default: Buat part baru dengan standar toleransi default Denso
    return {
      part_number: raw,
      part_name: 'Custom Part Production',
      min_distance_mm: 0.7,
      max_distance_mm: 1.7
    };
  },

  lockPartNumber(parsedData, operatorName = 'Operator') {
    const matchedMaster = MASTER_PARTS.find((p) => p.part_number === parsedData.part_number) || {};

    const activePart = {
      part_number: parsedData.part_number,
      part_name: parsedData.part_name || matchedMaster.part_name || 'Production Part',
      min_distance_mm: parsedData.min_distance_mm || matchedMaster.min_distance_mm || 0.7,
      max_distance_mm: parsedData.max_distance_mm || matchedMaster.max_distance_mm || 1.7,
      jig_offset_mm: matchedMaster.jig_offset_mm ?? 0.063,
      ct_target_sec: matchedMaster.ct_target_sec ?? 1.2,
      locked_at: new Date().toISOString(),
      locked_by: operatorName
    };

    // Update config.json
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      cfg.active_part = activePart;
      cfg.standard = cfg.standard || {};
      cfg.standard.min_distance_mm = activePart.min_distance_mm;
      cfg.standard.max_distance_mm = activePart.max_distance_mm;
      cfg.standard.jig_offset_mm = activePart.jig_offset_mm;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');

      // Update config_runtime.json
      if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
        const runtimeCfg = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf-8'));
        runtimeCfg.active_part = activePart;
        runtimeCfg.standard = runtimeCfg.standard || {};
        runtimeCfg.standard.min_distance_mm = activePart.min_distance_mm;
        runtimeCfg.standard.max_distance_mm = activePart.max_distance_mm;
        runtimeCfg.standard.jig_offset_mm = activePart.jig_offset_mm;
        fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(runtimeCfg, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('[DandoriService] Gagal update config file:', err);
    }

    return activePart;
  }
};
