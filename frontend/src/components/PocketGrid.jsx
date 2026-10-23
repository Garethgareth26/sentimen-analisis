import React from 'react';
import { Layers } from 'lucide-react';

export default function PocketGrid({ stations, activeStationId, onSelectStation, scanningStationId }) {
  return (
    <section className="panel-grid18">
      <div className="panel-header-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} color="#0284c7" />
          <span>Tray Stations Grid (15 Pockets)</span>
        </div>
        <span style={{ fontSize: '11px', color: '#64748b' }}>Select to View</span>
      </div>

      <div className="grid-pockets">
        {stations.map((st) => {
          const isActive = st.id === activeStationId;
          const isScanning = scanningStationId === st.id;
          const isNg = st.judge === 'NG';
          const badgeClass = isNg ? 'ng' : (st.judge === 'OK' ? 'ok' : 'idle');
          const badgeText = isScanning ? 'SCAN' : (st.judge || '-');

          return (
            <div
              key={st.id}
              className={`pocket-card ${isActive ? 'active' : ''} ${isNg ? 'ng-border' : ''} ${isScanning ? 'scanning' : ''}`}
              onClick={() => onSelectStation(st.id)}
            >
              <div className="pocket-header-row">
                <span className="pocket-st-num">st{st.id}</span>
                <span className={`pocket-judge-badge ${badgeClass}`}>
                  {badgeText}
                </span>
              </div>

              <div className="pocket-value" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{st.value != null ? `${Number(st.value).toFixed(3)} mm` : '-'}</span>
                {st.ctSec != null && st.ctSec > 0 && (
                  <span style={{
                    fontSize: '10px',
                    color: st.ctSec <= 1.2 ? '#059669' : '#dc2626',
                    fontWeight: 700,
                    background: st.ctSec <= 1.2 ? '#ecfdf5' : '#fef2f2',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    border: `1px solid ${st.ctSec <= 1.2 ? '#a7f3d0' : '#fecaca'}`
                  }}>
                    {Number(st.ctSec).toFixed(2)}s
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
