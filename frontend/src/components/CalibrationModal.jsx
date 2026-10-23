import React, { useState, useRef, useEffect } from 'react';
import { Target, X, Camera, Check, AlertCircle, Save, Crosshair, RefreshCw, ShieldAlert, Image as ImageIcon, SlidersHorizontal, Info } from 'lucide-react';
import axios from 'axios';

import { API } from '../apiConfig.js';

export default function CalibrationModal({
  isOpen,
  onClose,
  isDayShift = true,
  currentScale = 0.02185,
  onSaveScale
}) {
  const [selectedFileName, setSelectedFileName] = useState('3.44.jpg');
  const [availableImages, setAvailableImages] = useState([]);
  const [jigValue, setJigValue] = useState('3.44');
  const [unit, setUnit] = useState('mm');
  const [measuredPixels, setMeasuredPixels] = useState('157.44');
  const [calculatedScale, setCalculatedScale] = useState(currentScale || 0.02185);
  const [jigImageUrl, setJigImageUrl] = useState(`${API}/input/3.44.jpg`);
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Citra Master Jig siap. Skala target Denso: 0.02185 mm/px');
  const [errorMsg, setErrorMsg] = useState('');
  const [pokayokeAlert, setPokayokeAlert] = useState(null);

  const imgRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCalculatedScale(currentScale || 0.02185);
      setPokayokeAlert(null);
      setErrorMsg('');
      loadAvailableImages();
    }
  }, [isOpen, currentScale]);

  async function loadAvailableImages() {
    try {
      const resp = await axios.get(`${API}/api/system/images`);
      if (resp.data?.files) {
        setAvailableImages(resp.data.files);
        const has344 = resp.data.files.some(f => f.name === '3.44.jpg');
        if (has344) {
          handleSelectImage('3.44.jpg');
        }
      }
    } catch (err) {
      console.warn('Gagal memuat daftar citra input:', err.message);
    }
  }

  function handleSelectImage(fileName) {
    setSelectedFileName(fileName);
    setJigImageUrl(`${API}/input/${fileName}`);
    setPoints([]);
    setPokayokeAlert(null);

    if (fileName === '3.44.jpg') {
      setJigValue('3.44');
      setMeasuredPixels('147.00');
      setCalculatedScale(0.0234);
      setStatusMsg('Master Jig 3.44.jpg dipilih (Jig Normal - Ruang Kosong). Klik "Get Image Jig" untuk verifikasi.');
    } else if (fileName === '1.090.jpg') {
      setStatusMsg('⚠️ Citra 1.090.jpg dipilih (Simulasi part produk IC masih tertinggal/nyantol). Klik "Get Image Jig" untuk menguji proteksi POKAYOKE!');
    } else {
      setStatusMsg(`Citra ${fileName} dimuat. Klik "Get Image Jig" untuk verifikasi.`);
    }
  }

  if (!isOpen) return null;

  async function handleGetImage() {
    setLoading(true);
    setStatusMsg(`Memverifikasi & mengambil citra live master jig (${selectedFileName})...`);
    setErrorMsg('');
    setPokayokeAlert(null);

    const targetFile = selectedFileName || '3.44.jpg';

    try {
      const resp = await axios.post(`${API}/api/calibration/measure`, {
        fileName: targetFile,
        ref_mm: parseFloat(jigValue) || 3.44,
        allowPartBypass: false
      });

      if (resp.data.ok) {
        setCalculatedScale(resp.data.scale_mm_per_pixel);
        setMeasuredPixels(String(resp.data.measured_px));
        setSelectedFileName(resp.data.input_file);
        setJigImageUrl(`${API}/input/${resp.data.input_file}`);
        setStatusMsg(`✓ Citra Master Jig lolos verifikasi POKAYOKE (Ruang kosong). Skala terhitung: ${resp.data.scale_mm_per_pixel} mm/px (Tebal pin: ${resp.data.measured_px} px)`);
      }
    } catch (err) {
      if (err.response?.status === 422 || err.response?.data?.code === 'PART_ATTACHED_ERROR') {
        setPokayokeAlert(err.response.data);
        setStatusMsg('');
      } else {
        setErrorMsg(err.response?.data?.error || err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCanvasClick(e) {
    if (!isDrawingLine) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (points.length === 0 || points.length === 2) {
      setPoints([{ x, y }]);
    } else if (points.length === 1) {
      const p1 = points[0];
      const p2 = { x, y };
      const distPxDisplay = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      setPoints([p1, p2]);
      setIsDrawingLine(false);

      if (distPxDisplay > 0) {
        // Konversi koordinat layar ke koordinat piksel asli citra (natural image resolution)
        const img = imgRef.current;
        let scaleFactor = 1;
        if (img && img.naturalHeight && img.clientHeight) {
          scaleFactor = img.naturalHeight / img.clientHeight;
        }

        const realImagePx = Number((distPxDisplay * scaleFactor).toFixed(2));
        setMeasuredPixels(String(realImagePx));

        const refMm = parseFloat(jigValue) || 3.44;
        const newScale = Number((refMm / realImagePx).toFixed(6));
        setCalculatedScale(newScale);
        setStatusMsg(`Garis terukur: ${realImagePx} px (asli). Skala: ${newScale} mm/px`);
      }
    }
  }

  async function handleRegister() {
    try {
      const resp = await axios.post(`${API}/api/calibration/register`, {
        scale_mm_per_pixel: parseFloat(calculatedScale),
        ref_mm: parseFloat(jigValue),
        measured_px: parseFloat(measuredPixels),
        calibrated_by: 'Operator Day Shift',
        is_day_shift: isDayShift
      });

      if (resp.data.ok) {
        onSaveScale(parseFloat(calculatedScale));
        alert(`✓ SUKSES: ${resp.data.message}`);
        onClose();
      }
    } catch (err) {
      alert(`Gagal registrasi skala: ${err.response?.data?.error || err.message}`);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '860px', width: '94%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Target size={20} color="#0284c7" />
            <span>KALIBRASI MASTER JIG (SOP DENSO 3rd FACTORY)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {/* Day Shift Policy Warning Banner */}
          {!isDayShift && (
            <div className="shift-alert-banner" style={{ background: '#fffbeb', borderColor: '#f59e0b', color: '#b45309', marginBottom: '12px' }}>
              <AlertCircle size={18} />
              <span style={{ fontSize: '12.5px' }}>
                <strong>PERHATIAN PERGANTIAN SHIFT:</strong> Berdasarkan standar Denso MM2100, kalibrasi master jig dilakukan 1x sehari pada <strong>Day Shift (pukul 07:00)</strong> sebelum produksi tray dijalankan.
              </span>
            </div>
          )}

          {/* POKAYOKE Alert jika part produk terdeteksi terpasang pada jig */}
          {pokayokeAlert && (
            <div style={{
              background: '#fef2f2',
              border: '2px solid #ef4444',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              color: '#991b1b'
            }}>
              <ShieldAlert size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', marginBottom: '3px' }}>
                  {pokayokeAlert.error}
                </strong>
                <span style={{ fontSize: '12px', color: '#b91c1c' }}>
                  {pokayokeAlert.detail} — <em>Keluarkan housing/part produk terlebih dahulu sebelum registrasi master gauge.</em>
                </span>
              </div>
            </div>
          )}

          {/* Main Layout Sesuai Wireframe Mockup image13.png */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '16px' }}>
            {/* Sisi Kiri: Viewport Citra Jig */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Image Selector Dropdown Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f1f5f9',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1'
              }}>
                <ImageIcon size={16} color="#0284c7" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                  Pilih Citra Jig:
                </span>
                <select
                  value={selectedFileName}
                  onChange={(e) => handleSelectImage(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #94a3b8',
                    background: '#fff',
                    color: '#0f172a',
                    fontWeight: 600
                  }}
                >
                  <option value="3.44.jpg">3.44.jpg (Master Jig Normal — Ruang Kosong)</option>
                  <option value="1.090.jpg">1.090.jpg (⚠️ Demo Pokayoke: Part IC Masih Tertinggal / Nyantol)</option>
                  {availableImages
                    .filter((f) => f.name !== '3.44.jpg' && f.name !== '1.090.jpg')
                    .slice(0, 15)
                    .map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </div>

              <div
                style={{
                  background: '#090e17',
                  border: '2px solid #334155',
                  borderRadius: '8px',
                  height: '320px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isDrawingLine ? 'crosshair' : 'default'
                }}
                onClick={handleCanvasClick}
              >
                {/* Visual Image */}
                <img
                  ref={imgRef}
                  src={jigImageUrl}
                  alt="Master Jig Live View"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.95 }}
                />

                {/* SVG Overlay Garis Tarik Manual Titik A & B */}
                <svg
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                >
                  {points.length === 2 && (
                    <>
                      <line
                        x1={points[0].x}
                        y1={points[0].y}
                        x2={points[1].x}
                        y2={points[1].y}
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                      />
                      <circle cx={points[0].x} cy={points[0].y} r="5" fill="#38bdf8" />
                      <circle cx={points[1].x} cy={points[1].y} r="5" fill="#22c55e" />
                      <text
                        x={(points[0].x + points[1].x) / 2 + 10}
                        y={(points[0].y + points[1].y) / 2 - 10}
                        fill="#38bdf8"
                        fontSize="12"
                        fontWeight="bold"
                      >
                        {measuredPixels} px
                      </text>
                    </>
                  )}
                  {points.length === 1 && (
                    <circle cx={points[0].x} cy={points[0].y} r="5" fill="#38bdf8" />
                  )}
                </svg>

                {/* HUD Overlay Label */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  color: '#38bdf8',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  border: '1px solid #0284c7'
                }}>
                  MASTER JIG VIEWPORT: {selectedFileName}
                </div>

                {isDrawingLine && (
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    background: 'rgba(239, 68, 68, 0.95)',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}>
                    {points.length === 0 ? 'Klik Titik A (Batas Pin Atas/Kiri)' : 'Klik Titik B (Batas Pin Bawah/Kanan)'}
                  </div>
                )}
              </div>

              {/* Tombol Ambil Gambar Bawah - Satu Tombol Alami Sesuai Mockup Denso */}
              <div>
                <button
                  type="button"
                  className="action-btn primary"
                  onClick={handleGetImage}
                  disabled={loading}
                  style={{ width: '100%', height: '40px', fontWeight: 700, fontSize: '13px' }}
                >
                  <Camera size={16} />
                  <span>{loading ? 'Memeriksa & Mengambil Citra...' : `Get Image Jig (${selectedFileName})`}</span>
                </button>
              </div>
            </div>

            {/* Sisi Kanan: Kontrol Kalibrasi Sesuai Mockup image13.png */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Tombol Tarik Garis */}
              <button
                type="button"
                className={`action-btn ${isDrawingLine ? 'primary' : ''}`}
                onClick={() => {
                  setIsDrawingLine(!isDrawingLine);
                  setPoints([]);
                }}
                style={{ width: '100%', justifyContent: 'center', height: '38px', fontWeight: 700 }}
              >
                <Crosshair size={16} />
                <span>{isDrawingLine ? 'Membatalkan Tarik Garis' : 'Tarik Garis (Manual Pin)'}</span>
              </button>

              {/* Masuk Nilai & Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label className="exact-field-label" style={{ marginBottom: '4px' }}>
                    MASUK NILAI PIN (FISIK)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    className="exact-input"
                    value={jigValue}
                    onChange={(e) => {
                      setJigValue(e.target.value);
                      const v = parseFloat(e.target.value);
                      const p = parseFloat(measuredPixels);
                      if (v && p) setCalculatedScale(Number((v / p).toFixed(6)));
                    }}
                  />
                </div>
                <div>
                  <label className="exact-field-label" style={{ marginBottom: '4px' }}>
                    UNIT
                  </label>
                  <input
                    type="text"
                    className="exact-input"
                    value={unit}
                    readOnly
                    style={{ background: '#f1f5f9', textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* Jarak Terukur (Pixel) - Read Only karena hasil ukur sistem */}
              <div>
                <label className="exact-field-label" style={{ marginBottom: '4px' }}>
                  JARAK TERUKUR (PIXEL CITRA) [HASIL SISTEM]
                </label>
                <input
                  type="text"
                  className="exact-input"
                  value={`${measuredPixels} px`}
                  readOnly
                  style={{ background: '#f8fafc', color: '#0284c7', fontWeight: 800, cursor: 'default' }}
                />
                <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginTop: '3px' }}>
                  🔒 Otomatis dihitung sistem dari tarikan garis / kamera (Read-Only)
                </span>
              </div>

              {/* Kotak Value Live Sesuai image13.png */}
              <div style={{
                background: '#f8fafc',
                border: '2px solid #0284c7',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', display: 'block', letterSpacing: '1px' }}>
                  VALUE LIVE (MM / PIXEL)
                </span>
                <span style={{
                  fontSize: '26px',
                  fontWeight: 900,
                  fontFamily: 'var(--font-hud)',
                  color: '#0284c7',
                  display: 'block',
                  margin: '3px 0'
                }}>
                  {calculatedScale}
                </span>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                  Standard Pin Gauge Denso: 0.02185 mm/px
                </span>
              </div>

              {/* Penjelasan Singkat Rumus */}
              <div style={{
                background: '#f0f9ff',
                border: '1px dashed #7dd3fc',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: '#0369a1',
                lineHeight: 1.4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, marginBottom: '2px' }}>
                  <Info size={13} />
                  <span>Rumus Skala Kalibrasi:</span>
                </div>
                <div>Skala = <strong>Nilai Pin (mm)</strong> ÷ <strong>Pixel Terukur</strong></div>
                <div>Contoh: <strong>{jigValue} mm</strong> ÷ <strong>{measuredPixels} px</strong> = <strong>{calculatedScale} mm/px</strong></div>
              </div>

              {statusMsg && (
                <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 600 }}>
                  ✓ {statusMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Sesuai Wireframe: Batal | Register */}
        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="action-btn" onClick={onClose} style={{ minWidth: '90px' }}>
            Batal
          </button>
          <button
            type="button"
            className="action-btn primary"
            onClick={handleRegister}
            disabled={loading || pokayokeAlert != null}
            style={{ minWidth: '130px', fontWeight: 800 }}
          >
            <Save size={14} />
            <span>Register</span>
          </button>
        </div>
      </div>
    </div>
  );
}
