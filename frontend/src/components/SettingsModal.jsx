import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Settings,
  X,
  Save,
  Folder,
  Cpu,
  HardDrive,
  FileCode,
  Check,
  AlertCircle
} from 'lucide-react';

import { API } from '../apiConfig.js';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings }) {
  const [activeTab, setActiveTab] = useState('save_image');
  const [form, setForm] = useState({
    save_option: 'all', // all | ng_only | ok_only
    image_format: 'jpg', // jpg | png
    storage_path: 'output',
    qc_server_path: 'C:\\QC_Server_Backup\\XRay_History',
    scale_mm_per_pixel: 0.02185,
    tolerance_min: 0.70,
    tolerance_max: 1.70,
    jig_offset_mm: 0.063,
    plc_enabled: false,
    plc_port: 'COM3 (RS-485 Modbus RTU)',
    plc_address: 'Y001 / Relay Out #1',
    model_path: 'models/best.pt',
    input_mode: 'full_raw'
  });

  useEffect(() => {
    if (settings) {
      setForm((prev) => ({
        ...prev,
        storage_path: settings.storage?.storage_path || prev.storage_path,
        save_option: settings.storage?.save_option || prev.save_option,
        image_format: settings.storage?.image_format || prev.image_format,
        qc_server_path: settings.storage?.qc_server_path || prev.qc_server_path,
        scale_mm_per_pixel: settings.scale_mm_per_pixel ?? prev.scale_mm_per_pixel,
        tolerance_min: settings.standard?.min_distance_mm ?? prev.tolerance_min,
        tolerance_max: settings.standard?.max_distance_mm ?? prev.tolerance_max,
        jig_offset_mm: settings.standard?.jig_offset_mm ?? prev.jig_offset_mm,
        plc_enabled: settings.plc?.enabled ?? prev.plc_enabled,
        plc_port: settings.plc?.port || prev.plc_port,
        plc_address: settings.plc?.signal_address || prev.plc_address,
        model_path: settings.ai_model?.model_path || prev.model_path,
        input_mode: settings.ai_model?.input_mode || prev.input_mode
      }));
    }
  }, [settings]);

  if (!isOpen) return null;

  function handleSave(e) {
    e?.preventDefault();
    const payload = {
      scale_mm_per_pixel: Number(form.scale_mm_per_pixel),
      standard: {
        ...(settings?.standard || {}),
        min_distance_mm: Number(form.tolerance_min),
        max_distance_mm: Number(form.tolerance_max),
        jig_offset_mm: Number(form.jig_offset_mm)
      },
      storage: {
        storage_path: form.storage_path,
        save_option: form.save_option,
        image_format: form.image_format,
        qc_server_path: form.qc_server_path
      },
      ai_model: {
        ...(settings?.ai_model || {}),
        model_path: form.model_path,
        input_mode: form.input_mode
      },
      plc: {
        enabled: form.plc_enabled,
        port: form.plc_port,
        signal_address: form.plc_address
      }
    };
    onSaveSettings(payload);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal-dialog" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Settings size={18} color="#0284c7" />
            <span>Pengaturan Sistem</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body 2 Kolom (Sidebar Tabs & Tab Panel) */}
        <div style={{ display: 'flex', minHeight: '360px' }}>
          {/* Sidebar Tabs Mockup Image 15: Save Image, I/O (PLC), Program Files */}
          <div
            style={{
              width: '190px',
              borderRight: '1px solid #e2e8f0',
              background: '#f8fafc',
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <button
              type="button"
              className={`action-btn ${activeTab === 'save_image' ? 'primary' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%', fontSize: '12px' }}
              onClick={() => setActiveTab('save_image')}
            >
              <HardDrive size={15} />
              <span>Save Image</span>
            </button>

            <button
              type="button"
              className={`action-btn ${activeTab === 'plc' ? 'primary' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%', fontSize: '12px' }}
              onClick={() => setActiveTab('plc')}
            >
              <Cpu size={15} />
              <span>I/O (PLC)</span>
            </button>

            <button
              type="button"
              className={`action-btn ${activeTab === 'program_files' ? 'primary' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%', fontSize: '12px' }}
              onClick={() => setActiveTab('program_files')}
            >
              <FileCode size={15} />
              <span>Program Files</span>
            </button>

            <button
              type="button"
              className={`action-btn ${activeTab === 'tolerances' ? 'primary' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%', fontSize: '12px' }}
              onClick={() => setActiveTab('tolerances')}
            >
              <Settings size={15} />
              <span>Toleransi & Skala</span>
            </button>

          </div>

          {/* Tab Content Panel */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            {/* ── TAB 1: SAVE IMAGE (Fitur 5 & Fitur 7) ────────────────────────── */}
            {activeTab === 'save_image' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    <Folder size={14} />
                    STORAGE LOCATION (FOLDER PATH)
                  </label>
                  <input
                    type="text"
                    className="exact-input"
                    value={form.storage_path}
                    onChange={(e) => setForm({ ...form, storage_path: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Folder penyimpanan lokal citra inspeksi X-Ray.
                  </span>
                </div>

                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    SAVE IMAGE JUDGEMENT (FITUR 5)
                  </label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    {[
                      { id: 'all', label: 'All Images' },
                      { id: 'ng_only', label: 'NG Only' },
                      { id: 'ok_only', label: 'OK Only' }
                    ].map((opt) => (
                      <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="save_option"
                          checked={form.save_option === opt.id}
                          onChange={() => setForm({ ...form, save_option: opt.id })}
                        />
                        <span style={{ fontWeight: form.save_option === opt.id ? 700 : 400, color: form.save_option === opt.id ? '#0284c7' : '#334155' }}>
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: '#059669', marginTop: '6px', display: 'block', fontWeight: 600 }}>
                    ✓ Sesuai SOP Denso: Data CSV selalu tersimpan 100% di semua mode.
                  </span>
                </div>

                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    FORMAT SAVE IMAGE
                  </label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    {['jpg', 'png'].map((fmt) => (
                      <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="image_format"
                          checked={form.image_format === fmt}
                          onChange={() => setForm({ ...form, image_format: fmt })}
                        />
                        <span style={{ textTransform: 'uppercase', fontWeight: form.image_format === fmt ? 700 : 400 }}>
                          {fmt}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    QC / PED SERVER TARGET DIRECTORY (FITUR 7)
                  </label>
                  <input
                    type="text"
                    className="exact-input"
                    value={form.qc_server_path}
                    onChange={(e) => setForm({ ...form, qc_server_path: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Folder tujuan PC server QC/PED untuk sinkronisasi harian (e.g. C:\QC_Server_Backup\XRay_History).
                  </span>
                </div>
              </div>
            )}

            {/* ── TAB 2: I/O PLC ──────────────────────────────────────────────── */}
            {activeTab === 'plc' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  Konfigurasi modul antarmuka hardware PLC (Omron / Mitsubishi FX5U) untuk interlock mesin fisik X-Ray saat terjadi alarm NG.
                </p>

                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.plc_enabled}
                      onChange={(e) => setForm({ ...form, plc_enabled: e.target.checked })}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      Aktifkan Sinyal Hardware Interlock PLC (NG_STOP)
                    </span>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="exact-field-label" style={{ marginBottom: '4px' }}>PORT PLC (SERIAL / COM)</label>
                    <input
                      type="text"
                      className="exact-input"
                      value={form.plc_port}
                      onChange={(e) => setForm({ ...form, plc_port: e.target.value })}
                      placeholder="e.g. COM3 (RS-485 Modbus RTU)"
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Sesuaikan dengan port di Windows Device Manager saat adapter RS-485 dicolok.
                    </span>
                  </div>
                  <div>
                    <label className="exact-field-label" style={{ marginBottom: '4px' }}>SIGNAL NG_STOP ADDRESS</label>
                    <input
                      type="text"
                      className="exact-input"
                      value={form.plc_address}
                      onChange={(e) => setForm({ ...form, plc_address: e.target.value })}
                      placeholder="e.g. Y001 / Relay Out #1"
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Alamat register coil/relay output fisik pada modul PLC Omron/Mitsubishi.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: PROGRAM FILES (PATH MODEL) ──────────────────────────── */}
            {activeTab === 'program_files' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    PATH MODEL AI INFERENCE (YOLOv8x-pose)
                  </label>
                  <input
                    type="text"
                    className="exact-input"
                    value={form.model_path}
                    onChange={(e) => setForm({ ...form, model_path: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Model resmi Denso Phase 4: models/best.pt
                  </span>
                </div>

                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    AI INPUT MODE (WAJIB FULL_RAW)
                  </label>
                  <input
                    type="text"
                    className="exact-input"
                    value={form.input_mode}
                    readOnly
                    style={{ background: '#f1f5f9' }}
                  />
                  <span style={{ fontSize: '11px', color: '#0369a1', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Mode full_raw aktif untuk menjaga presisi keypoint Point A dan Point B.
                  </span>
                </div>
              </div>
            )}

            {/* ── TAB 4: TOLERANSI & SKALA ────────────────────────────────────── */}
            {activeTab === 'tolerances' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    SKALA PIXEL KE MM (CALIBRATION SCALE)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    className="exact-input"
                    value={form.scale_mm_per_pixel}
                    onChange={(e) => setForm({ ...form, scale_mm_per_pixel: parseFloat(e.target.value) })}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Standar pin gauge Denso: 0.02185 mm/px
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                      DRAWING MINIMUM (MM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="exact-input"
                      value={form.tolerance_min}
                      onChange={(e) => setForm({ ...form, tolerance_min: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                      DRAWING MAKSIMUM (MM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="exact-input"
                      value={form.tolerance_max}
                      onChange={(e) => setForm({ ...form, tolerance_max: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="exact-field-label" style={{ marginBottom: '6px' }}>
                    JIG OFFSET / SAFETY MARGIN (MM)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    className="exact-input"
                    value={form.jig_offset_mm}
                    onChange={(e) => setForm({ ...form, jig_offset_mm: parseFloat(e.target.value) })}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Kompensasi toleransi jig Denso (Standar: 0.063 mm) untuk zero defect flow out.
                  </span>
                </div>

                {/* Info Box Batas Efektif */}
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>
                    RENTANG TOLERANSI EFEKTIF SISTEM:
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                    {(Number(form.tolerance_min || 0) + Number(form.jig_offset_mm || 0)).toFixed(3)} mm s/d {(Number(form.tolerance_max || 0) - Number(form.jig_offset_mm || 0)).toFixed(3)} mm
                  </div>
                  <span style={{ fontSize: '11px', color: '#0369a1', marginTop: '4px', display: 'block' }}>
                    Sistem mengevaluasi OK hanya jika part berada dalam rentang efektif di atas.
                  </span>
                </div>
              </div>
            )}


          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="action-btn" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="action-btn primary" onClick={handleSave}>
            <Save size={14} />
            <span>Simpan Konfigurasi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
