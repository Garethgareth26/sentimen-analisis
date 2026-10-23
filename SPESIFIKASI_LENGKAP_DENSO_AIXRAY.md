# 📋 DOKUMEN SPESIFIKASI KOMPREHENSIF & PANDUAN PENGEMBANGAN SISTEM
# AI X-RAY AUTO MEASUREMENT (PT. DENSO INDONESIA)

> **Referensi Utama:** `general-req-aixray.docx` (*DX Requirement Sheet PT. Denso Indonesia, 3rd Factory*)  
> **Laporan Retraining AI:** `LAPORAN_LENGKAP_RETRAINING_AI_XRAY_DENSO_PHASE4.md`  
> **Lokasi Workspace Produksi:** `C:\Users\LENOVO\Downloads\aixray-20260917T002514Z-1-001\aixray-clean`

---

## 🏢 1. Informasi Umum & Latar Belakang (Baseline)
- **Nama Aplikasi:** X-ray app auto measurement (AI Inspection System)
- **Klien / Pabrik:** PT. Denso Indonesia, 3rd Factory (Jl. Selayar III Blok K-2, MM2100 Cikarang Barat)
- **Tipe Aplikasi:** Industrial Desktop Web App (Node.js Express + Python FastAPI Sidecar + React Vite)
- **Latar Belakang:**  
  Pengukuran posisi IC pada proses X-Ray sebelumnya masih menggunakan metode manual dengan menempelkan film jig berskala pada monitor. Kelemahan fatal metode manual ini adalah:
  1. Risiko *human error / miss judgment* oleh operator (MP).
  2. Risiko part cacat lolos ke pelanggan (*flow out*) karena **belum adanya sistem POKAYOKE / interlock**.
- **Target & Tujuan Sistem:**
  1. Otomasi pengukuran posisi IC di housing part secara akurat dengan konversi citra (pixel ke mm).
  2. Auto-judgement **OK** vs **NG** berdasarkan toleransi standar.
  3. Sistem **POKAYOKE** dan antarmuka Alarm/Interlock saat terjadi NG untuk mencegah part lolos.
  4. Kompatibel dengan sinyal PLC untuk interlock mesin fisik di masa depan.
  5. Penanganan alarm standar DENSO: indikasi nama alarm, stasiun, reset via QR Leader, dan auto interlock.

---

## 📊 2. Matriks 14 Fitur Kebutuhan (DX Requirement Sheet)

| No | Fitur | Kategori | Detail Spesifikasi & Alur Kerja | Role Akses |
|---|---|---|---|---|
| **1** | **Calibration** | Menu & Modal | Kalibrasi pixel ke mm menggunakan master jig (pin gauge 0.02185 mm/px). Dilakukan 1x/hari setiap **Day Shift**. Jika part terpasang saat kalibrasi, sistem memberi peringatan error. | Operator, TL, Admin |
| **2** | **Qty Counter** | Display KPI | Menampilkan counter produk harian: Total Product, OK Qty, NG Qty, NG Ratio %, OK Ratio %. Di-reset otomatis setiap hari (pukul 07:00). | Semua User |
| **3** | **CT Actual vs Target** | Display KPI | Menampilkan Cycle Time aktual pemrosesan AI vs Target CT mesin X-Ray Denso. | Semua User |
| **4** | **History Output** | Menu & Storage | Penyimpanan log inspeksi dalam format **CSV harian** (1 file per hari). Mencatat: Date, Time, Operator Name, NPK, Part Number, Sequence, Measurement Result per Pocket/Station, Judgment, dan link citra terkompresi. | Semua User |
| **5** | **Option Save Data** | Setting | Pilihan penyimpanan gambar hasil inspeksi: **1. All Images**, **2. NG Only**, **3. OK Only**. Folder penyimpanan dipisahkan secara otomatis. Data CSV selalu tersimpan 100%. | Admin |
| **6** | **Menu Learning AI** | Menu & Modal | Modul re-train / review sample gambar dari data history untuk perbaikan AI. Memerlukan autentikasi khusus tim PE (Process Engineer) melalui **Scan QR**. | Admin, PE |
| **7** | **Transfer History Data** | Service | Fitur ekspor/sinkronisasi folder riwayat CSV dan gambar ke server/PC lain yang aman untuk analisis QC/PED. | Admin |
| **8** | **Menu Login & Shift** | Menu & Auth | Operator wajib login dengan **Nama & NPK** atau **Scan QR ID Card**. Dilengkapi **Auto-Logout Otomatis** pada pergantian shift (pukul **07:00** pagi dan **20:30** malam). | Semua User |
| **9** | **Alarm / Abnormality Handling** | Pop-up / Interlock | Tampilan pop-up alarm saat terjadi NG yang **memblokir operasional**: menampilkan nama alarm, stasiun/pocket yang NG, dan nilai ukurnya. Hanya bisa di-reset dengan **Scan QR Leader/TL**. Opsi Leader: Reset & continue, Re-measure, atau Manual Measure. | TL, Admin |
| **10** | **Position Adjustment** | Engine AI | Fitur penyesuaian otomatis jika posisi part tidak persis berada di tengah jig. | Otomatis (AI) |
| **11** | **Format Gambar Input** | I/O | Menerima citra otomatis dari mesin capture dalam format **JPG** dan **PNG**. | Sistem |
| **12** | **Manual Measurement** | Modal Tool | Fitur pengukuran manual dengan menarik garis antara titik A dan titik B di layar. Nilai jarak langsung dikonversi ke mm secara *live* untuk verifikasi ulang saat evaluasi NG atau re-check. | TL, Admin |
| **13** | **Role-Based Access** | Security | 3 Level Pengguna:<br>• **Operator**: Login, operasi inspeksi normal, kalibrasi Day Shift.<br>• **TL (Team Leader)**: Akses operator + re-check, manual measure, reset alarm NG via QR.<br>• **Admin**: Akses penuh termasuk Setting folder, I/O PLC, Learning AI, dan konfigurasi threshold. | Operator, TL, Admin |
| **14** | **Dandori (Changeover)** | Menu & Scan | Pergantian Part Number (P/N) dilakukan instan hanya dengan **Scan QR Kanban**. P/N aktif, batas toleransi, dan parameter inspeksi langsung terkunci otomatis. | Operator, TL, Admin |

---

## 🎨 3. Spesifikasi UI/UX & Desain Mockup Sesuai Dokumen Denso

### A. Halaman Login (`docs/mockups/image10.jpeg`)
* **Gaya Visual:** Modern Clean Industrial Tech, Glassmorphic White Card di atas latar belakang biru muda bergradasi halus dengan pola sirkuit mikro.
* **Elemen Sisi Kiri (Form):**
  - Header: Logo Aperture/Eye Cyan + *"AI INSPECTION SYSTEM"* (Subtitle: *"Smart X-Ray Inspection for Quality Assurance"*).
  - Kartu Login Putih Melayang:
    - Field 1: Ikon Profil + Label **NAMA** (Input nama operator).
    - Field 2: Ikon Kartu ID + Label **NPK** (Input NPK atau auto-fill via barcode scanner).
    - Tombol: Gradien Cyan-Teal besar bertuliskan **`MASUK KE SISTEM`** dengan ikon panah login.
    - Opsi tombol cepat: **Scan QR ID Card**.
  - Footer Tagline: Ikon Perisai + *"Quality First, Always. AI Technology • Accurate Inspection • Reliable Results"*.
* **Elemen Sisi Kanan (Hero Graphic):**
  - Render citra X-Ray IC chip resolusi tinggi di dalam housing part.
  - Reticle HUD lingkaran, badge *"X-RAY INSPECTION"*, *"PASS RATE 98.6%"*, dan indikator *"DETECTION OK"*.

### B. Dashboard Utama (`docs/mockups/image11.png`)
* **Header Atas (Status Bar):**
  - Sisi Kiri: Logo Perusahaan (Denso).
  - Sisi Kanan: Nama Operator (`Name`), Status Shift (`Day/Night`), Jam & Tanggal (`Date & Time`), Part Number Aktif (`Part Number`), Tombol `Setting` (Ikon Gear).
* **Ribbon Bar KPI & Aksi Cepat:**
  - Tombol Navigasi: `Calibration` (Hanya aktif Day Shift), `History`.
  - Kartu Ringkasan Produksi:
    - `Total Product` (Angka counter harian)
    - `OK Qty` (Hijau)
    - `NG Qty` (Merah tebal)
    - `NG Ratio %` & `Ratio OK %`
    - `Loss Time`
    - `Target CT` vs `Actual CT` (Cycle Time real-time)
* **Panel Kiri — Grid 18 Stasiun / Pocket (`st1` s/d `st18`):**
  - Terdiri dari 3 baris x 6 kolom kartu saku/pocket inspeksi:
    - Baris 1: `st1`, `st2`, `st3`, `st4`, `st5`, `st6`
    - Baris 2: `st7`, `st8`, `st9`, `st10`, `st11`, `st12`
    - Baris 3: `st13`, `st14`, `st15`, `st16`, `st17`, `st18`
  - Setiap kartu menampilkan: Nomor Stasiun (`st X`), Badge Status (`OK` hijau / `NG` merah), dan Nilai Ukur (`Value: X.XX mm`).
  - Kartu dapat diklik untuk menampilkan detail gambar stasiun tersebut di panel tengah.
* **Panel Tengah — Area Inspeksi Citra (Viewport):**
  - Penampil citra X-Ray besar dengan overlay bounding box dan garis pengukuran Point A ke Point B.
  - Tombol kontrol di bawah gambar: `Zoom In`, `Zoom Out`, `Fit Screen`.
* **Panel Kanan — Kontrol & Hasil Inspeksi:**
  - Parameter Standar: `Std: 1 +0.7 -0.3` (Batas bawah 0.7 mm s/d 1.7 mm / konfigurasi aktual 0.89 - 1.61 mm).
  - Status Judgement: Banner besar **OK** (Hijau) atau **NG** (Merah).
  - Dimensi: Nilai pengukuran aktual (`Dimension: X.XXX mm`).
  - Indikator Stasiun: Stasiun yang sedang aktif (`Station: stX`).
  - Tombol Operasional:
    - `Re-check` | `Learning AI`
    - Navigasi: `Prev` | `Next`
    - `Manual Measurement` (Buka modal ukur manual garis A-B)
    - `QR Reset NG` (Hanya bisa dibuka Leader saat terjadi NG)

### C. Modal Pengukuran Manual (`docs/mockups/image12.png`)
- Menampilkan gambar part per-stasiun.
- Operator/Leader dapat mengklik 2 titik di atas gambar (Titik A dan Titik B) membentuk garis ukur merah.
- Nilai jarak dalam milimeter langsung dihitung dan ditampilkan di kotak `Value Live`.
- Tombol navigasi `Back` dan `Fwd` untuk beralih antar pocket, serta tombol `Close`.

### D. Modal Kalibrasi Harian (`docs/mockups/image13.png`)
- Penampil gambar master jig kalibrasi (`For image live and capture image`).
- Tombol `Get Image` untuk mengambil gambar jig dari mesin.
- Tombol `Tarik Garis`, field `Masuk Nilai` dan `Unit` (misal 0.898 mm).
- Kotak `Value Live` menampilkan skala saat ini.
- Tombol `Register` untuk menyimpan skala baru ke konfigurasi sistem.

### E. Modal Pengaturan / Setting (`docs/mockups/image15.png`)
- Tab Navigasi Kiri: `Save Image`, `I/O (PLC)`, `Program Files (Path Model)`.
- Panel Pengaturan Save Image:
  - Input `Storage Location` (Folder path).
  - Pilihan `Save Image Judgement`: Radio/Dropdown [**All** / **NG Only** / **OK Only**].
  - Pilihan `Format Save Image`: [**PNG** / **JPG**].

### F. Pop-up Alarm & POKAYOKE NG (`docs/mockups/image16.png` & `image8.png`)
- Jika hasil pengukuran stasiun mana pun bernilai **NG**, sistem seketika membunyikan alarm dan memunculkan pop-up merah pekat di atas layar.
- Tabel Error: Kolom `Nama Alarm/Part`, `Station`, dan `Judge` (NG).
- Sistem terkunci (*interlock*). Tombol operasi dibekukan.
- Leader harus melakukan **Scan QR Leader** untuk membuka kunci alarm. Leader kemudian dapat memilih: Remeasure, Manual Measure, atau Release Interlock.

---

## 🛣️ 4. Roadmap 5 Fase Pengembangan

### 🟥 FASE 1 — Foundation & Authentication (Target Aktif Saat Ini)
1. **Sistem Role & Auth Backend:**
   - Model akun: Operator, TL (Team Leader), Admin.
   - Endpoint autentikasi (Nama + NPK dan QR Code Token).
   - Middleware hak akses Role di Express backend.
2. **Halaman Login UI Modern (Sesuai Mockup `image10.jpeg`):**
   - Form input Nama + NPK dengan validasi.
   - Fitur Scan QR ID card.
   - Desain visual glassmorphic modern Denso.
3. **Mekanisme Auto-Logout Shift (Sesuai `image3.png`):**
   - Scheduler di background mendeteksi waktu pergantian shift: **07:00** dan **20:30**.
   - Otomatis me-logout sesi aktif dan mengembalikan layar ke halaman Login.
4. **Layout Dashboard Modular & Header Status:**
   - Navigasi header atas (Logo, Info Operator, Shift Day/Night, Part Number aktif, Jam).
   - Sidebar/menu modular dengan pembatasan hak akses sesuai role.

### 🟧 FASE 2 — Kalibrasi Jig, Dandori Kanban & Input Gambar
1. **Menu & Flow Kalibrasi Harian (`image4.png` & `image13.png`):**
   - Logika pembeda: Menu kalibrasi hanya wajib dijalankan pada **Day Shift**.
   - Interaksi UI tarik garis kalibrasi pin gauge master jig.
   - Validasi error jika gambar bukan berupa jig kalibrasi.
2. **Fitur Dandori (Changeover via QR Kanban):**
   - Pemindai QR barcode kanban produksi.
   - Mengunci Part Number aktif, batas toleransi, dan parameter model otomatis.
3. **Penerimaan Citra:**
   - Dukungan auto-capture file JPG dan PNG dari folder input X-Ray.

### 🟨 FASE 3 — AI Measurement Engine & Grid 18 Stasiun
1. **FastAPI Persistent Sidecar (Sudah Siap di Backend):**
   - Eksekusi model YOLOv8x-Pose `best.pt` dengan kecepatan inferensi < 1 detik.
2. **Grid UI 18 Pocket Stasiun (`st1` s/d `st18`):**
   - Layout 18 kartu pocket dengan badge status OK/NG dan nilai mm aktual.
   - Sinkronisasi viewport gambar saat kartu stasiun diklik.
3. **Display KPI Produksi:**
   - Qty Counter: Total, OK, NG, Ratio % (reset otomatis per hari).
   - Indikator perbandingan CT Target vs CT Aktual.

### 🟩 FASE 4 — Alarm POKAYOKE & Manual Measurement
1. **POKAYOKE Interlock Pop-up (`image16.png` & `image8.png`):**
   - Pop-up alarm saat terjadi NG yang membekukan operasi.
   - Verifikasi otorisasi via **Scan QR Leader** untuk reset alarm.
   - Alur verifikasi: Double Check / Remeasure / Manual Measure.
2. **Modal Pengukuran Manual (`image12.png`):**
   - Kanvas interaktif untuk menarik garis 2 titik (A ke B) konversi pixel ke mm secara *live*.

### 🟦 FASE 5 — Traceability, Logging CSV & Server Sync
1. **Logging CSV Harian:**
   - Format standar Denso: 1 file per hari dengan struktur data lengkap.
2. **Pengaturan Penyimpanan Citra:**
   - Filter penyimpanan: All Images / NG Only / OK Only.
   - Kompresi citra inspeksi.
3. **Sinkronisasi Data ke Server QC:**
   - Modul transfer data berkala ke PC server PED/QC.

---

## 🛠️ 5. Detail Teknis Arsitektur (Tech Stack)
- **Frontend:** React 18, Vite, Vanilla CSS modern (Glassmorphism, CSS Grid, Flexbox, Micro-animations), Lucide Icons / SVG, Axios.
- **Backend:** Node.js (v18+), Express.js, JWT Authentication, Multer, Node-cron (Shift auto-logout).
- **AI Engine Sidecar:** Python 3.10+, FastAPI, Uvicorn, Ultralytics YOLOv8x-pose, OpenCV (`cv2`), NumPy.
- **Konfigurasi Aktif:**
  - Skala Kalibrasi: `0.02185 mm/px`
  - Toleransi Ukur: `0.89 mm - 1.61 mm` (Standar Denso)
  - Mode Input AI: `full_raw` (Wajib dipertahankan untuk menjaga akurasi deteksi keypoint).
