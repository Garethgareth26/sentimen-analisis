# 🛠️ PANDUAN LENGKAP SETUP & MIGRASI KE DEVICE BARU
## AI X-Ray Auto Measurement System (PT. Denso Indonesia)

Panduan ini digunakan jika seluruh folder project **`aixray-clean`** disalin atau dipindahkan ke komputer/laptop/PC Industrial lain di lini produksi.

---

## 📋 1. Software Prasyarat (Wajib Terinstall di Komputer Baru)

Hanya ada **2 Software Utama** yang perlu diinstall:

| Software | Versi Rekomendasi | Keterangan & Link Download |
| :--- | :--- | :--- |
| **Node.js** | **v18.x** atau **v20.x (LTS)** | Runtime backend & frontend. Download: [nodejs.org](https://nodejs.org/) (Pilih versi LTS). |
| **Python** | **3.10** atau **3.11** | Mesin komputasi AI. Download: [python.org](https://www.python.org/) atau via Anaconda. |

> [!IMPORTANT]
> **PENTING saat Install Python di Windows:**  
> Pada layar pertama installer Python, **WAJIB CENTANG** kotak checkbox:  
> ☑️ **`Add python.exe to PATH`**  
> agar perintah `python` dan `pip` dapat dipanggil dari mana saja di CMD.

---

## ⚡ 2. Cara Cepat (Hanya 1 Kali Install Dependencies)

Setelah software di atas terinstall, buka Command Prompt (CMD) di folder project:

### Langkah A: Install Pustaka Python AI (Sekali Saja)
Buka CMD di folder `backend`, lalu ketik:
```cmd
cd backend
pip install -r requirements.txt
```
*(Paket yang diinstall: `ultralytics`, `opencv-python`, `numpy`, `fastapi`, `uvicorn`, `psutil`, `matplotlib`).*

---

### Langkah B: Menjalankan Sistem (Tinggal Double Click)
Setelah langkah A selesai, Anda **cukup klik 2 file `.bat`** di folder utama:

1. **Klik ganda `start_backend.bat`**
   - Otomatis menginstall library Node.js backend (jika belum ada).
   - Menjalankan server backend Express (Port `5000`).
   - Otomatis menyalakan FastAPI Inference Engine AI (Port `5001`).
2. **Klik ganda `start_frontend.bat`**
   - Otomatis menginstall library React/Vite (jika belum ada).
   - Menjalankan server web dashboard (Port `5173`).
3. **Buka Browser (Chrome / Edge):**
   - Akses: **`http://localhost:5173`**

---

## 💻 3. Cara Manual via Terminal / CMD (Alternatif Developer)

Jika ingin menjalankan secara terpisah melalui terminal/command prompt:

### Terminal 1: Backend & AI Engine
```cmd
cd c:\path\ke\aixray-clean\backend
npm install
npm start
```
*(Output akan menampilkan: `Backend API running at http://localhost:5000` dan `[Sidecar] Health OK — Inference Engine Persisten Siap!`)*

### Terminal 2: Frontend UI
```cmd
cd c:\path\ke\aixray-clean\frontend
npm install
npm run dev
```
*(Akses URL yang muncul: `http://localhost:5173`)*

---

## ❓ FAQ & Troubleshooting di Device Baru

1. **`'python' is not recognized as an internal or external command`**
   - Solusi: Python belum masuk ke sistem PATH Windows. Install ulang Python dan pastikan centang opsi *"Add python.exe to PATH"*.

2. **Apakah butuh GPU NVIDIA di komputer baru?**
   - **TIDAK WAJIB.** Model YOLOv8x-pose sudah dioptimasi khusus untuk CPU Intel (Cycle Time stabil ~0.7 detik, jauh di bawah standar Denso 1.2 detik).
   - Jika PC baru memiliki GPU NVIDIA, sistem akan otomatis mendeteksinya dan berjalan lebih cepat lagi (~0.08 detik).

3. **Apakah data login operator & history CSV ikut terbawa?**
   - **YA.** Seluruh data konfigurasi (`config.json`), user operator default, model AI (`models/best.pt`), dan riwayat CSV di folder `logs/` ikut terbawa saat Anda menyalin seluruh folder `aixray-clean`.
