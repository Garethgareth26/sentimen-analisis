import React from 'react';
import { Target, FileText, CheckCircle2, XCircle, Clock, Zap, Tag, Play, Loader2, RotateCcw, FlaskConical } from 'lucide-react';

export default function RibbonBar({
  shiftInfo,
  metrics,
  trayMode = 'live',
  onToggleTrayMode,
  onOpenCalibration,
  onOpenHistory,
  onOpenDandori,
  onStartTrayScan,
  onResetTray,
  scanningTray,
  scanningStationId,
  activeView = 'dashboard',
  onToggleView
}) {
  const isDay = shiftInfo?.isDayShift ?? true;
  const total = metrics?.totalProduct || 0;
  const okQty = metrics?.okQty || 0;
  const ngQty = metrics?.ngQty || 0;
  const okRatio = total > 0 ? ((okQty / total) * 100).toFixed(1) : '100.0';
  const ngRatio = total > 0 ? ((ngQty / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="ribbon-bar">
      {/* Tombol Navigasi Cepat & Pemicu Tray */}
      <div className="ribbon-nav-group">
        {/* Tombol Beralih Mode: LIVE (Terkini dari Kamera) vs DEMO (Simulasi Acak) */}
        <button
          type="button"
          className="ribbon-btn"
          onClick={onToggleTrayMode}
          disabled={scanningTray}
          style={{
            background: trayMode === 'live' ? '#ecfdf5' : '#fefce8',
            color: trayMode === 'live' ? '#047857' : '#b45309',
            borderColor: trayMode === 'live' ? '#6ee7b7' : '#fde68a',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title={`Mode Saat Ini: ${trayMode === 'live' ? 'LIVE (Baca 16 Frame Terkini dari Kamera)' : 'DEMO (Simulasi Acak Dataset)'}. Klik untuk beralih mode.`}
        >
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: trayMode === 'live' ? '#10b981' : '#f59e0b',
            boxShadow: trayMode === 'live' ? '0 0 6px #10b981' : 'none'
          }} />
          <span>{trayMode === 'live' ? 'LIVE (Terkini)' : 'DEMO (Acak)'}</span>
        </button>

        <button
          type="button"
          className="ribbon-btn"
          onClick={onStartTrayScan}
          disabled={scanningTray}
          style={{
            background: scanningTray
              ? '#0369a1'
              : (trayMode === 'live' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'),
            color: '#ffffff',
            borderColor: trayMode === 'live' ? '#059669' : '#0284c7',
            fontWeight: 800,
            boxShadow: trayMode === 'live' ? '0 2px 8px rgba(5, 150, 105, 0.35)' : '0 2px 8px rgba(2, 132, 199, 0.35)'
          }}
          title={trayMode === 'live' ? 'Jalankan Inspeksi AI untuk 16 Frame Terbaru dari Kamera' : 'Jalankan Inspeksi AI untuk 1 Tray Simulasi (15 Pocket)'}
        >
          {scanningTray ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="#fff" />}
          <span>{scanningTray ? `Scanning st${scanningStationId || '...'}/15...` : (trayMode === 'live' ? 'Run Live Tray (Capture)' : 'Run Demo Tray (15 Pocket)')}</span>
        </button>

        <button
          type="button"
          className="ribbon-btn"
          onClick={onResetTray}
          disabled={scanningTray}
          style={{ background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' }}
          title="Kosongkan Grid Tray (Status Standby untuk Tray Baru)"
        >
          <RotateCcw size={15} />
          <span>New Tray (Reset)</span>
        </button>

        <button
          type="button"
          className="ribbon-btn primary"
          onClick={onOpenCalibration}
          title={isDay ? 'Kalibrasi Master Jig (Day Shift)' : 'Kalibrasi hanya tersedia pada Day Shift'}
        >
          <Target size={16} />
          <span>Calibration</span>
        </button>

        <button
          type="button"
          className="ribbon-btn"
          onClick={onOpenDandori}
          title="Dandori / Changeover P/N via QR Kanban"
          style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}
        >
          <Tag size={15} />
          <span>Dandori (Kanban)</span>
        </button>

        <button
          type="button"
          className="ribbon-btn secondary"
          onClick={onOpenHistory}
        >
          <FileText size={16} />
          <span>History</span>
        </button>

        <button
          type="button"
          className="ribbon-btn"
          onClick={onToggleView}
          style={{
            background: activeView === 'over_reject' ? '#15803d' : '#ecfdf5',
            color: activeView === 'over_reject' ? '#ffffff' : '#047857',
            borderColor: '#10b981',
            fontWeight: 800,
            boxShadow: activeView === 'over_reject' ? '0 2px 8px rgba(21, 128, 61, 0.35)' : 'none'
          }}
          title="Uji Foto Satu per Satu & Evaluasi Over-Reject (< 3%)"
        >
          <FlaskConical size={15} />
          <span>{activeView === 'over_reject' ? 'Dashboard Tray' : 'Uji Single Foto'}</span>
        </button>
      </div>

      {/* KPI Cards Ringkasan Produksi */}
      <div className="kpi-cards-group">
        {/* Total Product */}
        <div className="kpi-card">
          <span className="kpi-label">Total Product</span>
          <span className="kpi-value">{total}</span>
          <span className="kpi-sub">Reset @ 07:00</span>
        </div>

        {/* OK Qty */}
        <div className="kpi-card ok">
          <span className="kpi-label">OK Qty</span>
          <span className="kpi-value">{okQty}</span>
          <span className="kpi-sub">Ratio: {okRatio}%</span>
        </div>

        {/* NG Qty */}
        <div className="kpi-card ng">
          <span className="kpi-label">NG Qty</span>
          <span className="kpi-value">{ngQty}</span>
          <span className="kpi-sub">Ratio: {ngRatio}%</span>
        </div>

        {/* CT Target vs Actual */}
        {(() => {
          const actual = metrics?.actualCtSec || 0;
          const target = metrics?.targetCtSec ?? 1.2;
          const isCtOk = actual > 0 ? actual <= target : true;
          return (
            <div className={`kpi-card ct ${actual > 0 ? (isCtOk ? 'ok' : 'ng') : ''}`}>
              <span className="kpi-label">Cycle Time</span>
              <span className="kpi-value" style={{ color: actual > 0 ? (isCtOk ? '#16a34a' : '#dc2626') : '#0f172a' }}>
                {actual > 0 ? `${actual}s` : '0.00s'} <span style={{ fontSize: '11px', color: '#64748b' }}>/ {target}s</span>
              </span>
              <span className="kpi-sub" style={{ color: actual > 0 ? (isCtOk ? '#15803d' : '#b91c1c') : '#64748b' }}>
                {actual > 0 ? (isCtOk ? 'Target < 1.2s (OK)' : 'Exceeded Target') : 'Target < 1.2s'}
              </span>
            </div>
          );
        })()}

        {/* Loss Time */}
        <div className="kpi-card">
          <span className="kpi-label">Loss Time</span>
          <span className="kpi-value">{metrics?.lossTimeSec ?? 0}s</span>
          <span className="kpi-sub">Interlock wait</span>
        </div>
      </div>
    </div>
  );
}
