import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Loader2, Image as ImageIcon, Eye, Layers } from 'lucide-react';

export default function ImageViewport({
  rawImageUrl,
  resultImageUrl,
  stationId,
  loading,
  onProcessNext
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);

  function handleZoomIn() {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  }

  function handleZoomOut() {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  }

  function handleResetZoom() {
    setZoomLevel(1);
  }

  // Gunakan resultImageUrl jika overlay aktif dan gambar hasil tersedia, jika tidak gunakan rawImageUrl
  const activeDisplayUrl = (showOverlay && resultImageUrl) ? resultImageUrl : rawImageUrl;

  return (
    <section className="panel-viewport">
      <div className="viewport-canvas-area" style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(9, 14, 23, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#38bdf8',
            zIndex: 10
          }}>
            <Loader2 className="animate-spin" size={36} />
            <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px' }}>
              INFERENSI AI YOLO STASIUN {stationId}...
            </span>
          </div>
        )}

        {/* Overlay Badge Status */}
        {resultImageUrl && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: showOverlay ? 'rgba(2, 132, 199, 0.9)' : 'rgba(30, 41, 59, 0.85)',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: '0.5px',
            zIndex: 5,
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            {showOverlay ? 'AI KEYPOINT OVERLAY (A: PIN IC, B: HOUSING)' : 'RAW X-RAY CAPTURE'}
          </div>
        )}

        {activeDisplayUrl ? (
          <img
            src={activeDisplayUrl}
            alt={`X-Ray Station ${stationId}`}
            className="viewport-img"
            style={{ transform: `scale(${zoomLevel})` }}
            onError={(e) => {
              e.target.onerror = null;
              // Jika resultImageUrl gagal muat, fallback ke rawImageUrl
              if (rawImageUrl && e.target.src !== rawImageUrl) {
                e.target.src = rawImageUrl;
              } else {
                e.target.src = '/hero-login.jpeg';
              }
            }}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#64748b',
            padding: '32px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7'
            }}>
              <ImageIcon size={28} strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.5px' }}>
              TRAY STATUS: STANDBY
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', maxWidth: '320px', lineHeight: '1.5' }}>
              Grid st1 – st18 dalam kondisi standby / menunggu part. Klik tombol <strong>"Run Tray (18 Pocket)"</strong> untuk memulai inspeksi sekuensial.
            </span>
          </div>
        )}
      </div>

      <div className="viewport-controls-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
            Station: st{stationId}
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Zoom: {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        <div className="viewport-btn-group">
          {/* Toggle Tombol Overlay AI vs Raw */}
          {resultImageUrl && (
            <button
              type="button"
              className="viewport-btn"
              onClick={() => setShowOverlay(!showOverlay)}
              style={{
                background: showOverlay ? '#e0f2fe' : '#f1f5f9',
                color: showOverlay ? '#0284c7' : '#475569',
                borderColor: showOverlay ? '#7dd3fc' : '#cbd5e1',
                fontWeight: 700
              }}
              title={showOverlay ? 'Beralih ke citra mentah tanpa anotasi' : 'Tampilkan anotasi keypoint & garis ukur AI'}
            >
              <Layers size={14} />
              <span>{showOverlay ? 'Mode: Anotasi AI' : 'Mode: Citra Asli'}</span>
            </button>
          )}

          <button
            type="button"
            className="viewport-btn"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <ZoomIn size={14} />
            <span>Zoom In</span>
          </button>

          <button
            type="button"
            className="viewport-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
            <span>Zoom Out</span>
          </button>

          <button
            type="button"
            className="viewport-btn"
            onClick={handleResetZoom}
            title="Fit to Screen"
          >
            <Maximize2 size={14} />
            <span>Fit Screen</span>
          </button>
        </div>
      </div>
    </section>
  );
}
