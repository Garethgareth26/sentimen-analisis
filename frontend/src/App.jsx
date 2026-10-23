import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './style.css';

// Import Komponen Denso Modular
import LoginPage from './components/LoginPage';
import HeaderBar from './components/HeaderBar';
import RibbonBar from './components/RibbonBar';
import PocketGrid from './components/PocketGrid';
import ImageViewport from './components/ImageViewport';
import ControlPanel from './components/ControlPanel';
import QrScanModal from './components/QrScanModal';
import SettingsModal from './components/SettingsModal';
import CalibrationModal from './components/CalibrationModal';
import AlarmInterlockModal from './components/AlarmInterlockModal';
import ShiftChangeAlert from './components/ShiftChangeAlert';
import HistoryModal from './components/HistoryModal';
import OverRejectTestPage from './components/OverRejectTestPage';

import { API } from './apiConfig.js';
const api = axios.create({ baseURL: API, timeout: 180_000, withCredentials: true });

export default function App() {
  // ─── 0. View Mode (Dashboard Tray vs Evaluasi Over-Reject Single Test) ──────
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'over_reject'

  // ─── 1. State Autentikasi & Shift ──────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [shiftInfo, setShiftInfo] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [shiftAlertOpen, setShiftAlertOpen] = useState(false);
  const [targetShiftName, setTargetShiftName] = useState('');

  // ─── 2. State Data Sistem & Gambar ────────────────────────────────────────
  const [images, setImages] = useState([]);
  const [settings, setSettings] = useState(null);
  const [sidecarReady, setSidecarReady] = useState(false);
  const [inferencing, setInferencing] = useState(false);
  const [scanningTray, setScanningTray] = useState(false);
  const [activePart, setActivePart] = useState({
    part_number: 'DN-XRAY-42890-A',
    part_name: 'Fuel Rail IC Housing (Standard)',
    min_distance_mm: 0.7,
    max_distance_mm: 1.7,
    jig_offset_mm: 0.063,
    ct_target_sec: 1.2
  });

  // ─── 3. State Grid 15 Stasiun Aktual (Standby Awal: Kosong / Menunggu Tray) ──
  const EMPTY_STATIONS = Array.from({ length: 15 }, (_, idx) => ({
    id: idx + 1,
    station: `st${idx + 1}`,
    judge: null,
    value: null,
    image: null,
    resultImage: null
  }));

  const [activeStationId, setActiveStationId] = useState(1);
  const [stations, setStations] = useState(EMPTY_STATIONS);
  const [scanningStationId, setScanningStationId] = useState(null);

  // ─── 4. Production Metrics ────────────────────────────────────────────────
  const [metrics, setMetrics] = useState({
    totalProduct: 0,
    okQty: 0,
    ngQty: 0,
    lossTimeSec: 0,
    targetCtSec: 1.2,
    actualCtSec: 0
  });

  // ─── 5. State Modal ───────────────────────────────────────────────────────
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalMode, setQrModalMode] = useState('login');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [calibModalOpen, setCalibModalOpen] = useState(false);
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [alarmStation, setAlarmStation] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [trayMode, setTrayMode] = useState('live');

  // Ambil mode tray tersimpan (live | demo) dari server
  useEffect(() => {
    api.get('/api/tray/mode')
      .then((res) => {
        if (res.data.ok && res.data.mode) {
          setTrayMode(res.data.mode);
        }
      })
      .catch(() => {});
  }, []);

  async function handleToggleTrayMode() {
    const nextMode = trayMode === 'live' ? 'demo' : 'live';
    setTrayMode(nextMode);
    try {
      await api.post('/api/tray/mode', { mode: nextMode });
    } catch (err) {
      console.warn('Gagal mengubah mode tray:', err);
    }
  }

  // ─── 6. Inisialisasi Auth & Periksa Sesi (HttpOnly Cookie & Fallback) ──────
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const resp = await api.get('/api/auth/me');
        if (resp.data.ok) {
          setCurrentUser(resp.data.user);
          setShiftInfo(resp.data.shiftInfo);
        } else {
          handleLogout();
        }
      } catch (err) {
        // Fallback jika cookie belum diset tapi token ada di local storage
        const savedToken = localStorage.getItem('denso_xray_token');
        if (savedToken) {
          try {
            const resp = await api.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${savedToken}` }
            });
            if (resp.data.ok) {
              setCurrentUser(resp.data.user);
              setShiftInfo(resp.data.shiftInfo);
            } else {
              handleLogout();
            }
          } catch (_) {
            handleLogout();
          }
        } else {
          setCurrentUser(null);
        }
      } finally {
        setAuthChecking(false);
      }
    }

    checkAuthSession();
  }, []);

  // ─── 7. Load Data Backend (Settings, Images, Sidecar, Active Part & Tray) ──
  useEffect(() => {
    async function loadData() {
      try {
        const [imgsRes, cfgRes, sideRes, partRes, trayRes] = await Promise.all([
          api.get('/api/images').catch(() => ({ data: { files: [] } })),
          api.get('/api/settings').catch(() => ({ data: {} })),
          api.get('/api/sidecar-status').catch(() => ({ data: { ready: false } })),
          api.get('/api/dandori/current').catch(() => ({ data: { activePart: null } })),
          api.get('/api/tray/current').catch(() => ({ data: { data: null } })),
        ]);
        setImages(imgsRes.data.files || []);
        setSettings(cfgRes.data || {});
        setSidecarReady(sideRes.data.ready || false);
        if (partRes.data?.activePart) {
          setActivePart(partRes.data.activePart);
        }
        if (trayRes.data?.data) {
          if (trayRes.data.data.metrics) {
            setMetrics(trayRes.data.data.metrics);
          }
          if (trayRes.data.data.stations && trayRes.data.data.stations.length > 0) {
            setStations(trayRes.data.data.stations);
          }
        }
      } catch (err) {
        console.warn('Error loading backend data:', err);
      }
    }

    loadData();
  }, []);

  // ─── 8. Real-time Shift Monitor & Auto-Logout Trigger ────────────────────
  useEffect(() => {
    const shiftInterval = setInterval(async () => {
      try {
        const resp = await api.get('/api/auth/shift-status');
        if (resp.data.ok) {
          const newShiftInfo = resp.data;
          
          // Deteksi pergantian shift jika user sedang login
          if (shiftInfo && currentUser) {
            if (shiftInfo.currentShift !== newShiftInfo.currentShift) {
              // Trigger Auto-Logout Pergantian Shift (Pukul 07:00 / 20:30)
              setTargetShiftName(newShiftInfo.currentShift);
              setShiftAlertOpen(true);
            }
          }
          setShiftInfo(newShiftInfo);
        }
      } catch (_) {}
    }, 5000); // Poll status shift setiap 5 detik

    return () => clearInterval(shiftInterval);
  }, [shiftInfo, currentUser]);

  // ─── 9. Handler Aksi Autentikasi ──────────────────────────────────────────
  function handleLoginSuccess(user, token, shift) {
    setCurrentUser(user);
    setAuthToken(token);
    setShiftInfo(shift);
    localStorage.setItem('denso_xray_token', token);
    localStorage.setItem('denso_xray_user', JSON.stringify(user));
  }

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {}
    localStorage.removeItem('denso_xray_token');
    localStorage.removeItem('denso_xray_user');
    setCurrentUser(null);
    setAuthToken(null);
    setShiftAlertOpen(false);
  }

  // ─── 10. Handler QR Scanner ──────────────────────────────────────────────
  async function handleQrScanned(qrData) {
    if (qrModalMode === 'login') {
      try {
        const resp = await api.post('/api/auth/qr-login', { qrCode: qrData });
        if (resp.data.ok) {
          handleLoginSuccess(resp.data.user, resp.data.token, resp.data.shiftInfo);
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Gagal login via Barcode ID Card');
      }
    } else if (qrModalMode === 'leader_reset') {
      // Leader Reset NG Interlock
      handleLeaderResetSuccess();
    } else if (qrModalMode === 'kanban' || qrModalMode === 'dandori') {
      try {
        const resp = await api.post('/api/dandori/changeover', { qrCode: qrData });
        if (resp.data.ok) {
          setActivePart(resp.data.activePart);
          if (resp.data.settings) {
            setSettings(resp.data.settings);
          }
          alert(`✓ ${resp.data.message}`);
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Gagal Dandori Part Number via QR Kanban');
      }
    }
  }

  // ─── 11. Stasiun Aktif & Image URL ───────────────────────────────────────
  const activeStation = stations.find((s) => s.id === activeStationId) || stations[0];
  const activeImageUrl = activeStation?.image ? `${API}/input/${encodeURIComponent(activeStation.image)}` : '';
  const activeResultImageUrl = activeStation?.resultImage ? `${API}/output/${encodeURIComponent(activeStation.resultImage)}` : '';

  // ─── 12. Handler Navigasi & Operasional ────────────────────────────────────
  function handleSelectStation(id) {
    setActiveStationId(id);
    const target = stations.find((s) => s.id === id);
    if (target?.judge === 'NG') {
      setAlarmStation(target);
      setAlarmModalOpen(true);
      api.post('/api/alarm/trigger', {
        stationId: target.id,
        measuredValue: target.value || 0,
        fileName: target.image
      }).catch(() => {});
    }
  }

  function handlePrevStation() {
    setActiveStationId((prev) => (prev > 1 ? prev - 1 : 15));
  }

  function handleNextStation() {
    setActiveStationId((prev) => (prev < 15 ? prev + 1 : 1));
  }

  // ─── Keyboard Shortcut Handler (< / > / Arrow Keys) ──────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      if (e.key === '<' || e.key === ',' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStation();
      } else if (e.key === '>' || e.key === '.' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextStation();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleRecheck() {
    setInferencing(true);
    try {
      if (activeStation?.image) {
        const resp = await api.post('/api/tray/station', {
          stationId: activeStationId,
          fileName: activeStation.image,
          force: true
        });

        if (resp.data.ok) {
          const updated = resp.data.data;
          setStations((prev) => {
            const nextList = prev.map((st) => (
              st.id === activeStationId ? {
                ...st,
                value: updated.value,
                judge: updated.judge,
                resultImage: updated.resultImage
              } : st
            ));

            // Jika status stasiun menjadi OK, cek apakah masih ada stasiun NG lain di tray
            if (updated.judge === 'OK') {
              const remainingNgs = nextList.filter((s) => s.judge === 'NG');
              if (remainingNgs.length === 0) {
                setAlarmStation(null);
                setAlarmModalOpen(false);
              } else {
                setAlarmStation(remainingNgs[0]);
              }
            }

            return nextList;
          });

          if (updated.metrics || resp.data.metrics) {
            setMetrics(updated.metrics || resp.data.metrics);
          }
        }
      }
    } catch (err) {
      console.warn('Recheck error:', err);
    } finally {
      setInferencing(false);
    }
  }

  async function handleStartTrayScan() {
    if (scanningTray) return;
    setScanningTray(true);

    try {
      // 1. Ambil 15/16 gambar berikutnya sesuai mode aktif (LIVE = 16 frame terbaru, DEMO = 15 dataset)
      const seqResp = await api.get(`/api/tray/next-sequence?mode=${trayMode}`);
      if (!seqResp.data.ok) throw new Error('Gagal mengambil sekuens tray dari sistem');

      const { trayId, sequence } = seqResp.data;
      const actualPartSeq = sequence.slice(0, 15);

      // 2. Siapkan 15 stasiun di grid dengan gambar yang akan diproses
      const initialBatch = actualPartSeq.map((imgFile, idx) => ({
        id: idx + 1,
        station: `st${idx + 1}`,
        image: imgFile,
        resultImage: null,
        value: null,
        judge: null,
        method: null,
        ctSec: 0
      }));
      setStations(initialBatch);
      setActiveStationId(1);

      const processedStations = [];

      // 3. Proses inferensi AI YOLO secara RIIL saku demi saku (st1 s/d st15)
      for (let i = 0; i < actualPartSeq.length; i++) {
        const fileName = actualPartSeq[i];
        const stationId = i + 1;

        // Pindahkan stasiun aktif & indikator scanning SEBELUM request dikirim ke AI
        setActiveStationId(stationId);
        setScanningStationId(stationId);

        try {
          const stationResp = await api.post('/api/tray/station', {
            stationId,
            fileName,
            force: true
          });

          if (stationResp.data.ok) {
            const inspected = stationResp.data.data;
            processedStations.push(inspected);
            setStations((prev) => prev.map((s) => (s.id === stationId ? inspected : s)));
            setActiveStationId(stationId);

            // Update live metrics real-time di RibbonBar agar operator langsung melihat CT aktual berjalan
            if (inspected.ctSec) {
              const runningAvg = processedStations.reduce((acc, cur) => acc + (cur.ctSec || 0.9), 0) / processedStations.length;
              setMetrics((prev) => ({
                ...prev,
                actualCtSec: Number(runningAvg.toFixed(3))
              }));
            }
          }
        } catch (sErr) {
          console.warn(`Gagal memproses st${stationId} (${fileName}):`, sErr);
          const fallback = {
            id: stationId,
            station: `st${stationId}`,
            image: fileName,
            resultImage: null,
            value: 0.0,
            judge: 'NG',
            method: 'error_unreadable',
            ctSec: 0.08
          };
          processedStations.push(fallback);
          setStations((prev) => prev.map((s) => (s.id === stationId ? fallback : s)));
          setActiveStationId(stationId);
        }
      }

      // Deteksi & Tangani Frame ke-16 (Frame Kosong/Blur penanda reset tray rotary)
      if (sequence.length >= 16) {
        console.log(`[Tray] Frame ke-16 (${sequence[15]}) terdeteksi sebagai sinyal reset visual. Di-ignore dari evaluasi AI.`);
      }

      setScanningStationId(null);

      // 4. Selesaikan batch tray: simpan log ke CSV harian & perbarui KPI kumulatif
      const finishResp = await api.post('/api/tray/finish-batch', {
        trayId,
        stations: processedStations
      });

      if (finishResp.data.ok && finishResp.data.metrics) {
        setMetrics(finishResp.data.metrics);
      }

      // 5. Cek apakah ada stasiun NG untuk POKAYOKE Interlock & fokuskan viewport
      const firstNg = processedStations.find((s) => s.judge === 'NG');
      if (firstNg) {
        // Berikan jeda sejenak (700ms) agar operator sempat melihat st15 selesai di viewport
        // sebelum interlock alarm otomatis mengunci layar dan menunjuk stasiun NG pertama
        setTimeout(() => {
          setActiveStationId(firstNg.id);
          setAlarmStation(firstNg);
          setAlarmModalOpen(true);
        }, 700);
        api.post('/api/alarm/trigger', {
          stationId: firstNg.id,
          measuredValue: firstNg.value || 0,
          fileName: firstNg.image
        }).catch(() => {});
      }
    } catch (err) {
      alert(`Gagal memproses Tray: ${err.response?.data?.error || err.message}`);
    } finally {
      setScanningTray(false);
      setScanningStationId(null);
    }
  }

  async function handleResetTray() {
    setStations(EMPTY_STATIONS);
    setActiveStationId(1);
    setAlarmStation(null);
    setAlarmModalOpen(false);
    try {
      const resp = await api.post('/api/tray/reset');
      if (resp.data.ok && resp.data.data?.metrics) {
        setMetrics(resp.data.data.metrics);
      }
    } catch (_) {}
  }

  function handleLeaderResetSuccess() {
    setAlarmModalOpen(false);
    setAlarmStation(null);
    alert('Interlock POKAYOKE berhasil dilepaskan oleh Leader. Mesin siap beroperasi.');
  }

  async function handleSaveSettings(newCfg) {
    try {
      const resp = await api.post('/api/settings', newCfg);
      const updated = resp.data?.settings || newCfg;
      setSettings(updated);
      if (resp.data?.activePart) {
        setActivePart(resp.data.activePart);
      } else if (newCfg.standard) {
        setActivePart((prev) => ({
          ...prev,
          min_distance_mm: Number(newCfg.standard.min_distance_mm),
          max_distance_mm: Number(newCfg.standard.max_distance_mm)
        }));
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  }

  // ─── 13. Tampilan Loading Awal ─────────────────────────────────────────────
  if (authChecking) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#eef4f9',
        fontFamily: 'var(--font-hud)',
        fontSize: '18px',
        color: '#0284c7'
      }}>
        MEMUAT SISTEM AI INSPEKSI DENSO...
      </div>
    );
  }

  // ─── 14. Jika Belum Login: Tampilkan Halaman Login Modern ──────────────────
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onOpenQrScanner={() => {
            setQrModalMode('login');
            setQrModalOpen(true);
          }}
        />

        <QrScanModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          onScanSuccess={handleQrScanned}
          mode={qrModalMode}
          title="Scan Barcode ID Card Operator"
        />
      </>
    );
  }

  // ─── 15. Tampilan Dashboard Utama Denso (Image 11 Mockup) ─────────────────
  return (
    <div className="dashboard-root">
      {/* A. Header Bar Status Atas */}
      <HeaderBar
        user={currentUser}
        shiftInfo={shiftInfo}
        partNumber={activePart?.part_number || 'DN-XRAY-42890-A'}
        onOpenDandori={() => {
          setQrModalMode('kanban');
          setQrModalOpen(true);
        }}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* B. Ribbon Bar KPI & Aksi Cepat */}
      <RibbonBar
        shiftInfo={shiftInfo}
        metrics={metrics}
        trayMode={trayMode}
        onToggleTrayMode={handleToggleTrayMode}
        onOpenCalibration={() => setCalibModalOpen(true)}
        onOpenDandori={() => {
          setQrModalMode('kanban');
          setQrModalOpen(true);
        }}
        onOpenHistory={() => setHistoryModalOpen(true)}
        onStartTrayScan={handleStartTrayScan}
        onResetTray={handleResetTray}
        scanningTray={scanningTray}
        scanningStationId={scanningStationId}
        activeView={activeView}
        onToggleView={() => setActiveView((prev) => (prev === 'over_reject' ? 'dashboard' : 'over_reject'))}
      />

      {/* C. Konten Utama: Dashboard Tray Rotary ATAU Halaman Evaluasi Over-Reject */}
      {activeView === 'over_reject' ? (
        <OverRejectTestPage
          onBackToDashboard={() => setActiveView('dashboard')}
          activePart={activePart}
          settings={settings}
          currentUser={currentUser}
        />
      ) : (
        <main className="dashboard-body">
          {/* Kolom 1: Tray Grid 18 Stasiun */}
          <PocketGrid
            stations={stations}
            activeStationId={activeStationId}
            onSelectStation={handleSelectStation}
            scanningStationId={scanningStationId}
          />

          {/* Kolom 2: Area Viewport Citra Inspeksi Tengah */}
          <ImageViewport
            rawImageUrl={activeImageUrl}
            resultImageUrl={activeResultImageUrl}
            stationId={activeStationId}
            loading={inferencing || (scanningTray && scanningStationId === activeStationId)}
            onProcessNext={handleNextStation}
          />

          {/* Kolom 3: Panel Kontrol & Hasil Pengukuran Kanan */}
          <ControlPanel
            activeStation={activeStation}
            activePart={activePart}
            standardText={
              `Std: ${activePart?.min_distance_mm ?? 0.7} - ${activePart?.max_distance_mm ?? 1.7} mm (${activePart?.part_number || 'DN-XRAY-42890-A'})`
            }
            onRecheck={handleRecheck}
            onLearningAi={() => alert('Menu Learning AI (Fase 3 - Authenticated PE)')}
            onPrevStation={handlePrevStation}
            onNextStation={handleNextStation}
            onResetNg={() => {
              setAlarmStation(activeStation);
              setAlarmModalOpen(true);
            }}
            isLeader={currentUser.role === 'tl' || currentUser.role === 'admin'}
          />
        </main>
      )}

      {/* ── Modal-Modal Sistem ───────────────────────────────────────────────── */}

      {/* Modal QR Scan */}
      <QrScanModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onScanSuccess={handleQrScanned}
        mode={qrModalMode}
        title={
          qrModalMode === 'kanban'
            ? 'Dandori (Scan QR Kanban Part Number)'
            : qrModalMode === 'leader_reset'
            ? 'Scan QR Leader untuk Reset NG'
            : 'Scan QR ID Card'
        }
      />

      {/* Modal Settings Denso */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      {/* Modal Kalibrasi Harian Jig */}
      <CalibrationModal
        isOpen={calibModalOpen}
        onClose={() => setCalibModalOpen(false)}
        isDayShift={shiftInfo?.isDayShift ?? true}
        currentScale={settings?.scale_mm_per_pixel || 0.02185}
        onSaveScale={(newScale) => {
          setSettings((prev) => ({ ...prev, scale_mm_per_pixel: newScale }));
        }}
      />

      {/* Modal POKAYOKE Alarm Interlock */}
      <AlarmInterlockModal
        isOpen={alarmModalOpen}
        ngStation={alarmStation}
        allNgStations={stations.filter((s) => s.judge === 'NG')}
        onResetByLeader={handleLeaderResetSuccess}
        onRecheckStation={(stId) => {
          setActiveStationId(stId);
          handleRecheck();
        }}
      />

      {/* Alert Pergantian Shift Otomatis (07:00 & 20:30) */}
      <ShiftChangeAlert
        isOpen={shiftAlertOpen}
        onConfirmLogout={handleLogout}
        currentShift={shiftInfo?.currentShift || 'Day Shift'}
        targetShift={targetShiftName}
      />

      {/* Modal Riwayat & Traceability Harian (Fase 5 - Fitur 4, 5, 7) */}
      <HistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}

