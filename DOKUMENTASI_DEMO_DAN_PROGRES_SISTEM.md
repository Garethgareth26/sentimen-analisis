# 📋 PANDUAN DEMO & DOKUMENTASI PROGRES SISTEM (LIVING DOCUMENT)
# AI X-RAY AUTO MEASUREMENT — PT. DENSO INDONESIA (3RD FACTORY)

> **Status Dokumen:** Living Document (Sistem 100% Selesai — Seluruh Fase 1 s.d. 5 Tuntas)  
> **Terakhir Diperbarui:** 11 Oktober 2026 (Penyelesaian Eksekusi Fase 5 - History Output CSV, Save Image Routing & QC Server Sync)  
> **Lokasi Workspace:** `C:\Users\User\Downloads\aixray-clean-20261011T071448Z-1-001\aixray-clean`  
> **Referensi Spesifikasi:** `general-req-aixray.docx` (*DX Requirement Sheet PT. Denso Indonesia*)  
> **Standar Arsitektur:** `DNIA DX Development Starter Kit (Vol 1 Backend, Vol 2 Front-End, Vol 3 Full Stack)`

---

## 🎯 1. Informasi Umum Sistem & Tujuan Proyek

Aplikasi **AI X-Ray Auto Measurement** adalah sistem inspeksi visual industri berbasis *Hybrid Desktop-Web* yang menggantikan metode pengukuran manual film jig berskala pada monitor X-Ray.

* **Masalah Baseline:** Risiko *human error / miss judgment* oleh operator dan risiko part NG lolos ke pelanggan (*flow out*) karena belum adanya sistem POKAYOKE / interlock otomatis.
* **Tujuan Utama:**
  1. Otomasi pengukuran dimensi kritis celah Point A ke Point B (posisi IC chip di housing part).
  2. Auto-judgement **OK** vs **NG** berdasarkan toleransi standar Denso ($0.89\text{ mm} - 1.61\text{ mm}$).
  3. Sistem **POKAYOKE Interlock** yang membekukan operasional mesin saat terjadi part NG.
  4. Penanganan alarm standar Denso: reset hanya melalui **Scan QR Card Team Leader**.

---

## 👥 2. Kredensial & Akun Uji Coba Demo (Master NPK Table)

Untuk kebutuhan demo, Anda dapat memasukkan NPK manual atau men-scan barcode/QR di bawah ini:

| Role Akses | NPK | Nama Lengkap | Departemen / Jabatan | Hak Akses Utama |
|---|:---:|---|---|---|
| **Operator** | `1092` | Budi Santoso | Production - Section X-Ray | Operasi inspeksi normal, Kalibrasi Day Shift. *Dilarang reset NG.* |
| **Operator 2** | `1093` | Ahmad Fauzi | Production - Section X-Ray | Operasi inspeksi normal. |
| **Team Leader (TL)** | `8021` | Sugimoto-san | Quality Assurance - Team Leader | Hak Operator + **Buka Interlock POKAYOKE NG via QR**, Manual Measure A–B. |
| **Team Leader 2** | `8022` | Hendra Wijaya | Production - Group Leader | Hak Operator + Buka Interlock NG. |
| **Admin** | `9999` | Admin PE Dept | Process Engineering (PE/PED) | **Full Access**: Setting folder, Toleransi, I/O PLC, Learning AI. |
| **Super Admin** | `ADM001` | Super Admin System | Digital Transformation (DX) / PED | Full Access seluruh parameter sistem. |

> **Catatan Pengenalan Scanner:**  
> Sistem mendukung pengenalan via **nomor NPK murni** (misal scanner hanya mengirim angka `8021`), **prefix teks** (`TL8021`, `ADM001`), maupun **format kartu resmi Denso** (`DENSO:TL:8021:SUGIMOTO`).

---

## 🎬 3. Panduan Skenario Demo Langkah Demi Langkah (Step-by-Step)

Gunakan skenario ini saat mempresentasikan sistem ke manajemen / mentor Denso:

```
[LANGKAH 1: LOGIN SESI]
1. Buka browser: http://localhost:5173
2. Tunjukkan Halaman Login (Replika persis mockup image10.jpeg).
3. Klik tombol Preset "Leader" atau masukkan Nama: Sugimoto-san & NPK: 8021.
4. Klik tombol "MASUK KE SISTEM".
   -> Perhatikan Header menampilkan Nama, NPK, dan Badge "TL".
   -> Sesi token tersimpan aman via HttpOnly Cookie (Standar DNIA DX Vol 3).

[LANGKAH 2: PENGECEKAN ATURAN SHIFT DENSO]
1. Tunjukkan Header Bar bagian "Date & Time" dan status "Day Shift" / "Night Shift".
2. Jelaskan bahwa sistem mengunci token sesi tepat pada jam 07:00 dan 20:30.
3. Saat jam tersebut tiba, sistem otomatis mengunci layar dan menampilkan dialog "Pergantian Shift Otomatis (Auto-Logout)".

[LANGKAH 3: OVERVIEW DASHBOARD 18 STASIUN]
1. Tunjukkan Grid 18 Pocket (st1 s/d st18) di sisi kiri dalam status STANDBY.
2. Viewport tengah menampilkan status "TRAY STATUS: STANDBY".
3. Klik tombol biru "Run Tray (18 Pocket)":
   -> Grid terisi secara sekuensial saku demi saku dengan animasi scanning interaktif.

[LANGKAH 4: RUN TRAY INSPECTION & OVERLAY AI KEYPOINT]
1. Klik tombol "Mode: Anotasi AI" untuk melihat visualisasi keypoint Point A (Pin IC) dan Point B (Housing) dengan garis ukur merah/hijau.
2. Klik tombol "Mode: Citra Asli" untuk beralih melihat citra mentah X-Ray murni.

[LANGKAH 5: POKAYOKE ALARM INTERLOCK & OTORISASI LEADER]
1. Saat st8 terdeteksi NG (0.612 mm di bawah batas min 0.89 mm), alarm POKAYOKE seketika muncul membekukan operasi.
2. Uji Penolakan Operator: Scan NPK 1092 (Budi Santoso) -> Sistem menolak (HTTP 403 Forbidden).
3. Otorisasi Leader: Scan QR Leader Sugimoto-san (8021) -> Interlock terbuka dan 3 opsi tindakan muncul.
4. Klik "1. Manual Measure" -> Tarik garis 2 titik A-B -> Nilai live mm muncul -> Simpan override.
5. Klik "3. Release Interlock & Lanjutkan Operasi" -> Sistem kembali normal dan siap menginspeksi tray berikutnya.

[LANGKAH 6: RIWAYAT INSPEKSI CSV & SINKRONISASI SERVER QC/PED]
1. Klik tombol "History" di Ribbon Bar -> Modal Riwayat Harian Denso terbuka.
2. Tunjukkan tabel data riwayat (Date, Time, Operator Name, NPK, Part Number, Sequence, Station, Dimension, Judgement, Method, Citra Link).
3. Gunakan filter tab "NG Only" -> Sistem menyaring stasiun yang berstatus cacat/NG (st8 & st14).
4. Klik tombol "Download CSV Harian" -> Unduh berkas resmi YYYYMMDD_denso_inspection.csv.
5. Klik "Transfer ke Server QC/PED" -> Masukkan/verifikasi path target -> Klik "Mulai Sinkronisasi" -> 37 file tersinkronisasi instan ke server QC.
6. Buka tombol Gear "Setting" di Header -> Periksa tab "Save Image" (Opsi All Images, NG Only, OK Only) sesuai Mockup image15.png.
```

---

## 📊 4. Matriks Status Kemajuan Tiap Fase

| Fase | Nama Modul | Target Utama | Status | Catatan Implementasi |
|---|---|---|:---:|---|
| **🟥 FASE 1** | **Foundation, Auth & DX Standard** | • Login Dual-Mode (NPK & QR)<br>• Aturan Shift Denso (07:00 & 20:30)<br>• Dashboard 18 Pocket Layout<br>• HttpOnly Cookie & Zod Validation | ✅ **100% SELESAI** | Arsitektur backend telah direfaktor ke **Layered MVC (DNIA DX Starter Kit Vol 1 & 3)**. Token aman dari XSS. |
| **🟧 FASE 2** | **Calibration & Dandori Kanban** | • Kalibrasi Master Jig Day Shift<br>• POKAYOKE Error jika Part Terpasang<br>• Dandori QR Kanban (Lock P/N)<br>• Input Receiver JPG/PNG | ✅ **100% SELESAI** | Modal Kalibrasi interaktif (`image13.png`), deteksi POKAYOKE part produk pada jig, dan Changeover Kanban otomatis terintegrasi. |
| **🟨 FASE 3** | **AI Measurement Engine & 18-Station Grid** | • FastAPI Sidecar YOLOv8x-pose<br>• Batch Tray Ingestion 18 Pocket<br>• AI Keypoint Visual Overlay A–B<br>• Qty Counter & CT Real-time | ✅ **100% SELESAI** | Model AI YOLO `best.pt` terintegrasi via sidecar persistent; 18 stasiun sekuensial diproses dengan overlay keypoint Point A (Pin IC) dan Point B (Housing) serta tombol toggle citra asli/anotasi. |
| **🟩 FASE 4** | **Alarm POKAYOKE & Manual Measure** | • Server-side Interlock freeze<br>• Reset via QR Leader (RBAC 403)<br>• Tool Manual Measure A–B<br>• Manual Override Register | ✅ **100% SELESAI** | Pop-up Interlock POKAYOKE membekukan operasi saat NG; validasi RBAC menolak operator dan hanya menerima QR Leader Sugimoto/Hendra; tool Manual Measure interaktif A-B (`image12.png`) dengan kalkulasi mm live dan registrasi override terverifikasi. |
| **🟦 FASE 5** | **History & Traceability** | • Log CSV Harian Denso (1 file/hari)<br>• Folder Save: All/NG/OK<br>• Sync Transfer Server QC/PED<br>• History Modal & Settings Image | ✅ **100% SELESAI** | Fitur 4 (Log CSV harian `YYYYMMDD_denso_inspection.csv` lengkap 11 field standar), Fitur 5 (Opsi All/NG/OK & CSV tersimpan 100%), Fitur 7 (Sinkronisasi backup server QC/PED dengan audit trail), serta History Modal interaktif dengan filter dan download CSV. |

---

## 🎭 5. Skenario Demo Pengujian Sistem (Panduan Presentasi)

### 📌 Skenario 1: Autentikasi Karyawan & Deteksi Shift (Fase 1)
1. **Login Manual NPK:** Masukkan Nama: `Budi Santoso`, NPK: `1092` $\rightarrow$ Tekan *Masuk ke Sistem*.
2. **Login Cepat via QR ID Card:** Klik tombol *Scan QR ID Card* $\rightarrow$ Pilih preset *ID Card Operator (Budi)* atau *Leader (Sugimoto)* $\rightarrow$ Sistem seketika memverifikasi token JWT via HttpOnly Cookie.
3. **Pendeteksian Shift Otomatis:** Perhatikan *Shift Badge* di Header Bar:
   * **Day Shift:** Aktif pukul 07:00:00 s/d 20:29:59.
   * **Night Shift:** Aktif pukul 20:30:00 s/d 06:59:59.
   * *Background Monitor:* Sistem otomatis memunculkan pop-up alert & logout tepat saat pergantian shift.

---

### 📌 Skenario 2: Kalibrasi Harian Master Jig (Fase 2 — Fitur 1)
1. **Buka Menu Kalibrasi:** Klik tombol **`Calibration`** di Ribbon Bar.
2. **Validasi Day Shift:** Jika dibuka pada Night Shift, muncul spanduk peringatan kuning: *"SOP Denso: Kalibrasi master jig dilakukan pada Day Shift (07:00)"*.
3. **Ambil Citra Jig:** Klik tombol **`Get Image Jig`** $\rightarrow$ Sistem mengambil citra pin gauge dari mesin X-Ray.
4. **Tarik Garis Interaktif (Pin Gauge A–B):**
   * Klik tombol **`Tarik Garis (Manual Pin)`** $\rightarrow$ Kursor berubah menjadi crosshair.
   * Klik titik A di ujung pin dan titik B di ujung batas jig $\rightarrow$ Garis putus-putus merah muncul.
   * Kotak **`VALUE LIVE`** langsung menghitung rasio skala: $\text{Skala} = \frac{\text{Nominal mm}}{\text{Pixel Terukur}}$.
5. **Uji Coba POKAYOKE (Simulasi Part Terpasang):**
   * Klik tombol merah **`Simulasi Part Terpasang (Pokayoke)`**.
   * Sistem menjalankan inspeksi AI dan mendeteksi bahwa komponen IC produk masih menempel pada jig.
   * Seketika muncul **POKAYOKE INTERLOCK ALERT (Merah)**:  
     *`"POKAYOKE INTERLOCK: Part produk terdeteksi terpasang pada jig! Kalibrasi dibatalkan. Harap kosongkan jig kalibrasi sebelum register."`*
   * Tombol *Register* dibekukan untuk mencegah salah kalibrasi.
6. **Registrasi Skala Baru:** Jika jig kosong, klik tombol **`Register`** $\rightarrow$ Nilai skala tersimpan ke sistem dan audit log mencatat operator serta waktu kalibrasi.

---

### 📌 Skenario 3: Dandori (Changeover via QR Kanban) (Fase 2 — Fitur 14)
1. **Buka Menu Dandori:** Klik tombol **`Dandori (Kanban)`** di Ribbon Bar atau klik chip **`Part Number (Dandori)`** di Header Bar.
2. **Scan Kartu Kanban Produksi:**
   * Masukkan string barcode Kanban fisik atau klik tombol preset cepat:
     * `Kanban P/N: 42890-A` (Standar Fuel Rail: 0.89 – 1.61 mm)
     * `Kanban P/N: 42890-B` (High Precision: 0.95 – 1.55 mm)
     * `Kanban P/N: 28438-51001` (Direct Sensor: 0.80 – 1.50 mm)
   * Klik **Verifikasi Scan**.
3. **Hasil Otomatis:**
   * Part Number aktif di Header Bar seketika berubah.
   * Standar toleransi di panel kanan (*Control Panel*) langsung terkunci mengikuti batas Kanban yang di-scan.
   * Parameter tersimpan otomatis di konfigurasi backend.

---

### 📌 Skenario 4: Inspeksi Otomatis 1 Tray (18 Pocket) & Keypoint AI Overlay (Fase 3)
1. **Trigger Inspeksi Batch:** Klik tombol biru **`Run Tray (18 Pocket)`** pada Ribbon Bar.
2. **Pemrosesan AI Sekuensial:**
   * Backend menginstruksikan Python FastAPI Sidecar untuk memproses 18 citra pocket secara sekuensial menggunakan model `best.pt`.
   * Nilai jarak celah (Point A ke Point B), judgement (OK/NG), skor confidence, dan cycle time aktual (CT) dihitung presisi.
3. **Visualisasi Anotasi Keypoint:**
   * Klik tombol **`[ Mode: Anotasi AI ]`** di bawah Viewport tengah untuk melihat garis ukur dan keypoint yang dideteksi oleh YOLO:
     * **Point A (Biru):** Keypoint Pin IC.
     * **Point B (Magenta):** Keypoint Housing.
     * **Garis Ukur:** Garis horizontal yang menghubungkan celah (Hijau jika OK, Merah tebal jika NG) lengkap dengan teks dimensi mm.
   * Klik tombol **`[ Mode: Citra Asli ]`** untuk beralih melihat citra X-Ray murni tanpa filter/anotasi.
4. **Pembaruan KPI Produksi:**
   * Counter **Total Product**, **OK Qty**, **NG Qty**, *    * Pilih stasiun mana saja (misal `st1`), lalu klik tombol **`Re-check`** di panel kontrol kanan untuk memicu inferensi ulang secara instan pada stasiun tersebut.

---

### 📌 Skenario 5: Riwayat Inspeksi CSV Harian, Download Data & Sinkronisasi Server QC/PED (Fase 5 — Fitur 4, 5, 7)
1. **Buka Menu History:** Klik tombol **`History`** di Ribbon Bar.
2. **Lihat Ringkasan Harian:**
   - Periksa kartu metriks atas: Total Inspeksi, Total OK, Total NG, Ratio %, dan nama file CSV harian aktif (`YYYYMMDD_denso_inspection.csv`).
3. **Filter Data Cepat:**
   - **Filter Status:** Klik tab **`NG Only`** untuk memfilter part cacat (st8 & st14), atau **`OK Only`**, atau **`Semua`**.
   - **Filter Stasiun:** Pilih dropdown stasiun (misal `st8`).
   - **Pencarian:** Ketik nomor NPK (misal `1092`) atau Sequence ID untuk mencari record spesifik.
4. **Unduh Berkas CSV:** Klik tombol biru **`Download CSV Harian`** untuk mengekspor file CSV resmi harian Denso langsung ke browser.
5. **Sinkronisasi / Transfer ke Server QC/PED (Fitur 7):**
   - Klik tombol hijau **`Transfer ke Server QC/PED`**.
   - Dialog transfer muncul menampilkan target direktori server (default: `C:\QC_Server_Backup\XRay_History`).
   - Klik **`Mulai Sinkronisasi`** $\rightarrow$ File CSV harian dan seluruh citra inspeksi langsung di-copy ke folder target server QC/PED dengan notifikasi audit sukses.
6. **Pengaturan Simpan Citra (Fitur 5 — Mockup Image 15):**
   - Klik ikon Gear **`Setting`** di Header Bar $\rightarrow$ Pilih tab **`Save Image`**.
   - Atur kebijakan penyimpanan gambar: **`All Images`**, **`NG Only`**, atau **`OK Only`** serta format gambar (**`JPG`** / **`PNG`**).
   - Data CSV dipastikan tersimpan 100% pada seluruh opsi penyimpanan gambar.

---

## 🏛️ 6. Struktur Arsitektur Backend Lengkap (DNIA DX Starter Kit Vol 1 & 3)

```
backend/
├── src/
│   ├── config/
│   │   └── users.json            <-- Master data NPK karyawan Denso
│   ├── validators/
│   │   ├── auth.validator.js     <-- Skema validasi Zod (Nama, NPK, QR)
│   │   ├── dandori.validator.js  <-- Skema validasi Zod (Kanban, Kalibrasi)
│   │   ├── tray.validator.js     <-- Skema validasi Zod (Batch Tray & Station)
│   │   └── alarm.validator.js    <-- Skema validasi Zod (Leader QR & Override)
│   ├── middlewares/
│   │   ├── auth.middleware.js    <-- HttpOnly Cookie & Role Verification (RBAC)
│   │   └── error.middleware.js   <-- Central error handler (DNIA Vol 1)
│   ├── services/
│   │   ├── auth.service.js       <-- Shift calculator 07:00/20:30 & JWT service
│   │   ├── sidecar.service.js    <-- FastAPI Inference Engine orchestrator
│   │   ├── dandori.service.js    <-- Kanban QR parser & Part Number locking
│   │   ├── calibration.service.js<-- Master jig scale & POKAYOKE part detection
│   │   ├── tray.service.js       <-- Batch Ingestion 18 Pocket & KPI Metrics
│   │   ├── alarm.service.js      <-- POKAYOKE Interlock, Leader verify & Manual Override
│   │   └── history.service.js    <-- Daily CSV Logger, Image Router & QC Server Sync (Fase 5)
│   ├── controllers/
│   │   ├── auth.controller.js    <-- Controller Autentikasi
│   │   ├── system.controller.js  <-- Controller Settings, Images, Models
│   │   ├── process.controller.js <-- Controller AI Process
│   │   ├── dandori.controller.js <-- Controller Dandori Kanban
│   │   ├── calibration.controller.js <-- Controller Kalibrasi Master Jig
│   │   ├── tray.controller.js    <-- Controller Batch Tray & Pocket Ingestion
│   │   ├── alarm.controller.js   <-- Controller Alarm Interlock
│   │   └── history.controller.js <-- Controller History, CSV Download & QC Transfer (Fase 5)
│   └── routes/
│       ├── auth.routes.js
│       ├── system.routes.js
│       ├── process.routes.js
│       ├── dandori.routes.js
│       ├── calibration.routes.js
│       ├── tray.routes.js
│       ├── alarm.routes.js
│       ├── history.routes.js     <-- Route API History & Transfer (Fase 5)
│       └── index.js              <-- Aggregator route API
├── models/
│   └── best.pt                   <-- Model YOLOv8x-pose (Aktif di RAM Sidecar)
├── config.json                   <-- Toleransi Denso, scale (0.02185) & storage options
└── server.js                     <-- Entry point ramping (Helmet + CORS Credentials)
```

*Dokumen ini merupakan catatan resmi penyelesaian sistem AI X-Ray Auto Measurement PT. Denso Indonesia (3rd Factory) — Seluruh Fase 1 s.d. 5 telah 100% tuntas.*
