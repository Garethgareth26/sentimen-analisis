# 📘 DOKUMENTASI SISTEM & KEPATUHAN STANDAR DNIA DX
## PROYEK: AI X-RAY AUTO MEASUREMENT (PT. DENSO INDONESIA - 3RD FACTORY)

> **Status Dokumen:** Living Document (Berkelanjutan & Diperbarui Setiap Fase)  
> **Versi:** 1.0 (Penyelesaian Fase 1 & Baseline Standar DNIA DX)  
> **Tanggal Pembaruan:** 9 Oktober 2026  
> **Lokasi Workspace:** `C:\Users\LENOVO\Downloads\aixray-20260917T002514Z-1-001\aixray-clean`  
> **Dokumen Acuan Standar:**
> 1. `DNIA_DX_Development_Starter_Kit_README.pdf` (*Index & Cara Pakai Standar DNIA DX*)
> 2. `DNIA_DX_Starter_Kit_Vol1_Backend_Template_Guide.pdf` (*Node MVC, Security & Quality Gate*)
> 3. `DNIA_DX_Starter_Kit_Vol2_FrontEnd_Template_Guide.pdf` (*React 19, Feature-Based MVC & State*)
> 4. `DNIA_DX_Starter_Kit_Vol3_Full_Stack_Development_Guide.pdf` (*End-to-End Architecture & Quality Control*)
> 5. `general-req-aixray.docx` (*DX Requirement Sheet PT. Denso Indonesia, 3rd Factory*)

---

## 📑 DAFTAR ISI
1. [Prinsip & Standar Wajib DNIA DX Starter Kit](#1-prinsip--standar-wajib-dnia-dx-starter-kit)
2. [Arsitektur Sistem End-to-End Sesuai Standar Vol 1-3](#2-arsitektur-sistem-end-to-end-sesuai-standar-vol-1-3)
3. [Model Keamanan & Batas Keamanan (Security Boundary)](#3-model-keamanan--batas-keamanan-security-boundary)
4. [Status Kemajuan Pengembangan: Fase 1 (Selesai)](#4-status-kemajuan-pengembangan-fase-1-selesai)
5. [Log Artefak & Komponen yang Telah Dibangun](#5-log-artefak--komponen-yang-telah-dibangun)
6. [Roadmap & Rencana Kepatuhan Fase 2 s/d Fase 5](#6-roadmap--rencana-kepatuhan-fase-2-sd-fase-5)
7. [Checklist Quality Gate & Kontrol Kualitas](#7-checklist-quality-gate--kontrol-kualitas)

---

## 🏛️ 1. Prinsip & Standar Wajib DNIA DX Starter Kit

Sesuai instruksi **DNIA DX Development Starter Kit (Vol 1, Vol 2, Vol 3, dan README)**, seluruh proyek digital transformation di PT. Denso Indonesia wajib menerapkan prinsip inti berikut:

### A. Simetri Arsitektur & Pemisahan Layer (Separation of Concerns)
* **Backend (Node MVC Berlapis):**
  $$\text{Client} \longrightarrow \text{Route} \longrightarrow \text{Middleware} \longrightarrow \text{Validation/Sanitization (Zod)} \longrightarrow \text{req.validated} \longrightarrow \text{Controller} \longrightarrow \text{Service} \longrightarrow \text{Model} \longrightarrow \text{Database}$$
  - **Controller:** Hanya menangani HTTP request dan response. **Dilarang keras mengakses model database secara langsung.**
  - **Service:** Pusat *business logic*, transaksi, kalkulasi toleransi, orkestrasi AI sidecar, dan operasi model.
  - **Model:** Hanya memetakan skema/tabel database.
  - **Database Lifecycle:** Skema diatur via SQL script terkelola. **Dilarang keras menggunakan `sequelize.sync()` otomatis di production.** Dilarang menggunakan raw SQL bebas di dalam `src/`.
* **Frontend (Feature-Based MVC):**
  $$\text{View (Component/Page)} \longrightarrow \text{Controller (Custom Hooks)} \longrightarrow \text{Model (API/Schema/Type/State)} \longrightarrow \text{Axios (withCredentials + CSRF)} \longrightarrow \text{Backend REST}$$
  - **View:** Hanya merender UI dan menangkap event interaksi pengguna. **Komponen View dilarang keras menembak API mentah secara langsung.**
  - **Controller:** Custom hooks yang mengorkestrasikan *state*, validasi, mutasi, dan *query caching*.
  - **Model:** Menyimpan fungsi HTTP client, skema validasi Zod, deklarasi TypeScript, dan store state fitur.
  - **Struktur Fitur Mandiri:** Folder disusun per-fitur di `src/features/<nama-fitur>/[model | controller | view]`.

### B. Aturan "Yang Boleh & Tidak Boleh" (Do & Don't)
| Kategori | Wajib Dilakukan (DO) | Dilarang Keras (DO NOT) |
|---|---|---|
| **Runtime & Dependencies** | Gunakan Node.js LTS (>=22.12.0) sesuai engine acuan DNIA. | Memakai runtime lain tanpa approval mentor/lead. |
| **Credential & Secret** | Gunakan Environment Variable (`.env`), sensor log rahasia (`[REDACTED]`). | Commit file `.env`, hardcode password/token, atau private key di source code. |
| **Penyimpanan Token** | JWT disematkan via **HttpOnly Cookie** (Enterprise browser standard). | Menyimpan JWT auth sensitif di `localStorage` yang rentan XSS. |
| **Validasi Input** | Validasi skema ketat menggunakan **Zod** di kedua sisi (Front-End & Back-End). | Mengandalkan validasi front-end sebagai satu-satunya kontrol (server adalah batas keamanan utama). |
| **Render UI** | Render data server sebagai plain text yang aman dari XSS. | Menggunakan `dangerouslySetInnerHTML`. |
| **Quality Gates** | Jalankan `npm run lint`, `npm test`, `npm audit`, dan `npm run check`. | Melewati quality gate demi mengejar kecepatan penyelesaian. |

---

## ⚙️ 2. Arsitektur Sistem End-to-End Sesuai Standar Vol 1-3

Aplikasi **AI X-Ray Auto Measurement** menerapkan arsitektur *Industrial Hybrid Desktop-Web*:

```
+---------------------------------------------------------------------------------------------------+
| FRONT-END (React 19 + Vite 8 + CSS Modern Glassmorphism + Lucide)                                  |
|                                                                                                   |
|  [ View ]              [ Controller (Hooks) ]           [ Model / State ]                         |
|  - LoginPage           - useAuthSession                 - authModel (Zod Schema)                  |
|  - DashboardLayout     - useShiftAutoLogout             - shiftModel                              |
|  - PocketGrid (18 st)  - useStationMeasure              - stationModel                            |
|  - ImageViewport       - usePokayokeAlarm               - measurementStore                        |
|  - Modals (QR/Setting) - useManualMeasure                                                         |
+-------------------------------------------------+-------------------------------------------------+
                                                  | Axios (withCredentials + JWT/CSRF)
                                                  v
+---------------------------------------------------------------------------------------------------+
| BACKEND REST API (Node.js Express + Layered MVC Architecture)                                     |
|                                                                                                   |
|  [ Routes ]           --> [ Middleware ]        --> [ Validations (Zod) ]                         |
|  - /api/auth/*             - requireAuth             - loginSchema                                |
|  - /api/process            - requireRole (OP/TL/ADM) - qrScanSchema                               |
|  - /api/jig-measure        - corsAllowlist           - toleranceSchema                            |
|  - /api/settings           - helmet & rate-limit     - configSchema                               |
|                                                                                                   |
|  [ Controllers ]      --> [ Services (Business Logic) ] --> [ Models & Storage / Logs ]           |
|  - authController          - authService (Shift Rules)        - Config JSON Store                 |
|  - measureController       - measureService (AI Orchestrator) - Daily CSV Audit Logs              |
|  - systemController        - calibrationService               - Inspection Images                 |
+---------------------------------------+-----------------------------------------------------------+
                                        | HTTP IPC Localhost (Port 5001)
                                        v
+---------------------------------------------------------------------------------------------------+
| PERSISTENT AI SIDECAR ENGINE (Python 3.10+ FastAPI / Uvicorn)                                     |
|                                                                                                   |
|  - YOLOv8x-Pose Retrained Model (best.pt) Preloaded in VRAM/RAM (<1s Response)                    |
|  - Keypoint Extraction (Point A - Point B)                                                        |
|  - Auto-Alignment & Pixel-to-mm Conversion (0.02185 mm/px Standard Pin Gauge)                     |
|  - OpenCV Auto-Anchor Fallback Engine                                                             |
+---------------------------------------------------------------------------------------------------+
```

---

## 🔒 3. Model Keamanan & Batas Keamanan (Security Boundary)

Sesuai **Vol 1 & Vol 3**, keputusan keamanan final selalu berada di sisi **Backend (Server-Side Security Boundary)**:

1. **Aturan Shift Wajib Denso (Auto-Logout Enforcement):**
   - **Day Shift:** `07:00:00` s/d `20:29:59`
   - **Night Shift:** `20:30:00` s/d `06:59:59`
   - Setiap token sesi disematkan nilai `shiftExpiry` absolut. Saat jam pergantian tiba (07:00 / 20:30), middleware server secara mutlak menolak request lama dengan kode `SHIFT_EXPIRED`.
2. **Role-Based Access Control (RBAC):**
   - **Operator (MP):** Login operasi standar, eksekusi inspeksi, dan kalibrasi harian (khusus Day Shift).
   - **Team Leader (TL):** Akses operator + hak pembukaan kunci alarm POKAYOKE NG via QR scan, double check, dan manual measurement.
   - **Admin (PE / PED):** Akses konfigurasi sistem (setting folder simpan All/NG/OK, kalibrasi master jig, integrasi sinyal PLC, dan menu Learning AI).
3. **Data Sanitization & Redaction:**
   - Parameter NPK, nama, dan nilai ukuran disanitasi sebelum diproses.
   - Credential dan data audit log disensor (`[REDACTED]`).

---

## 🚀 4. Status Kemajuan Pengembangan: Fase 1 (Selesai)

### Ringkasan Pencapaian Fase 1
Pada Fase 1 (**Foundation & Authentication**), fondasi arsitektur, autentikasi, aturan shift Denso, dan layout antarmuka telah berhasil diselesaikan 100%:

| No | Spesifikasi Fitur | Target Mockup | Status Implementasi | Catatan Kepatuhan DNIA |
|---|---|---|---|---|
| **1.1** | **Backend Role & Token Auth** | Spk Denso No. 8 & 13 | ✅ **SELESAI** | Endpoint `/api/auth/login`, `/api/auth/qr-login`, `/api/auth/shift-status`, dan middleware RBAC (`auth.js`). |
| **1.2** | **Halaman Login UI Modern** | `image10.jpeg` | ✅ **SELESAI** | Lensa tech header, floating card input Nama & NPK, tombol gradien, tombol Scan QR, tagline Denso, dan hero IC HUD visual. |
| **1.3** | **Sistem Auto-Logout Shift** | `image3.png` | ✅ **SELESAI** | Kalkulasi waktu lokal tepat 07:00 & 20:30; auto-redirect dan modal `ShiftChangeAlert.jsx`. |
| **1.4** | **Header Status Bar** | `image11.png` | ✅ **SELESAI** | Logo DENSO merah, nama operator, badge shift Day/Night, real-time clock, part number aktif, dan action logout/setting. |
| **1.5** | **Ribbon Bar KPI Produksi** | `image11.png` | ✅ **SELESAI** | Tombol navigasi `Calibration` (dikunci hanya Day Shift sesuai SOP Denso), `History`, counter Total/OK/NG/Ratio/CT. |
| **1.6** | **Grid 18 Pocket Stasiun** | `image11.png` | ✅ **SELESAI** | Layout 3 baris $\times$ 6 kolom (`st1` s/d `st18`), badge status OK/NG, dan nilai ukur per pocket. |
| **1.7** | **Viewport Citra Tengah** | `image11.png` | ✅ **SELESAI** | Canvas X-Ray dengan kontrol Zoom In, Zoom Out, dan Fit Screen. |
| **1.8** | **Panel Kontrol Sisi Kanan** | `image11.png` | ✅ **SELESAI** | Display standar toleransi, banner Judgement OK/NG, tombol operasional, dan pemicu interlock. |
| **1.9** | **Modal-Modal Modular** | `image12, 13, 15, 16` | ✅ **SELESAI** | Komponen modal: QR Scan, Settings Denso, Manual Measurement, Kalibrasi Jig, dan POKAYOKE Alarm Interlock. |

---

## 📂 5. Log Artefak & Komponen yang Telah Dibangun

Berikut adalah daftar file yang telah diproduksi dan diverifikasi:

### A. Modul Backend (`backend/`)
- [backend/server.js](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/server.js): Entry point ramping yang mengintegrasikan Helmet, CORS Credentials, Cookie-Parser, dan Route API.
- [backend/src/config/users.json](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/src/config/users.json): Master mapping NPK karyawan Denso untuk auto-detect role Operator/TL/Admin.
- [backend/src/validators/auth.validator.js](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/src/validators/auth.validator.js): Skema validasi deklaratif Zod untuk login dan scan QR.
- [backend/src/services/auth.service.js](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/src/services/auth.service.js): Pusat logika shift Denso (Day 07:00 / Night 20:30), token generation, dan role resolution.
- [backend/src/services/sidecar.service.js](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/src/services/sidecar.service.js): Orkestrator persistent Python FastAPI Sidecar.
- [backend/src/middlewares/auth.middleware.js](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/src/middlewares/auth.middleware.js): Verifikasi HttpOnly Cookie anti-XSS & RBAC.
- [backend/src/controllers/auth.controller.js](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/src/controllers/auth.controller.js): Controller autentikasi.
- [backend/config.json](file:///c:/Users/User/Downloads/aixray-clean-20261011T071448Z-1-001/aixray-clean/backend/config.json): Konfigurasi toleransi ($0.89 - 1.61\text{ mm}$), skala kalibrasi ($0.02185\text{ mm/px}$), dan path model YOLO.

### B. Modul Frontend (`frontend/src/`)
- [frontend/src/style.css](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/style.css): Sistem desain industri terpadu, token warna Denso, layout grid 18 station, dan animasi HUD.
- [frontend/src/App.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/App.jsx): Root controller orkestrasi sesi, shift monitor, pemilihan stasiun aktif, dan state modal.
- [frontend/src/components/LoginPage.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/LoginPage.jsx): Replika mockup `image10.jpeg` dengan form Nama + NPK dan hero HUD visual.
- [frontend/src/components/HeaderBar.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/HeaderBar.jsx): Header status bar sistem Denso.
- [frontend/src/components/RibbonBar.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/RibbonBar.jsx): Ribbon KPI produksi dan navigasi.
- [frontend/src/components/PocketGrid.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/PocketGrid.jsx): Grid 18 pocket stasiun sesuai wireframe `image11.png`.
- [frontend/src/components/ImageViewport.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/ImageViewport.jsx): Viewport citra dengan kontrol zoom.
- [frontend/src/components/ControlPanel.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/ControlPanel.jsx): Panel hasil dan tombol operasional.
- [frontend/src/components/ShiftChangeAlert.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/ShiftChangeAlert.jsx): Dialog auto-logout pergantian shift.
- [frontend/src/components/QrScanModal.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/QrScanModal.jsx): Pemindai QR untuk ID Card operator, kanban, dan leader reset.
- [frontend/src/components/SettingsModal.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/SettingsModal.jsx): Pengaturan folder penyimpanan, opsi filter citra, PLC, dan model path.
- [frontend/src/components/ManualMeasureModal.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/ManualMeasureModal.jsx): Tool ukur manual tarik garis 2 titik A-B live.
- [frontend/src/components/CalibrationModal.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/CalibrationModal.jsx): Kalibrasi master jig Day Shift.
- [frontend/src/components/AlarmInterlockModal.jsx](file:///c:/Users/LENOVO/Downloads/aixray-20260917T002514Z-1-001/aixray-clean/frontend/src/components/AlarmInterlockModal.jsx): Pop-up alarm POKAYOKE interlock NG.

---

## 🗺️ 6. Roadmap & Rencana Kepatuhan Fase 2 s/d Fase 5

Sesuai urutan pengembangan standar:

```
[SELESAI ✅] FASE 1: Foundation, Role & Auth, Shift Auto-Logout, Modern Login UI & Dashboard Layout
     │
     ▼
[TARGET 🎯] FASE 2: Kalibrasi Harian Jig, Dandori QR Scan Kanban, & Image Receiver
    ├── Service Kalibrasi Master Jig: pin gauge 0.02185 mm/px dengan validasi error part terpasang
    ├── Fitur Dandori: Scanner QR Kanban produksi untuk lock Part Number & toleransi otomatis
    └── Image Receiver: Watcher folder capture menerima input JPG & PNG otomatis dari mesin X-Ray
     │
     ▼
[BERIKUTNYA] FASE 3: AI Measurement Engine Integration & Live Grid 18 Pocket Station
    ├── Integrasi FastAPI Sidecar dengan model YOLOv8x-pose `best.pt` secara batch/live
    ├── Pembaruan live seluruh nilai st1 - st18 secara real-time dari hasil ukur AI
    └── Qty Counter & Cycle Time Calculation aktual vs target
     │
     ▼
[BERIKUTNYA] FASE 4: Alarm POKAYOKE Interlock & Manual Measurement Tool
    ├── Interlock mesin saat terjadi NG (membekukan operasi dan membunyikan alarm)
    ├── Reset Alarm wajib otorisasi via Scan QR Leader/TL
    └── Kanvas Manual Measurement interaktif 2 titik (A-B)
     │
     ▼
[BERIKUTNYA] FASE 5: Traceability, Daily CSV Logging Denso, & Server Sync Transfer
    ├── Format CSV harian resmi Denso (1 file/hari)
    ├── Pengaturan penyimpanan citra (All / NG Only / OK Only)
    └── Service sinkronisasi folder history ke server QC/PED internal
```

---

## 📋 7. Checklist Quality Gate & Kontrol Kualitas

Sebelum setiap fase diserahterimakan (*handover*), checklist berikut wajib dipenuhi mengacu pada **Vol 1 & Vol 2**:

- [x] **Linting & Formatting:** Tidak ada sintaks error atau deklarasi variabel yang merusak build.
- [x] **Build Verification:** `npm run build` sukses di frontend (`dist/` valid, bundle size efisien, zero errors).
- [x] **Server Syntax Check:** `node --check server.js` lolos tanpa unhandled exceptions.
- [x] **Separation of Concerns:** Controller tidak melakukan operasi data mentah di luar jalurnya.
- [x] **Security Baseline:** Sanitasi input diterapkan, tidak ada secret yang di-commit, token terikat shift.
- [ ] **Automated Unit Tests (Fase 2-3):** Penambahan automated test untuk route dan service pengukuran.
- [ ] **Dependency Audit:** `npm audit` bebas dari kerentanan kritis.

---

*Dokumen ini akan terus diperbarui secara bertahap seiring berjalannya implementasi fase demi fase.*
