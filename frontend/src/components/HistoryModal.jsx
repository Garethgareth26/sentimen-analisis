import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Download,
  Send,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  X,
  ExternalLink,
  Eye,
  Server,
  HardDrive,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  Check
} from 'lucide-react';

import { API } from '../apiConfig.js';
const api = axios.create({ baseURL: API, timeout: 60_000, withCredentials: true });

export default function HistoryModal({ isOpen, onClose, currentUser }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [availableDates, setAvailableDates] = useState([]);
  const [judgmentFilter, setJudgmentFilter] = useState('all');
  const [stationFilter, setStationFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logsData, setLogsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // State Transfer QC Server
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [targetServerPath, setTargetServerPath] = useState('C:\\QC_Server_Backup\\XRay_History');

  // Load available dates
  useEffect(() => {
    if (!isOpen) return;

    async function fetchDates() {
      try {
        const resp = await api.get('/api/history/dates');
        if (resp.data.ok) {
          setAvailableDates(resp.data.dates || []);
        }
      } catch (err) {
        console.warn('Gagal memuat daftar tanggal history:', err);
      }
    }

    fetchDates();
  }, [isOpen]);

  // Load logs when filter changes
  useEffect(() => {
    if (!isOpen) return;

    fetchLogs();
  }, [isOpen, selectedDate, judgmentFilter, stationFilter, searchQuery]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const resp = await api.get('/api/history', {
        params: {
          date: selectedDate,
          judgment: judgmentFilter,
          station: stationFilter,
          search: searchQuery,
          limit: 200
        }
      });
      if (resp.data.ok) {
        setLogsData(resp.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data history:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadCsv() {
    const url = `${API}/api/history/download?date=${encodeURIComponent(selectedDate)}`;
    window.open(url, '_blank');
  }

  async function handleExecuteTransfer() {
    setTransferring(true);
    setTransferResult(null);
    try {
      const resp = await api.post('/api/history/transfer', {
        date: selectedDate,
        targetPath: targetServerPath,
        includeImages: true
      });
      if (resp.data.ok) {
        setTransferResult(resp.data.result);
      }
    } catch (err) {
      alert(`Transfer ke server gagal: ${err.response?.data?.error || err.message}`);
    } finally {
      setTransferring(false);
    }
  }

  if (!isOpen) return null;

  const summary = logsData?.summary || { total: 0, okQty: 0, ngQty: 0, okRatio: '100.0', ngRatio: '0.0' };
  const records = logsData?.records || [];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-dialog"
        style={{
          width: '94vw',
          maxWidth: '1240px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. MODAL HEADER ──────────────────────────────────────────────── */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Log Riwayat Inspeksi Harian &amp; Traceability
                </h2>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#e0f2fe',
                    color: '#0369a1'
                  }}
                >
                  Denso DX Vol. 3
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Format CSV Harian (1 File/Hari: {logsData?.fileName || 'YYYYMMDD_denso_inspection.csv'}) • Backup Server QC/PED
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              padding: '8px',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── 2. KPI SUMMARY BAR ───────────────────────────────────────────── */}
        <div
          style={{
            padding: '12px 24px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px'
          }}
        >
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>TOTAL INSPEKSI</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{summary.total}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Pocket Terinspeksi</span>
          </div>

          <div style={{ padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
            <span style={{ fontSize: '11px', color: '#047857', fontWeight: 600, display: 'block' }}>TOTAL OK</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>{summary.okQty}</span>
            <span style={{ fontSize: '10px', color: '#059669', display: 'block' }}>Ratio: {summary.okRatio}%</span>
          </div>

          <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600, display: 'block' }}>TOTAL NG</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>{summary.ngQty}</span>
            <span style={{ fontSize: '10px', color: '#dc2626', display: 'block' }}>Ratio: {summary.ngRatio}%</span>
          </div>

          <div style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, display: 'block' }}>FILE AKTIF</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', marginTop: '4px' }}>
              {logsData?.fileName || `${selectedDate.replace(/-/g, '')}_denso_inspection.csv`}
            </span>
            <span style={{ fontSize: '10px', color: '#0284c7', display: 'block' }}>CSV Standard Denso</span>
          </div>

          <div style={{ padding: '8px 12px', background: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
            <span style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 600, display: 'block' }}>OPERATOR / SHIFT</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b21a8', display: 'block', marginTop: '2px' }}>
              {currentUser?.name || 'Budi Santoso'}
            </span>
            <span style={{ fontSize: '10px', color: '#7e22ce', display: 'block' }}>NPK: {currentUser?.npk || '1092'}</span>
          </div>
        </div>

        {/* ── 3. TOOLBAR & CONTROLS ────────────────────────────────────────── */}
        <div
          style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          {/* Sisi Kiri: Filter Tanggal, Judge, Stasiun & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Date Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="#64748b" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1e293b'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  setSelectedDate(`${yyyy}-${mm}-${dd}`);
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                Hari Ini
              </button>
            </div>

            {/* Judgment Filter */}
            <div style={{ display: 'flex', background: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
              {[
                { id: 'all', label: 'Semua' },
                { id: 'ok', label: 'OK Only' },
                { id: 'ng', label: 'NG Only' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setJudgmentFilter(tab.id)}
                  style={{
                    padding: '4px 10px',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: judgmentFilter === tab.id ? '#ffffff' : 'transparent',
                    color: judgmentFilter === tab.id ? (tab.id === 'ng' ? '#dc2626' : (tab.id === 'ok' ? '#059669' : '#0f172a')) : '#64748b',
                    boxShadow: judgmentFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Station Filter */}
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1e293b',
                background: '#ffffff'
              }}
            >
              <option value="all">Semua Stasiun (1-18)</option>
              {Array.from({ length: 18 }, (_, i) => (
                <option key={i + 1} value={`st${i + 1}`}>
                  Stasiun st{i + 1}
                </option>
              ))}
            </select>

            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Cari NPK, Part, Seq..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '5px 8px 5px 28px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  width: '160px'
                }}
              />
            </div>
          </div>

          {/* Sisi Kanan: Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              title="Muat ulang data"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569'
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #0284c7',
                background: '#0284c7',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
              }}
            >
              <Download size={14} />
              <span>Download CSV Harian</span>
            </button>

            <button
              type="button"
              onClick={() => setTransferDialogOpen(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #059669',
                background: '#059669',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
              }}
            >
              <Server size={14} />
              <span>Transfer ke Server QC/PED</span>
            </button>
          </div>
        </div>

        {/* ── 4. TABEL RIWAYAT INSPEKSI ────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
          {records.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
              <Layers size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#64748b' }}>
                Tidak ada data inspeksi pada filter yang dipilih.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                Silakan pilih tanggal lain atau jalankan inspeksi tray di Dashboard.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 8px', width: '36px' }}>No</th>
                  <th style={{ padding: '10px 8px' }}>Waktu</th>
                  <th style={{ padding: '10px 8px' }}>Tray ID / Seq</th>
                  <th style={{ padding: '10px 8px' }}>Stasiun</th>
                  <th style={{ padding: '10px 8px' }}>Part Number</th>
                  <th style={{ padding: '10px 8px' }}>Operator</th>
                  <th style={{ padding: '10px 8px' }}>Dimensi (mm)</th>
                  <th style={{ padding: '10px 8px' }}>Judgement</th>
                  <th style={{ padding: '10px 8px' }}>Metode</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Citra</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row, idx) => {
                  const isOk = row.judgment === 'OK';
                  return (
                    <tr
                      key={row.id || idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        transition: 'background 0.15s'
                      }}
                    >
                      <td style={{ padding: '8px', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#1e293b' }}>{row.time || '-'}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', color: '#0369a1', fontWeight: 600 }}>
                        {row.sequence}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#0f172a' }}>
                        <span style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px' }}>
                          {row.station}
                        </span>
                      </td>
                      <td style={{ padding: '8px', color: '#334155' }}>{row.partNumber}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{row.operatorName}</span>{' '}
                        <span style={{ fontSize: '10px', color: '#64748b' }}>({row.npk})</span>
                      </td>
                      <td style={{ padding: '8px', fontWeight: 800, fontSize: '13px', color: isOk ? '#0f172a' : '#dc2626' }}>
                        {row.dimension.toFixed(3)} mm
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: isOk ? '#dcfce7' : '#fee2e2',
                            color: isOk ? '#15803d' : '#b91c1c'
                          }}
                        >
                          {isOk ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {row.judgment}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: row.method === 'manual_measurement' ? '#fef3c7' : '#e0f2fe',
                            color: row.method === 'manual_measurement' ? '#b45309' : '#0369a1'
                          }}
                        >
                          {row.method === 'manual_measurement' ? 'Manual Measure' : 'AI YOLO'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {row.imageLink ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(row.imageLink)}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#0284c7',
                              fontWeight: 600
                            }}
                          >
                            <Eye size={12} />
                            <span>Preview</span>
                          </button>
                        ) : (
                          <span style={{ color: '#cbd5e1' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 5. MODAL PREVIEW CITRA INSPEKSI ──────────────────────────────── */}
        {previewImage && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setPreviewImage(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                overflow: 'hidden',
                maxWidth: '850px',
                width: '100%',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  Citra Hasil Inspeksi Denso X-Ray
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ padding: '12px', background: '#000000', textAlign: 'center' }}>
                <img
                  src={`${API}${previewImage}`}
                  alt="Inspection Result"
                  style={{ maxHeight: '65vh', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── 6. DIALOG TRANSFER KE SERVER QC/PED (Fitur 7) ─────────────────── */}
        {transferDialogOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setTransferDialogOpen(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '520px',
                padding: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '8px', background: '#ecfdf5', borderRadius: '8px', color: '#059669' }}>
                  <Server size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    Transfer Data ke Server QC/PED (Fitur 7)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Sinkronisasi berkas CSV dan citra inspeksi tanggal {selectedDate}
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  TARGET PC SERVER / FOLDER NETWORK
                </label>
                <input
                  type="text"
                  value={targetServerPath}
                  onChange={(e) => setTargetServerPath(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                  Folder tujuan di jaringan pabrik Denso (misal: C:\QC_Server_Backup\XRay_History atau \\192.168.1.100\qc_share)
                </span>
              </div>

              {transferResult && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#166534'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <Check size={16} />
                    <span>{transferResult.message}</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '11px' }}>
                    • File CSV Ditransfer: {transferResult.csvTransferred} file<br />
                    • Citra Ditransfer: {transferResult.imagesTransferred} file<br />
                    • Timestamp: {new Date(transferResult.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setTransferDialogOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b'
                  }}
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={handleExecuteTransfer}
                  disabled={transferring}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  {transferring ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{transferring ? 'Mentransfer...' : 'Mulai Sinkronisasi'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
