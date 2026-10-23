# 📐 SPESIFIKASI LOGIKA KEMIRINGAN HOUSING & PENGUKURAN ORTOGONAL (90°)
**Proyek:** AI X-Ray Auto Measurement (PT. Denso Indonesia, 3rd Factory)  
**Dokumen Referensi:** Temuan Validasi & Feedback User (20 Oktober 2026)  
**Status:** Siap Diimplementasikan (Rencana Eksekusi Besok)

---

## 📌 1. Latar Belakang & Masalah

### A. Temuan pada Citra `0.506.jpg`
Pada pengujian sebelumnya, citra `0.506.jpg` menghasilkan teks:
```text
Tilt: 0.00 deg (Kotak Luar Lurus)
```
dan garis pengukuran Resin Up & Down digambar vertikal murni tegak lurus layar monitor, padahal bodi part sebenarnya mengalami kemiringan fisik (*housing tilt*).

### B. Hasil Investigasi Penyebab (Root Cause)
1. Algoritma pendeteksi kemiringan lama hanya memindai rentang $x$ yang terlalu sempit di sekitar ujung pin ($x \in [x_{\text{tip}}+15, x_{\text{tip}}+80]$).
2. Di rentang tersebut, pada sisi bawah ($y \approx 472$) terdapat **bayangan kawat metal internal** di dalam resin.
3. Fungsi gradien intensitas sederhana terkecoh mendeteksi kawat metal internal tersebut alih-alih tepi luar resin ($y \approx 534$).
4. Akibatnya, slope atas dan slope bawah tidak konsisten, memicu proteksi *safety fallback* yang memaksa sudut rotasi menjadi $0.00^\circ$.

---

## 🔍 2. Definisi Geometris Sesuai Arahan User (2 Gambar Anotasi)

Berdasarkan perbandingan dua gambar yang ditandai oleh user:

| Parameter Geometris | Gambar 1 (`0.506.jpg` - Part Miring) | Gambar 2 (`0.687.jpg` - Part Lurus) |
|---|---|---|
| **Kontur Bodi Luar (Garis Biru)** | Miring ke kanan bawah ($\theta \approx +2.6^\circ$) | Lurus horizontal ($\theta \approx 0.0^\circ$) sejajar garis jig merah |
| **Garis Gap Aksial (Point A $\rightarrow$ B)** | Miring mengikuti sumbu bodi luar ($\theta$) | Lurus horizontal |
| **Garis Resin Up & Down (Transversal)** | **Tegak lurus ($90^\circ$) terhadap kemiringan bodi luar** ($\theta + 90^\circ$) | Tegak lurus vertikal ($90^\circ$) |
| **Relasi Ortogonalitas** | **$\vec{v}_{\text{axial}} \cdot \vec{n}_{\text{transverse}} = 0$ (Pasti $90.00^\circ$)** | **$\vec{v}_{\text{axial}} \cdot \vec{n}_{\text{transverse}} = 0$ (Pasti $90.00^\circ$)** |

### Ketentuan Posisi Garis Ukur:
1. **Garis Gap (Horizontal Aksial):** Ditarik dari dinding datum housing ke sudut maju terdepan pin IC (*frontmost tip*).
2. **Garis Resin Atas (Up):** Berada di atas kotak hitam bodi pin IC (offset $dx \approx 8\text{ px}$ dari ujung maju), **menempel di permukaan atas pin** (tidak ngambang) dan ditarik tegak lurus ke tepi resin atas.
3. **Garis Resin Bawah (Dn):** Berada di sisi terluar undakan bawah (offset $dx \approx 14\text{ px}$ dari ujung maju), **menempel di permukaan bawah pin** (tidak ngambang) dan ditarik tegak lurus ke tepi resin bawah.
4. **Badan Pin IC:** Di antara permukaan atas dan permukaan bawah pin **TIDAK DILEWATI/DIPOTONG GARIS UKUR MERAH**.

---

## 🧪 3. Hasil Pengujian Matematis (*Outside-In Boundary Scanning*)

Untuk mencegah sensor terkecoh oleh kawat/komponen di dalam resin, pemindaian dilakukan **dari luar ke dalam (*outside-in*)**:
- **Tepi Atas:** Memindai dari udara luar atas ke bawah menuju resin $\rightarrow$ titik batas pertama adalah **kulit bodi atas**.
- **Tepi Bawah:** Memindai dari udara luar bawah ke atas menuju resin $\rightarrow$ titik batas pertama adalah **kulit bodi bawah**.

### A. Pengujian Nyata pada Citra `0.506.jpg` (Rentang Leher Housing $x = 100 \text{ s/d } 340$)
```text
x=100 -> y_top=386, y_bot=532 | Ketebalan Leher = 146 px
x=140 -> y_top=387, y_bot=534 | Ketebalan Leher = 147 px
x=180 -> y_top=390, y_bot=536 | Ketebalan Leher = 146 px
x=220 -> y_top=391, y_bot=537 | Ketebalan Leher = 146 px
x=260 -> y_top=394, y_bot=539 | Ketebalan Leher = 145 px
x=300 -> y_top=396, y_bot=541 | Ketebalan Leher = 145 px
x=340 -> y_top=397, y_bot=543 | Ketebalan Leher = 146 px
```
- **Ketebalan leher housing:** Konstan $145 - 146\text{ px}$ sepanjang $240\text{ px}$.
- **Slope Tepi Atas ($s_{\text{top}}$):** $+0.0458 \rightarrow \mathbf{+2.62^\circ}$
- **Slope Tepi Bawah ($s_{\text{bot}}$):** $+0.0458 \rightarrow \mathbf{+2.62^\circ}$
- **Korelasi Paralelitas:** $100\%$ paralel sempurna!

### B. Pengujian Nyata pada Citra `0.687.jpg` (Part Lurus Normal)
```text
x=100 -> y_top=392, y_bot=551 | Ketebalan Leher = 159 px
x=160 -> y_top=392, y_bot=550 | Ketebalan Leher = 158 px
x=240 -> y_top=389, y_bot=555 | Ketebalan Leher = 166 px
x=320 -> y_top=390, y_bot=555 | Ketebalan Leher = 165 px
```
- **Slope Tepi Atas & Bawah:** Rata-rata sudut $\approx +0.2^\circ$.
- **Hasil:** Berada di bawah toleransi deadband ($< 1.0^\circ$), otomatis terkunci stabil pada **$0.00^\circ$ (Kotak Luar Lurus)**.

---

## 📐 4. Rumus Geometris & Vektor Rotasi Ortogonal

Setelah sudut kemiringan bodi luar $\theta$ diperoleh dari rata-rata slope leher:
$$\theta = \arctan\left(\frac{s_{\text{top}} + s_{\text{bot}}}{2}\right)$$

Dua vektor ortogonal dibentuk:
1. **Vektor Aksial (Sumbu Sejajar Bodi Luar):**
   $$\vec{v}_{\text{axial}} = \begin{bmatrix} \cos\theta \\ \sin\theta \end{bmatrix}$$
2. **Vektor Transversal (Sumbu Tegak Lurus $90^\circ$ Terhadap Bodi Luar):**
   $$\vec{n}_{\text{transverse}} = \begin{bmatrix} -\sin\theta \\ \cos\theta \end{bmatrix}$$

### Pembuktian Ortogonalitas (Tegak Lurus Mutlak):
$$\vec{v}_{\text{axial}} \cdot \vec{n}_{\text{transverse}} = (\cos\theta)(-\sin\theta) + (\sin\theta)(\cos\theta) = 0.000000$$
Artinya, garis pengukuran Gap dan garis Resin Up/Down dijamin **selalu tegak lurus siku-siku $90^\circ$ sempurna** terhadap bodi housing, berapapun sudut kemiringan part-nya.

---

## 🚀 5. Rencana Langkah Kerja Lanjutan (Untuk Dijalankan Besok)

1. **Perbarui Fungsi `detect_housing_tilt_and_measure` di [auto_anchor_measure.py](file:///c:/Users/LENOVO/Downloads/aixray-clean/backend/python/auto_anchor_measure.py):**
   - Terapkan pemindaian *Outside-In Boundary Scanning* pada leher housing ($x \in [120, 360]$).
   - Hubungkan sudut kemiringan $\theta$ ke $\vec{v}_{\text{axial}}$ dan $\vec{n}_{\text{transverse}}$.
   - Pastikan titik `p_pin_top` (offset $8\text{ px}$) dan `p_pin_bot` (offset $14\text{ px}$) tetap menempel di permukaan pin.
2. **Sinkronisasi FastAPI Sidecar (`inference_server.py`):**
   - Reload / restart service sidecar port `5001`.
3. **Uji Validasi Visual & Numerik:**
   - Eksekusi pada citra `0.506.jpg` $\rightarrow$ verifikasi bahwa sudut membaca $\approx +2.6^\circ$ dan garis Up/Dn miring tegak lurus bodi.
   - Eksekusi pada citra `0.687.jpg` $\rightarrow$ verifikasi bahwa sudut membaca $0.00^\circ$ (stabil tidak over-correct).
   - Periksa gambar hasil di `backend/output/` bersama user.

---
*Dokumen ini dibuat otomatis sebagai panduan kerja dan checkpoint status proyek sebelum dilanjutkan pada sesi berikutnya.*
