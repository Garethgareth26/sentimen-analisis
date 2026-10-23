"""
export_excel_sync.py — Sinkronisasi Data Uji & Gambar ke File Excel Template Denso
================================================================================
File Target:
C:\\Users\\LENOVO\\Downloads\\aixray-clean\\X-Ray_Hybrid_Keypoint_Measurement-update.xlsx

Format Sheet:
- Sheet "OK": Data Sample OK (Header Baris 4 hijau #2E9E5B, Data mulai Baris 5)
- Sheet "NG": Data Sample NG (Header Baris 5 merah/coral #C0392B, Data mulai Baris 6)
- Sheet "New-OK&NG": Data Sample Baru (Header Baris 4, Data mulai Baris 5)

Fitur:
- Pembuatan composite card (Dropdown header + raw image untuk Col B, Pill + Box info + overlay image untuk Col C)
- Pengosongan data lama (--clear-old) agar data fresh dimulai dari baris No 1
- Dukungan single record maupun batch sync
"""

import sys
import os
import json
import argparse
from pathlib import Path
import openpyxl
from openpyxl.drawing.image import Image as OpenpyxlImage
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from PIL import Image as PILImage, ImageDraw, ImageFont

DEFAULT_EXCEL_PATH = r"C:\Users\LENOVO\Downloads\aixray-clean\X-Ray_Hybrid_Keypoint_Measurement-update.xlsx"
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
INPUT_DIR = BACKEND_DIR / "input"
OUTPUT_DIR = BACKEND_DIR / "output"
CACHE_DIR = BACKEND_DIR / "output" / "excel_cards_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── Styling Sesuai Format Template Asli Denso ────────────────────────────────
FILL_SOFT_GREEN = PatternFill(start_color="FFE2EFDA", end_color="FFE2EFDA", fill_type="solid")
FILL_SOFT_RED = PatternFill(start_color="FFFCE4D6", end_color="FFFCE4D6", fill_type="solid")
FILL_SOFT_BLUE = PatternFill(start_color="FFDDEBF7", end_color="FFDDEBF7", fill_type="solid")
FILL_GRAY = PatternFill(start_color="FFF2F2F2", end_color="FFF2F2F2", fill_type="solid")

FONT_STATUS_OK = Font(name="Arial", size=11, bold=True, color="FF27AE60")
FONT_STATUS_NG = Font(name="Arial", size=11, bold=True, color="FFC0392B")
FONT_VAL_BOLD = Font(name="Arial", size=11, bold=True, color="FF000000")
FONT_NORM = Font(name="Arial", size=10, bold=False, color="FF000000")
FONT_PLACEHOLDER = Font(name="Arial", size=9, bold=False, color="FF9C9C9C")
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_LEFT = Alignment(horizontal="left", vertical="center")
THIN_BORDER = Border(
    left=Side(style="thin", color="FFB7B7B7"),
    right=Side(style="thin", color="FFB7B7B7"),
    top=Side(style="thin", color="FFB7B7B7"),
    bottom=Side(style="thin", color="FFB7B7B7"),
)

def get_font(size=12, bold=False):
    """Coba muat font sistem Arial / Segoe UI, fallback ke default"""
    try:
        font_path = "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"
        if os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)
    except Exception:
        pass
    try:
        return ImageFont.load_default()
    except Exception:
        return None


def generate_manual_card(img_path, filename, width=420):
    """
    Membuat kartu komposit untuk Kolom B (Gambar Manual Original):
    - Header dropdown box dengan nama file (misal '0.836.jpg') & ikon chevron
    - Gambar asli di bawahnya dengan border rapi
    """
    cache_path = CACHE_DIR / f"manual_{Path(filename).stem}.png"
    
    img = PILImage.open(img_path).convert("RGBA")
    aspect = img.height / img.width
    img_w = width - 16
    img_h = int(img_w * aspect)
    img_resized = img.resize((img_w, img_h), PILImage.Resampling.LANCZOS)

    total_h = img_h + 52
    card = PILImage.new("RGBA", (width, total_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(card)

    font_text = get_font(13, bold=False)

    # 1. Header Dropdown Box
    draw.rounded_rectangle([8, 8, width - 8, 42], radius=6, fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=2)
    draw.text((20, 16), filename, fill=(15, 23, 42, 255), font=font_text)
    # Ikon panah bawah chevron
    cx = width - 24
    draw.polygon([(cx - 6, 22), (cx + 6, 22), (cx, 28)], fill=(100, 116, 139, 255))

    # 2. Gambar Asli di bawahnya
    card.paste(img_resized, (8, 46))
    
    # Border halus sekitar gambar
    draw.rectangle([8, 46, 8 + img_w, 46 + img_h], outline=(203, 213, 225, 255), width=1)

    card.save(cache_path, "PNG")
    return cache_path


def generate_ai_card(img_path, judgement, distance_mm, confidence=0.535, width=420):
    """
    Membuat kartu komposit untuk Kolom C (Gambar Hasil AI Overlay):
    - Top Pill Badge (Merah/Hijau): NG — 2.065 mm / OK — 1.438 mm
    - Box 1: Method used: YOLO Keypoint Detection | AI confidence: X.XXX
    - Box 2: Keterangan deteksi point A dan point B
    - Gambar hasil AI overlay di bawahnya
    """
    cache_path = CACHE_DIR / f"ai_{Path(img_path).stem}_{judgement}_{int(distance_mm*1000)}.png"
    
    img = PILImage.open(img_path).convert("RGBA")
    aspect = img.height / img.width
    img_w = width - 16
    img_h = int(img_w * aspect)
    img_resized = img.resize((img_w, img_h), PILImage.Resampling.LANCZOS)

    total_h = img_h + 168
    card = PILImage.new("RGBA", (width, total_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(card)

    font_pill = get_font(18, bold=True)
    font_small = get_font(11, bold=False)

    # 1. Top Pill Status Badge (OK hijau, NG merah)
    pill_text = f"{judgement} — {distance_mm:.3f} mm"
    if judgement == "OK":
        pill_fill = (220, 252, 231, 255)
        pill_outline = (134, 239, 172, 255)
        text_color = (21, 128, 61, 255)
    else:
        pill_fill = (254, 226, 226, 255)
        pill_outline = (252, 165, 165, 255)
        text_color = (185, 28, 28, 255)

    draw.rounded_rectangle([8, 8, width - 8, 48], radius=8, fill=pill_fill, outline=pill_outline, width=2)
    # Centered text menggunakan bounding box
    bbox = draw.textbbox((0, 0), pill_text, font=font_pill)
    text_w = bbox[2] - bbox[0]
    text_x = max(10, (width - text_w) // 2)
    draw.text((text_x, 15), pill_text, fill=text_color, font=font_pill)

    # 2. Box Info 1: Method & Confidence
    draw.rounded_rectangle([8, 54, width - 8, 92], radius=8, fill=(236, 253, 245, 255), outline=(167, 243, 208, 255), width=1)
    draw.text((16, 60), "Method used: YOLO Keypoint Detection | AI confidence:", fill=(6, 95, 70, 255), font=font_small)
    draw.text((16, 74), f"{confidence:.3f}", fill=(6, 95, 70, 255), font=font_small)

    # 3. Box Info 2: Keterangan Keypoint
    draw.rounded_rectangle([8, 98, width - 8, 152], radius=8, fill=(236, 253, 245, 255), outline=(167, 243, 208, 255), width=1)
    draw.text((16, 104), "AI Keypoint berhasil mendeteksi Point A dan Point B.", fill=(6, 95, 70, 255), font=font_small)
    draw.text((16, 119), "OpenCV hanya dipakai untuk crop, overlay, distance,", fill=(6, 95, 70, 255), font=font_small)
    draw.text((16, 134), "dan OK/NG judgement.", fill=(6, 95, 70, 255), font=font_small)

    # 4. Gambar Overlay AI di bawahnya
    card.paste(img_resized, (8, 160))
    draw.rectangle([8, 160, 8 + img_w, 160 + img_h], outline=(203, 213, 225, 255), width=1)

    card.save(cache_path, "PNG")
    return cache_path


def clear_old_rows_from_workbook(wb):
    """
    Mengosongkan baris data lama dari sheet OK, NG, dan New-OK&NG
    sehingga file Excel bersih (fresh) dan hanya terisi data baru.
    """
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        header_row = 5 if sheet_name == "NG" else 4
        start_delete = header_row + 1
        max_r = ws.max_row

        # Hapus seluruh gambar di baris data lama
        kept_images = []
        for img in ws._images:
            try:
                if img.anchor._from.row < header_row:
                    kept_images.append(img)
            except Exception:
                pass
        ws._images = kept_images

        if max_r >= start_delete:
            ws.delete_rows(start_delete, max_r - start_delete + 1)
            # Bersihkan row_dimensions untuk baris yang dihapus
            deleted_keys = [r for r in list(ws.row_dimensions.keys()) if isinstance(r, int) and r >= start_delete]
            for k in deleted_keys:
                del ws.row_dimensions[k]


def get_next_available_row(ws, sheet_name):
    """
    Menemukan baris kosong berikutnya dan nomor urut (No) terakhir
    """
    header_row = 5 if sheet_name == "NG" else 4
    start_row = header_row + 1

    last_no = 0
    last_row = header_row

    for r in range(start_row, ws.max_row + 2):
        val = ws.cell(r, 1).value
        if val is not None and isinstance(val, (int, float)):
            last_no = int(val)
            last_row = r
        elif val is None and ws.cell(r, 4).value is None and ws.cell(r, 5).value is None:
            break

    next_row = max(start_row, last_row + 1)
    next_no = last_no + 1
    return next_row, next_no


def sync_records_to_excel(excel_path, records, clear_old=False):
    """
    Menyinkronkan data uji baru ke sheet OK atau NG
    lengkap dengan composite card gambar persis seperti mockup gambar Denso.
    """
    excel_path = Path(excel_path)
    if not excel_path.exists():
        bak_path = excel_path.with_name(excel_path.stem + "_backup.xlsx")
        if bak_path.exists():
            import shutil
            shutil.copyfile(bak_path, excel_path)
        else:
            raise FileNotFoundError(f"File Excel tidak ditemukan: {excel_path}")

    wb = openpyxl.load_workbook(excel_path)

    if clear_old:
        clear_old_rows_from_workbook(wb)

    results = []

    for rec in records:
        file_name = rec.get("fileName", "")
        manual_val = float(rec.get("manualValue", 0.0))
        manual_judge = rec.get("manualJudge", "OK").upper()
        ai_val = float(rec.get("aiValue", 0.0))
        ai_judge = rec.get("aiJudge", "OK").upper()
        category = rec.get("category", "")
        note = rec.get("note", "")
        confidence = float(rec.get("confidence", 0.535))

        # Tentukan sheet target:
        # Default: jika manualJudge == 'OK', masuk ke sheet 'OK'
        # Jika manualJudge == 'NG', masuk ke sheet 'NG'
        target_sheet_name = rec.get("targetSheet")
        if not target_sheet_name or target_sheet_name == "auto":
            target_sheet_name = "OK" if manual_judge == "OK" else "NG"

        if target_sheet_name not in wb.sheetnames:
            target_sheet_name = "OK" if "OK" in wb.sheetnames else wb.sheetnames[0]

        ws = wb[target_sheet_name]

        target_row, next_no = get_next_available_row(ws, target_sheet_name)

        # 1. Atur tinggi baris 240.0 pt persis template Denso
        ws.row_dimensions[target_row].height = 240.0

        # Keterangan
        ket_text = note
        if not ket_text:
            if category == "OVER_REJECT":
                ket_text = f"Over-Reject (AI False NG) | {file_name}"
            elif category == "UNDER_REJECT":
                ket_text = f"Under-Reject (Flow-Out) | {file_name}"
            elif category == "MATCH_OK":
                ket_text = f"Match OK | {file_name}"
            elif category == "MATCH_NG":
                ket_text = f"Match NG | {file_name}"
            else:
                ket_text = f"{file_name}"

        # 2. Tulis Nilai ke Sel Data
        # Col 1: No
        cell_no = ws.cell(target_row, 1, next_no)
        cell_no.font = FONT_NORM
        cell_no.alignment = ALIGN_CENTER
        cell_no.border = THIN_BORDER

        # Col 2: Gambar Manual placeholder text
        cell_b = ws.cell(target_row, 2, "tempel gambar manual di sini")
        cell_b.fill = FILL_GRAY
        cell_b.font = FONT_PLACEHOLDER
        cell_b.alignment = ALIGN_CENTER
        cell_b.border = THIN_BORDER

        # Col 3: Gambar Hasil AI placeholder text
        cell_c = ws.cell(target_row, 3, "tempel gambar hasil AI di sini")
        cell_c.fill = FILL_GRAY
        cell_c.font = FONT_PLACEHOLDER
        cell_c.alignment = ALIGN_CENTER
        cell_c.border = THIN_BORDER

        # Col 4: Status Manual (OK/NG) — Hijau soft jika OK, merah soft jika NG
        cell_d = ws.cell(target_row, 4, manual_judge)
        cell_d.fill = FILL_SOFT_GREEN if manual_judge == "OK" else FILL_SOFT_RED
        cell_d.font = FONT_STATUS_OK if manual_judge == "OK" else FONT_STATUS_NG
        cell_d.alignment = ALIGN_CENTER
        cell_d.border = THIN_BORDER

        # Col 5: Nilai Ukur Manual (mm) — Biru soft dengan angka bold
        cell_e = ws.cell(target_row, 5, manual_val)
        cell_e.fill = FILL_SOFT_BLUE
        cell_e.font = FONT_VAL_BOLD
        cell_e.alignment = ALIGN_CENTER
        cell_e.border = THIN_BORDER

        # Col 6: Status AI (OK/NG) — Hijau soft jika OK, merah soft jika NG
        cell_f = ws.cell(target_row, 6, ai_judge)
        cell_f.fill = FILL_SOFT_GREEN if ai_judge == "OK" else FILL_SOFT_RED
        cell_f.font = FONT_STATUS_OK if ai_judge == "OK" else FONT_STATUS_NG
        cell_f.alignment = ALIGN_CENTER
        cell_f.border = THIN_BORDER

        # Col 7: Nilai Ukur AI (mm) — Biru soft dengan angka bold
        cell_g = ws.cell(target_row, 7, ai_val)
        cell_g.fill = FILL_SOFT_BLUE
        cell_g.font = FONT_VAL_BOLD
        cell_g.alignment = ALIGN_CENTER
        cell_g.border = THIN_BORDER

        # Col 8: Keterangan
        cell_h = ws.cell(target_row, 8, ket_text)
        cell_h.fill = FILL_SOFT_BLUE
        cell_h.font = FONT_NORM
        cell_h.alignment = ALIGN_LEFT
        cell_h.border = THIN_BORDER

        # Pastikan lebar kolom proporsional persis template Denso
        ws.column_dimensions['A'].width = 6.0
        ws.column_dimensions['B'].width = 46.0
        ws.column_dimensions['C'].width = 46.0
        ws.column_dimensions['D'].width = 18.0
        ws.column_dimensions['E'].width = 18.0
        ws.column_dimensions['F'].width = 18.0
        ws.column_dimensions['G'].width = 18.0
        ws.column_dimensions['H'].width = 24.0

        # 3. Sematkan Gambar Manual (Kolom B): Composite Card
        raw_img_path = INPUT_DIR / file_name
        if raw_img_path.exists():
            try:
                card_m_path = generate_manual_card(str(raw_img_path), file_name)
                img_m = OpenpyxlImage(str(card_m_path))
                orig_w = img_m.width
                orig_h = img_m.height
                target_w = 280
                img_m.width = target_w
                img_m.height = int(orig_h * (target_w / orig_w))
                ws.add_image(img_m, f"B{target_row}")
            except Exception as e_m:
                print(f"[Warning] Gagal sematkan gambar manual {file_name}: {e_m}", file=sys.stderr)

        # 4. Sematkan Gambar AI Overlay (Kolom C): Composite Card
        result_img_name = rec.get("resultImage") or f"{Path(file_name).stem}_result.jpg"
        ai_img_path = OUTPUT_DIR / result_img_name
        if not ai_img_path.exists():
            ai_img_path = OUTPUT_DIR / f"{Path(file_name).stem}_result.png"

        if ai_img_path.exists():
            try:
                card_a_path = generate_ai_card(str(ai_img_path), ai_judge, ai_val, confidence)
                img_a = OpenpyxlImage(str(card_a_path))
                orig_w_a = img_a.width
                orig_h_a = img_a.height
                target_w_a = 280
                img_a.width = target_w_a
                img_a.height = int(orig_h_a * (target_w_a / orig_w_a))
                ws.add_image(img_a, f"C{target_row}")
            except Exception as e_a:
                print(f"[Warning] Gagal sematkan gambar AI {ai_img_path}: {e_a}", file=sys.stderr)

        results.append({
            "fileName": file_name,
            "sheet": target_sheet_name,
            "row": target_row,
            "no": next_no,
            "status": "added"
        })

    wb.save(excel_path)
    return results


def clear_workbook_only(excel_path):
    """
    Hanya mengosongkan baris data lama tanpa menambah data baru
    """
    excel_path = Path(excel_path)
    wb = openpyxl.load_workbook(excel_path)
    clear_old_rows_from_workbook(wb)
    wb.save(excel_path)
    return {"ok": True, "message": f"Baris data lama berhasil dikosongkan dari {excel_path}"}


def main():
    parser = argparse.ArgumentParser(description="Sync Test Records to Denso Excel")
    parser.add_argument("--excel-path", default=DEFAULT_EXCEL_PATH, help="Path ke file Excel tujuan")
    parser.add_argument("--json-input", help="File JSON berisi array records atau '-' untuk stdin")
    parser.add_argument("--record", help="Single record JSON string")
    parser.add_argument("--clear-old", action="store_true", help="Kosongkan data lama sebelum menambahkan yang baru")
    parser.add_argument("--clear-only", action="store_true", help="Hanya kosongkan data lama")

    args = parser.parse_args()

    if args.clear_only:
        try:
            res = clear_workbook_only(args.excel_path)
            print(json.dumps(res))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)}))
            sys.exit(1)

    records = []
    if args.record:
        records = [json.loads(args.record)]
    elif args.json_input:
        if args.json_input == "-":
            records = json.load(sys.stdin)
        else:
            with open(args.json_input, "r", encoding="utf-8") as f:
                records = json.load(f)

    if not isinstance(records, list):
        records = [records]

    if not records:
        print(json.dumps({"ok": False, "error": "Tidak ada data records yang diberikan."}))
        sys.exit(1)

    try:
        res = sync_records_to_excel(args.excel_path, records, clear_old=args.clear_old)
        print(json.dumps({
            "ok": True,
            "message": f"Berhasil menyinkronkan {len(res)} data fresh ke Excel {args.excel_path}",
            "excelPath": args.excel_path,
            "details": res
        }))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
