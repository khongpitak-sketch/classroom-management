import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

FONT_NAME = "TH Sarabun IT๙"

def apply_thai_sarabun(run, font_name=FONT_NAME, size_pt=16, bold=False, color_rgb=None):
    """
    ตั้งค่าฟอนต์ภาษาไทยและตัวเลขให้แสดงผล TH Sarabun IT๙ อย่างถูกต้องทุกโหมดใน Microsoft Word
    """
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    if color_rgb:
        run.font.color.rgb = color_rgb

    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    rFonts.set(qn('w:cs'), font_name)
    rFonts.set(qn('w:eastAsia'), font_name)

    szCs = rPr.find(qn('w:szCs'))
    if szCs is None:
        szCs = OxmlElement('w:szCs')
        rPr.append(szCs)
    szCs.set(qn('w:val'), str(int(size_pt * 2)))

    if bold:
        bCs = rPr.find(qn('w:bCs'))
        if bCs is None:
            bCs = OxmlElement('w:bCs')
            rPr.append(bCs)
        bCs.set(qn('w:val'), '1')


def set_cell_background(cell, fill_hex):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)


def set_table_borders(table, border_color="CBD5E1"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="{border_color}"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="{border_color}"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="{border_color}"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="{border_color}"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)


def setup_document():
    doc = docx.Document()
    for section in doc.sections:
        section.top_margin = Inches(1.2)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.25)
        section.right_margin = Inches(1.0)

    style = doc.styles['Normal']
    font = style.font
    font.name = FONT_NAME
    font.size = Pt(16)
    font.color.rgb = RGBColor(0x00, 0x00, 0x00)
    return doc


def add_title(doc, text, level=1, align=WD_ALIGN_PARAGRAPH.LEFT):
    p = doc.add_paragraph()
    p.alignment = align
    if level == 1:
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.line_spacing = 1.05
        run = p.add_run(text)
        apply_thai_sarabun(run, size_pt=20, bold=True, color_rgb=RGBColor(0x00, 0x20, 0x60))
    elif level == 2:
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.05
        run = p.add_run(text)
        apply_thai_sarabun(run, size_pt=18, bold=True, color_rgb=RGBColor(0x1B, 0x36, 0x5D))
    elif level == 3:
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.05
        run = p.add_run(text)
        apply_thai_sarabun(run, size_pt=16, bold=True, color_rgb=RGBColor(0x22, 0x22, 0x22))
    return p


def add_paragraph_std(doc, text, bold_prefix="", indent=True, space_after=6, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    if indent:
        p.paragraph_format.first_line_indent = Inches(0.75)
    if bold_prefix:
        r_bold = p.add_run(bold_prefix)
        apply_thai_sarabun(r_bold, size_pt=16, bold=True)
    r_text = p.add_run(text)
    apply_thai_sarabun(r_text, size_pt=16, bold=False)
    return p


def add_bullet_item(doc, text, bold_prefix="", level=1, space_after=4):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    if level == 1:
        p.paragraph_format.left_indent = Inches(0.75)
        p.paragraph_format.first_line_indent = Inches(-0.3)
    elif level == 2:
        p.paragraph_format.left_indent = Inches(1.2)
        p.paragraph_format.first_line_indent = Inches(-0.3)

    if bold_prefix:
        r_bold = p.add_run(bold_prefix)
        apply_thai_sarabun(r_bold, size_pt=16, bold=True)
    r_text = p.add_run(text)
    apply_thai_sarabun(r_text, size_pt=16, bold=False)
    return p


def add_styled_table(doc, headers, rows_data, header_bg="002060", stripe_col0_bg="F2F4F7"):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table)

    hdr_cells = table.rows[0].cells
    for idx, text in enumerate(headers):
        hdr_cells[idx].text = text
        set_cell_background(hdr_cells[idx], header_bg)
        set_cell_margins(hdr_cells[idx], 120, 120, 150, 150)
        for p in hdr_cells[idx].paragraphs:
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            for r in p.runs:
                apply_thai_sarabun(r, size_pt=16, bold=True, color_rgb=RGBColor(0xFF, 0xFF, 0xFF))

    for row_vals in rows_data:
        row_cells = table.add_row().cells
        for i, val in enumerate(row_vals):
            row_cells[i].text = val
            set_cell_margins(row_cells[i], 100, 100, 140, 140)
            if i == 0 and stripe_col0_bg:
                set_cell_background(row_cells[i], stripe_col0_bg)
            for p in row_cells[i].paragraphs:
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.15
                for r in p.runs:
                    apply_thai_sarabun(r, size_pt=15, bold=(i == 0))
    return table


def add_cover_page(doc, main_title, sub_title, doc_code="เอกสารคู่มือผู้ใช้งาน (User Manual)"):
    p_top = doc.add_paragraph()
    p_top.paragraph_format.space_before = Pt(45)
    p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_code = p_top.add_run(doc_code)
    apply_thai_sarabun(r_code, size_pt=16, bold=True, color_rgb=RGBColor(0x1B, 0x36, 0x5D))

    p_cov_title = doc.add_paragraph()
    p_cov_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cov_title.paragraph_format.space_before = Pt(24)
    r_cov1 = p_cov_title.add_run(main_title)
    apply_thai_sarabun(r_cov1, size_pt=26, bold=True, color_rgb=RGBColor(0x00, 0x20, 0x60))

    p_cov_sub = doc.add_paragraph()
    p_cov_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cov_sub.paragraph_format.space_before = Pt(24)
    r_cov2 = p_cov_sub.add_run(sub_title)
    apply_thai_sarabun(r_cov2, size_pt=21, bold=True, color_rgb=RGBColor(0x8B, 0x00, 0x00))

    p_audience = doc.add_paragraph()
    p_audience.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_audience.paragraph_format.space_before = Pt(36)
    r_aud = p_audience.add_run("สำหรับผู้ใช้งานทั่วไป (คณาจารย์ บุคลากร และนักศึกษา)")
    apply_thai_sarabun(r_aud, size_pt=18, bold=True, color_rgb=RGBColor(0x1E, 0x40, 0xAF))

    p_cov_foot = doc.add_paragraph()
    p_cov_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cov_foot.paragraph_format.space_before = Pt(170)
    r_cov3 = p_cov_foot.add_run(
        "งานอาคารสถานที่และยานพาหนะ\n"
        "กลุ่มงานบริหารทั่วไปและยุทธศาสตร์\n"
        "คณะวิทยาการจัดการ มหาวิทยาลัยนราธิวาสราชนครินทร์\n"
        "ปีการศึกษา ๒๕๖๙"
    )
    apply_thai_sarabun(r_cov3, size_pt=18, bold=True, color_rgb=RGBColor(0x22, 0x22, 0x22))
    doc.add_page_break()


def add_preface_page(doc, preface_paragraphs):
    add_title(doc, "คำนำ", level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
    for para_text in preface_paragraphs:
        add_paragraph_std(doc, para_text, indent=True)

    sign_p = doc.add_paragraph()
    sign_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    sign_p.paragraph_format.space_before = Pt(36)
    rs = sign_p.add_run(
        "งานอาคารสถานที่และยานพาหนะ\n"
        "คณะวิทยาการจัดการ มหาวิทยาลัยนราธิวาสราชนครินทร์\n"
        "ตุลาคม ๒๕๖๙"
    )
    apply_thai_sarabun(rs, size_pt=16, bold=True)
    doc.add_page_break()


def add_toc_page(doc, toc_items):
    add_title(doc, "สารบัญ", level=1, align=WD_ALIGN_PARAGRAPH.CENTER)

    p_hdr = doc.add_paragraph()
    p_hdr.paragraph_format.space_after = Pt(6)
    r_h1 = p_hdr.add_run("เรื่อง")
    apply_thai_sarabun(r_h1, size_pt=16, bold=True)
    r_h_sp = p_hdr.add_run(" " * 98)
    apply_thai_sarabun(r_h_sp, size_pt=16, bold=False)
    r_h2 = p_hdr.add_run("หน้า")
    apply_thai_sarabun(r_h2, size_pt=16, bold=True)

    for item, page_num in toc_items:
        p_toc = doc.add_paragraph()
        p_toc.paragraph_format.space_before = Pt(0)
        p_toc.paragraph_format.space_after = Pt(3)
        p_toc.paragraph_format.line_spacing = 1.15
        is_main = not item.startswith("  ")
        r_item = p_toc.add_run(item)
        apply_thai_sarabun(r_item, size_pt=16, bold=is_main)

        dots_count = 74 - int(len(item) * 1.7)
        if dots_count < 6:
            dots_count = 6
        r_dots = p_toc.add_run(" " + "." * dots_count + " ")
        apply_thai_sarabun(r_dots, size_pt=14, bold=False, color_rgb=RGBColor(0x88, 0x88, 0x88))

        r_pg = p_toc.add_run(page_num)
        apply_thai_sarabun(r_pg, size_pt=16, bold=is_main)

    doc.add_page_break()


# ==============================================================================
# CONTENT BUILDERS FOR EACH OF THE 6 SYSTEMS
# ==============================================================================

def write_system_1(doc, chapter_prefix="บทที่ ๑ "):
    add_title(doc, f"{chapter_prefix}ระบบแดชบอร์ดและค้นหาห้องเรียน / ห้องประชุม", level=1)
    add_paragraph_std(
        doc,
        "ระบบแดชบอร์ดและค้นหาห้องเรียน (Dashboard & Room Directory System) เป็นจุดศูนย์กลางสำหรับผู้ใช้งานในการตรวจสอบสถานะความพร้อมของห้องเรียนทฤษฎี ห้องปฏิบัติการคอมพิวเตอร์ และห้องประชุมสัมมนาทั้งหมด ๒๒ ห้อง ของคณะวิทยาการจัดการแบบเรียลไทม์ (Real-time) โดยระบบจะคำนวณสถานะห้องว่างหรือกำลังเรียนโดยอัตโนมัติตามตารางสอนและการจองห้องประจำวัน",
        indent=True
    )

    add_title(doc, "๑. ข้อมูลห้องเรียน ห้องปฏิบัติการ และห้องประชุมในระบบ (๒๒ ห้อง)", level=2)
    room_rows = [
        ("ห้องเรียนทฤษฎี ชั้น ๓\n(๖ ห้อง)", "FMS302, FMS303, FMS305, FMS306, FMS307, FMS308", "ชั้น ๓", "๔๕ - ๕๐ ที่นั่ง\n(Projector / Smart TV 65\")"),
        ("ห้องเรียนทฤษฎี ชั้น ๔\n(๖ ห้อง)", "FMS401, FMS402, FMS403, FMS404, FMS405, FMS406", "ชั้น ๔", "๔๕ - ๕๕ ที่นั่ง\n(Projector / Smart TV 65\")"),
        ("ห้องปฏิบัติการคอมพิวเตอร์\n(๔ ห้อง)", "FMS201 (แล็บคอม ๑), FMS508 (แล็บคอม ๒),\nFMS504 (แล็บคอม ๓), FMS503 (แล็บคอม ๔)", "ชั้น ๒ และ ชั้น ๕", "๔๐ - ๕๐ เครื่อง\n(PC พร้อมซอฟต์แวร์เฉพาะทาง)"),
        ("ห้องประชุมและสัมมนา\n(๔ ห้อง)", "ห้องประชุมวิภา วังศิริกุล (๒๐๐ ที่นั่ง), ห้องประชุมอินทนิลโสภา (๖๐ ที่นั่ง),\nห้องประชุมพฤกษาพรรณชมพู (๒๐ ที่นั่ง), ห้องปฏิบัติการ MIL (๔๐ ที่นั่ง)", "ชั้น ๑, ๒ และ ๕", "๒๐ - ๒๐๐ ที่นั่ง\n(ระบบประชุมทางไกล & เครื่องเสียง)"),
        ("ห้อง Co-working Space\n(๒ ห้อง)", "ห้องประชุม Co-working Space (๑),\nห้องประชุม Co-working Space (๒) (รับรอง)", "ชั้น ๑", "๑๕ ที่นั่ง\n(Smart TV, Wi-Fi, โซฟารับรอง)")
    ]
    add_styled_table(
        doc,
        ["ประเภทห้อง", "รายชื่อห้องในระบบ", "ชั้นที่ตั้ง", "ความจุและอุปกรณ์หลัก"],
        room_rows,
        header_bg="002060"
    )

    add_title(doc, "๒. ขั้นตอนการใช้งานหน้าแดชบอร์ดภาพรวม (Dashboard)", level=2)
    add_bullet_item(doc, "เมื่อเข้าสู่เว็บไซต์ ระบบจะแสดงหน้า 'แดชบอร์ดภาพรวม' เป็นหน้าแรก โดยมีการ์ดสรุปสถานะห้อง ๔ หมวดหมู่ ได้แก่ ห้องว่าง (พร้อมใช้), กำลังเรียนการสอน, มีการจองล่วงหน้า และปิดปรับปรุง/ซ่อม", bold_prefix="๑. การดูการ์ดสรุปสถานะห้อง : ")
    add_bullet_item(doc, "แสดงรายชื่อห้องที่กำลังมีรายวิชาเรียนอยู่ในขณะนั้น พร้อมชื่อวิชาและอาจารย์ผู้สอน และสามารถกดปุ่ม 'ห้องว่างวันนี้' เพื่อดูเฉพาะรายชื่อห้องที่ว่างในวันปัจจุบันได้ทันที", bold_prefix="๒. ส่วนชั้นเรียนและกิจกรรมที่กำลังใช้งานขณะนี้ (Active Now) : ")
    add_bullet_item(doc, "ผู้ใช้งานสามารถคลิกปุ่มช่วงเวลาจำลอง (เช่น จันทร์ ๐๙:๐๐, จันทร์ พักเที่ยง, อังคาร ๑๔:๐๐) เพื่อตรวจสอบสถานะห้องว่างในวันและเวลาอื่นๆ ล่วงหน้า และกดปุ่ม 'เวลาจริง' เพื่อกลับสู่เวลาปัจจุบัน", bold_prefix="๓. แถบจำลองการดูสถานะตามช่วงเวลา (ลองดูสถานะ) : ")

    add_title(doc, "๓. ขั้นตอนการค้นหาและกรองห้องเรียน (เมนูรายการห้องเรียน)", level=2)
    add_bullet_item(doc, "คลิกไอคอน 'รายการห้องเรียน' (รูปประตู) บนแถบเมนูด้านบน", bold_prefix="ขั้นที่ ๑ : ")
    add_bullet_item(doc, "คลิกปุ่มหมวดหมู่ 'ทั้งหมด', 'ห้องเรียน', 'แล็บคอม' หรือ 'ห้องประชุม' เพื่อกรองเฉพาะประเภทห้องที่ต้องการ", bold_prefix="ขั้นที่ ๒ : ")
    add_bullet_item(doc, "คลิกเลือกวันที่จากช่องปฏิทิน (มุมซ้าย) เพื่อตรวจสอบว่าในวันที่ต้องการใช้ห้อง ห้องใดว่างหรือมีการจองแล้วบ้าง", bold_prefix="ขั้นที่ ๓ : ")
    add_bullet_item(doc, "พิมพ์ค้นหาชื่อห้อง รหัสห้อง หรือชื่ออุปกรณ์ (เช่น Projector, Smart TV, ไมค์, RTX) ในช่องค้นหา หรือกรองตามสถานะห้องและชั้นที่ตั้ง", bold_prefix="ขั้นที่ ๔ : ")
    add_bullet_item(doc, "คลิกที่การ์ดห้องเรียนเพื่อเปิดหน้าต่างดูรายละเอียดสเปกเครื่องคอมพิวเตอร์ ซอฟต์แวร์ อุปกรณ์ประจำห้อง และตารางเรียนของห้องนั้น", bold_prefix="ขั้นที่ ๕ : ")

    add_title(doc, "๔. ความหมายของป้ายสถานะห้อง (Status Badges)", level=2)
    badge_rows = [
        ("ว่าง (Available)", "สีเขียว", "ห้องว่างในขณะนั้น ผู้ใช้งานสามารถกดปุ่ม 'จองห้อง' เพื่อยื่นคำขอเข้าใช้งานได้ทันที"),
        ("กำลังเรียน/ใช้งาน (Occupied)", "สีเหลือง/ส้ม", "มีรายวิชาตามตารางสอนปกติหรือกิจกรรมกำลังเข้าใช้งานอยู่ในช่วงเวลานั้น"),
        ("มีการจอง (Reserved)", "สีชมพู", "ห้องได้รับการอนุมัติจองล่วงหน้าสำหรับการเรียนชดเชย สัมมนา หรือการสอบ"),
        ("ปิดปรับปรุง (Maintenance)", "สีแดง", "ห้องหรืออุปกรณ์หลักชำรุด อยู่ระหว่างดำเนินการซ่อมบำรุง งดเปิดให้จองชั่วคราว")
    ]
    add_styled_table(doc, ["ป้ายสถานะ", "สีสัญลักษณ์", "ความหมายและการดำเนินการ"], badge_rows, header_bg="1B365D")


def write_system_2(doc, chapter_prefix="บทที่ ๒ "):
    add_title(doc, f"{chapter_prefix}ระบบตารางการใช้ห้องเรียนและคาบการสอน (Timetable Matrix)", level=1)
    add_paragraph_std(
        doc,
        "ระบบตารางการใช้ห้องเรียนและคาบการสอน (Timetable Matrix System) รวบรวมข้อมูลตารางสอนจริงของคณะวิทยาการจัดการ จำนวน ๑๘๔ คาบเรียน เพื่อให้คณาจารย์ นักศึกษา และบุคลากร สามารถตรวจสอบตารางการใช้ห้องเรียนรายสัปดาห์ ค้นหาตารางสอนตามชื่ออาจารย์ และตรวจสอบช่วงเวลาว่างของแต่ละห้องได้อย่างแม่นยำ",
        indent=True
    )

    add_title(doc, "๑. ขั้นตอนการตรวจสอบตารางเรียนแยกตามห้องเรียน", level=2)
    add_bullet_item(doc, "คลิกที่เมนู 'ตารางการใช้ห้องเรียน' (ไอคอนรูปปฏิทิน) บนแถบเมนูด้านบน", bold_prefix="๑. ")
    add_bullet_item(doc, "คลิกที่ช่องดรอปดาวน์ 'เลือกห้องเรียน' แล้วเลือกรูปแบบที่ต้องการตรวจสอบ:", bold_prefix="๒. ")
    add_bullet_item(doc, "แสดงตารางคาบเรียนของทุกห้องเรียนที่มีการเรียนการสอนในวันปัจจุบัน", bold_prefix="- ภาพรวมทุกห้องเรียนวันนี้ : ", level=2)
    add_bullet_item(doc, "แสดงตารางเรียนรายสัปดาห์ (วันจันทร์ - วันอาทิตย์) ของห้องที่เลือกในรูปแบบตาราง Matrix พร้อมระบุรหัสวิชา ชื่อวิชา อาจารย์ผู้สอน และกลุ่มเรียน", bold_prefix="- เลือกเฉพาะห้องเรียน (เช่น FMS302, FMS401, ห้องแล็บคอม ๑) : ", level=2)

    add_title(doc, "๒. ขั้นตอนการค้นหาตารางสอนตามชื่ออาจารย์ผู้สอน", level=2)
    add_bullet_item(doc, "ในหน้าตารางการใช้ห้องเรียน คลิกที่ดรอปดาวน์ 'เลือกอาจารย์ผู้สอน' (ช่องสีฟ้าด้านขวา)", bold_prefix="๑. ")
    add_bullet_item(doc, "คลิกเลือกชื่ออาจารย์ที่ต้องการตรวจสอบตารางสอน", bold_prefix="๒. ")
    add_bullet_item(doc, "ระบบจะแสดงสรุปรายวิชาทั้งหมดที่อาจารย์ท่านนั้นเป็นผู้สอน พร้อมระบุวัน เวลาเริ่ม-สิ้นสุด และหมายเลขห้องเรียนที่ใช้สอนอย่างครบถ้วน", bold_prefix="๓. ")

    add_title(doc, "๓. การตรวจสอบรายการห้องว่างทั้งหมดในวันนี้", level=2)
    add_bullet_item(doc, "คลิกปุ่มสีเขียว 'รายการห้องว่างทั้งหมดวันนี้' บนแถบเครื่องมือของหน้าตารางเรียน", bold_prefix="๑. ")
    add_bullet_item(doc, "ระบบจะแสดงการ์ดสรุปรายชื่อห้องเรียนและห้องปฏิบัติการทั้งหมด พร้อมระบุช่วงเวลาที่ห้องว่างและช่วงเวลาที่มีคิวสอน เพื่อช่วยให้ผู้ใช้งานเลือกจองห้องในช่วงเวลาที่ว่างได้ทันที", bold_prefix="๒. ")

    add_title(doc, "๔. สรุปผังการทำงานของระบบตารางเรียน", level=2)
    tt_steps = [
        ("๑. เข้าสู่เมนูตารางเรียน", "คลิกไอคอนปฏิทิน 'ตารางการใช้ห้อง' บนแถบเมนูหลัก"),
        ("๒. เลือกเงื่อนไขการดูข้อมูล", "เลือกดูตาม 'ห้องเรียน', ดูตาม 'ชื่ออาจารย์ผู้สอน' หรือกดปุ่ม 'รายการห้องว่างทั้งหมดวันนี้'"),
        ("๓. ตรวจสอบคาบเวลา", "ระบบแสดงตารางเรียน Matrix พร้อมรหัสวิชา ชื่อวิชา อาจารย์ กลุ่มเรียน และเวลาเรียน"),
        ("๔. ต่อยอดการจองห้อง", "เมื่อพบช่วงเวลาและห้องที่ว่าง สามารถกดปุ่ม '+ จองห้อง' เพื่อขอใช้ห้องในช่วงเวลานั้นได้ทันที")
    ]
    add_styled_table(doc, ["ขั้นตอน", "รายละเอียดการดำเนินการของผู้ใช้งาน"], tt_steps, header_bg="002060")


def write_system_3(doc, chapter_prefix="บทที่ ๓ "):
    add_title(doc, f"{chapter_prefix}ระบบจองห้องเรียน ห้องปฏิบัติการ และห้องประชุมออนไลน์", level=1)
    add_paragraph_std(
        doc,
        "ระบบจองห้องเรียน ห้องปฏิบัติการ และห้องประชุมออนไลน์ (Online Room Booking System) ออกแบบมาเพื่อให้คณาจารย์ บุคลากร และนักศึกษา สามารถยื่นคำขอใช้ห้องสำหรับการเรียนการสอนชดเชย การติวสอบ การประชุม หรือการจัดกิจกรรมต่างๆ ได้อย่างสะดวกรวดเร็ว โดยระบบจะตรวจสอบเวลาชนกับตารางเรียนปกติและการจองอื่นโดยอัตโนมัติ (Conflict Detection) และบันทึกข้อมูลลงฐานข้อมูล Cloud แบบเรียลไทม์",
        indent=True
    )

    add_title(doc, "๑. ขั้นตอนการยื่นคำขอจองห้องเรียน / ห้องประชุม", level=2)
    add_bullet_item(doc, "คลิกปุ่ม '+ จองห้อง' (ปุ่มสีน้ำเงินมุมขวาบนสุดของหน้าจอ) หรือคลิกปุ่ม 'จองห้อง' บนการ์ดห้องเรียนที่ต้องการ", bold_prefix="ขั้นที่ ๑ เปิดแบบฟอร์มการจอง : ")
    add_bullet_item(doc, "กรอกรายละเอียดในแบบฟอร์มจองห้องให้ครบถ้วนสมบูรณ์ ได้แก่:", bold_prefix="ขั้นที่ ๒ กรอกข้อมูลการจอง : ")
    add_bullet_item(doc, "เลือกห้องเรียน ห้องปฏิบัติการคอมพิวเตอร์ หรือห้องประชุมที่ต้องการใช้งาน", bold_prefix="- เลือกห้องเรียนที่ต้องการจอง (จำเป็น) : ", level=2)
    add_bullet_item(doc, "ระบุวันที่ต้องการใช้งาน พร้อมเลือก 'เวลาเริ่ม' และ 'เวลาสิ้นสุด' (เช่น ๐๙:๐๐ น. ถึง ๑๒:๐๐ น.)", bold_prefix="- วันที่ใช้งาน และ เวลาเริ่ม-สิ้นสุด (จำเป็น) : ", level=2)
    add_bullet_item(doc, "ระบุชื่อรายวิชาที่สอนชดเชย หรือหัวข้อการประชุม/กิจกรรม", bold_prefix="- ชื่อวิชา / หัวข้อกิจกรรม (จำเป็น) : ", level=2)
    add_bullet_item(doc, "ระบุชื่อ-นามสกุลผู้ขอจอง เบอร์โทรศัพท์ที่ติดต่อได้ และสาขาวิชา/หน่วยงาน", bold_prefix="- ชื่อผู้ขอจอง เบอร์โทรศัพท์ และสาขาวิชา (จำเป็น) : ", level=2)
    add_bullet_item(doc, "ระบุรายละเอียดเพิ่มเติมหรือความต้องการใช้อุปกรณ์พิเศษ (ถ้ามี)", bold_prefix="- วัตถุประสงค์การใช้ห้อง / หมายเหตุ : ", level=2)
    add_bullet_item(doc, "คลิกปุ่ม 'ยืนยันการจองห้อง' ระบบจะตรวจสอบตารางเวลาชนกันอัตโนมัติ หากห้องว่างจะบันทึกเป็นสถานะ 'รออนุมัติ (Pending)' ทันที", bold_prefix="ขั้นที่ ๓ ยืนยันการจอง : ")

    add_title(doc, "๒. แผนผังกระบวนการจองและอนุมัติห้องเรียน (Booking Workflow)", level=2)
    bk_steps = [
        ("๑. ยื่นคำขอจองห้อง", "ผู้ใช้งาน (User)", "กรอกแบบฟอร์มจองห้องออนไลน์ ระบุห้อง วันที่ เวลา วิชา/กิจกรรม ชื่อผู้จอง และเบอร์โทรศัพท์"),
        ("๒. ตรวจสอบเวลาชนอัตโนมัติ", "ระบบอัตโนมัติ", "เปรียบเทียบวัน-เวลากับตารางเรียน ๑๘๔ คาบ และรายการจองอื่น หากชนกันระบบจะแจ้งเตือนให้เปลี่ยนเวลาทันที"),
        ("๓. บันทึกรายการรออนุมัติ", "ระบบ Cloud\n(Google Sheets)", "บันทึกคำขอในสถานะ 'รออนุมัติ (Pending)' และแสดงแจ้งเตือนไปยังผู้ดูแลระบบ (Admin)"),
        ("๔. พิจารณาอนุมัติคำขอ", "ผู้ดูแลระบบ (Admin) /\nเจ้าหน้าที่อาคาร", "ตรวจสอบความเหมาะสมและกดอนุมัติคำขอในระบบ สถานะเปลี่ยนเป็น 'อนุมัติแล้ว (Approved)'"),
        ("๕. เข้าใช้งานและส่งคืนห้อง", "ผู้ใช้งาน (User)", "เข้าใช้งานห้องตามวัน-เวลาที่ได้รับอนุมัติ ปิดไฟ ปิดแอร์ และดูแลความเรียบร้อยหลังใช้งานเสร็จสิ้น")
    ]
    add_styled_table(doc, ["ขั้นตอน", "ผู้รับผิดชอบ", "รายละเอียดการปฏิบัติงาน"], bk_steps, header_bg="002060")

    add_title(doc, "๓. การติดตามสถานะการจองและการส่งออกไฟล์ CSV", level=2)
    add_bullet_item(doc, "คลิกเมนู 'การจองห้อง' (ไอคอนรูปปฏิทินเครื่องหมายถูก) เพื่อดูตารางรายการจองทั้งหมดแบบเรียลไทม์", bold_prefix="• ")
    add_bullet_item(doc, "สามารถกดปุ่มกรองสถานะ 'ทั้งหมด', 'อนุมัติแล้ว', 'รออนุมัติ' หรือ 'สิ้นสุดการจอง' และคลิกที่หัวตารางเพื่อเรียงลำดับข้อมูลได้", bold_prefix="• ")
    add_bullet_item(doc, "สามารถคลิกปุ่ม 'ส่งออก CSV' เพื่อดาวน์โหลดข้อมูลการจองไปเปิดใช้งานในโปรแกรม Microsoft Excel ได้ทันที", bold_prefix="• ")


def write_system_4(doc, chapter_prefix="บทที่ ๔ "):
    add_title(doc, f"{chapter_prefix}ระบบแจ้งซ่อมและดูแลอุปกรณ์ประจำห้อง (Equipment Maintenance)", level=1)
    add_paragraph_std(
        doc,
        "ระบบแจ้งซ่อมและดูแลอุปกรณ์ประจำห้อง (Equipment Maintenance System) ช่วยให้คณาจารย์ นักศึกษา และบุคลากรที่พบปัญหาอุปกรณ์โสตทัศนูปกรณ์ เครื่องคอมพิวเตอร์ เครื่องปรับอากาศ หรือครุภัณฑ์ภายในห้องเรียนชำรุด สามารถแจ้งซ่อมออนไลน์พร้อมแนบรูปถ่ายหลักฐานได้ทันที เพื่อให้เจ้าหน้าที่เทคนิคเข้าดำเนินการแก้ไขได้อย่างรวดเร็ว",
        indent=True
    )

    add_title(doc, "๑. หมวดหมู่อุปกรณ์ที่รองรับการแจ้งซ่อม (๙ หมวดหมู่)", level=2)
    mnt_cats = [
        ("๑. โปรเจกเตอร์ (Projector)", "เครื่องเปิดไม่ติด, ภาพมัว/หลอดเสื่อม, สายสัญญาณ HDMI/VGA ชำรุด, จอรับภาพไม่เลื่อน"),
        ("๒. เครื่องปรับอากาศ (Air)", "แอร์ไม่เย็น/มีแต่ลม, น้ำแอร์รั่ว/หยดลงพื้น, เครื่องมีเสียงดังผิดปกติ, รีโมทแอร์ใช้งานไม่ได้"),
        ("๓. คอมพิวเตอร์ / PC", "เครื่องเปิดไม่ติด, หน้าจอไม่แสดงผล, เครื่องค้าง/จอฟ้า (Blue Screen), โปรแกรมใช้งานไม่ได้"),
        ("๔. เมาส์ / คีย์บอร์ด", "เมาส์คลิกไม่ติด/เคอร์เซอร์ไม่ขยับ, คีย์บอร์ดปุ่มค้าง/พิมพ์ไม่ติด, พอร์ตเชื่อมต่อ USB ชำรุด"),
        ("๕. ระบบเสียง / ไมโครโฟน", "ไมโครโฟนไม่มีเสียง, ลำโพงเสียงซ่า/เสียงหอน, ถ่านไมค์ลอยหมด, เครื่องขยายเสียงไม่ทำงาน"),
        ("๖. อินเทอร์เน็ต / Wi-Fi / LAN", "เชื่อมต่ออินเทอร์เน็ตไม่ได้, สาย LAN หัวหลวมหรือขาด, สัญญาณ Wi-Fi ในห้องอ่อน/หลุดบ่อย"),
        ("๗. ปลั๊กไฟ / ระบบไฟฟ้า", "เต้ารับไฟไม่มีกระแสไฟ, หลอดไฟส่องสว่างกะพริบหรือดับ, สวิตช์ไฟหรือเบรกเกอร์ชำรุด"),
        ("๘. โต๊ะ / เก้าอี้ / ครุภัณฑ์", "เก้าอี้ชำรุด/ขาหัก/ล้อหลุด, โต๊ะเรียนโยกคลอน, กระดานไวท์บอร์ดหรือกระจกชำรุด"),
        ("๙. ปัญหาอื่นๆ (Other)", "ปัญหาความสะอาด กลอนประตู หน้าต่าง ผ้าม่าน หรือปัญหาอื่นๆ ภายในห้องเรียน")
    ]
    add_styled_table(doc, ["หมวดหมู่อุปกรณ์", "ตัวอย่างอาการเสียและปัญหาที่พบบ่อย (เลือกอัตโนมัติได้)"], mnt_cats, header_bg="1B365D")

    add_title(doc, "๒. ขั้นตอนการแจ้งปัญหาอุปกรณ์ชำรุดสำหรับผู้ใช้งาน", level=2)
    add_bullet_item(doc, "คลิกเมนู 'แจ้งซ่อมอุปกรณ์' (ไอคอนรูปประแจ) บนแถบเมนูด้านบน แล้วกดปุ่มสีแดง '+ แจ้งปัญหาอุปกรณ์ใหม่' (หรือกดปุ่มแจ้งซ่อมจากการ์ดห้องเรียนโดยตรง)", bold_prefix="ขั้นที่ ๑ เปิดฟอร์มแจ้งซ่อม : ")
    add_bullet_item(doc, "เลือกห้องเรียนที่พบปัญหา และคลิกเลือกปุ่มหมวดหมู่อุปกรณ์ที่ชำรุด (๑ ใน ๙ หมวดหมู่)", bold_prefix="ขั้นที่ ๒ เลือกห้องและหมวดหมู่ : ")
    add_bullet_item(doc, "คลิกเลือกป้าย 'ปัญหาที่พบบ่อย' เพื่อให้ระบบเติมหัวข้อปัญหาให้อัตโนมัติ หรือพิมพ์ระบุอาการเสียเพิ่มเติมในช่องรายละเอียด", bold_prefix="ขั้นที่ ๓ ระบุอาการเสีย : ")
    add_bullet_item(doc, "คลิกกรอบ 'แนบรูปภาพหรือไฟล์หลักฐาน' เพื่อถ่ายภาพอุปกรณ์ที่ชำรุดจากมือถือ หรืออัปโหลดไฟล์ภาพ PNG, JPG, WEBP หรือ PDF (ไม่เกิน ๑๐ MB)", bold_prefix="ขั้นที่ ๔ แนบรูปถ่ายหลักฐาน : ")
    add_bullet_item(doc, "เลือกระดับความด่วน (ทั่วไป / ปานกลาง / ด่วนมาก) กรอกชื่อผู้แจ้ง และกดปุ่ม 'ส่งข้อมูลแจ้งซ่อม'", bold_prefix="ขั้นที่ ๕ ยืนยันการแจ้งซ่อม : ")

    add_title(doc, "๓. การติดตามสถานะการซ่อมบำรุง", level=2)
    add_paragraph_std(
        doc,
        "ผู้ใช้งานสามารถติดตามความคืบหน้าของรายการแจ้งซ่อมได้จากตารางในหน้า 'แจ้งซ่อมอุปกรณ์' โดยสามารถกรองดูตามสถานะ (ทั้งหมด / รอดำเนินการ / ซ่อมเสร็จสิ้น) หรือกรองตามหมวดหมู่อุปกรณ์ทั้ง ๙ หมวดหมู่ รวมถึงคลิกเปิดดูรูปถ่ายหลักฐานและบันทึกผลการซ่อมของเจ้าหน้าที่ได้ตลอดเวลา",
        indent=True
    )


def write_system_5(doc, chapter_prefix="บทที่ ๕ "):
    add_title(doc, f"{chapter_prefix}ระบบหนังสือขออนุญาตเปลี่ยนเวรยามออนไลน์ (A4 Official Form)", level=1)
    add_paragraph_std(
        doc,
        "ระบบหนังสือขออนุญาตเปลี่ยนเวรยามออนไลน์ จัดทำขึ้นเพื่ออำนวยความสะดวกให้บุคลากรและเจ้าหน้าที่ผู้ปฏิบัติหน้าที่เวรยามประจำคณะวิทยาการจัดการ สามารถยื่นเรื่องขอเปลี่ยนเวรยามออนไลน์ ติดตามสถานะการอนุมัติ และสั่งพิมพ์ 'หนังสือขออนุญาตเปลี่ยนเวรยาม' ขนาดกระดาษ A4 ที่จัดรูปแบบถูกต้องตามแบบฟอร์มราชการของคณะฯ ๑๐๐%",
        indent=True
    )

    add_title(doc, "๑. ขั้นตอนการยื่นคำขอเปลี่ยนเวรยามออนไลน์", level=2)
    add_bullet_item(doc, "คลิกเมนู 'แบบฟอร์มขอเปลี่ยนเวรยาม' (ไอคอนรูปปฏิทินลูกศรหมุน) บนแถบเมนูด้านบน แล้วคลิกปุ่มสีส้ม '+ ยื่นคำขอเปลี่ยนเวร'", bold_prefix="ขั้นที่ ๑ เปิดแบบฟอร์ม : ")
    add_bullet_item(doc, "เลือกวันที่ยื่นเรื่อง และระบุเลขที่เอกสารภายใน (เช่น อว ๐๖๐๘.๐๔/... ถ้ามี)", bold_prefix="ขั้นที่ ๒ ระบุวันที่และเลขที่เอกสาร : ")
    add_bullet_item(doc, "เลือกคำนำหน้า กรอกชื่อ-นามสกุล ตำแหน่ง เบอร์โทรศัพท์ติดต่อ และสังกัดของผู้ขอเปลี่ยนเวร", bold_prefix="ขั้นที่ ๓ กรอกส่วนที่ ๑ (ข้อมูลผู้ขอเปลี่ยนเวร) : ")
    add_bullet_item(doc, "เลือกวันที่อยู่เวรเดิม เลือกผลัดเวร (ช่วงเช้า / ช่วงบ่าย / กลางคืน) และระบุเหตุผลความจำเป็นที่ต้องขอเปลี่ยนเวร", bold_prefix="ขั้นที่ ๔ กรอกส่วนที่ ๒ (วันที่และผลัดเวรเดิม) : ")
    add_bullet_item(doc, "กรอกชื่อ-นามสกุลและตำแหน่งของผู้รับเปลี่ยนเวร (ผู้มาปฏิบัติหน้าที่แทน) พร้อมระบุวันที่จะมาอยู่เวรแทนชดเชย:", bold_prefix="ขั้นที่ ๕ กรอกส่วนที่ ๓ (ข้อมูลผู้รับเปลี่ยนเวรและวันชดเชย) : ")
    add_bullet_item(doc, "คลิกไอคอนปฏิทินเพื่อเลือกวันที่จะมาอยู่เวรแทนชดเชย และเลือกผลัดเวรชดเชย", bold_prefix="- กรณีมีวันอยู่เวรชดเชย : ", level=2)
    add_bullet_item(doc, "คลิกปุ่ม 'ใส่เครื่องหมาย - (ไม่มีชดเชย)' และเลือกผลัดเวรชดเชยเป็น '- (ไม่มี)'", bold_prefix="- กรณีไม่มีการอยู่เวรชดเชย : ", level=2)
    add_bullet_item(doc, "คลิกปุ่ม 'บันทึกและส่งคำขอ' เพื่อบันทึกรายการเข้าสู่ตารางระบบ", bold_prefix="ขั้นที่ ๖ บันทึกคำขอ : ")

    add_title(doc, "๒. ขั้นตอนการสั่งพิมพ์หนังสือราชการขนาด A4 และแบบฟอร์มเปล่า", level=2)
    swap_print_rows = [
        ("การพิมพ์หนังสือที่มีข้อมูลครบถ้วน\n(พิมพ์จากรายการที่ยื่นไว้)", "๑. คลิกปุ่ม 'พิมพ์' (ไอคอนเครื่องพิมพ์) ท้ายรายการคำขอในตาราง\n๒. ระบบจะจัดหน้าหนังสือราชการขนาด A4 พร้อมข้อมูลผู้ขอ ผู้แทน ความเห็นหัวหน้าสำนักงานคณบดี คำสั่งคณบดี และบันทึกงานอาคารสถานที่\n๓. คลิกปุ่ม 'สั่งพิมพ์เอกสาร A4' เพื่อพิมพ์ออกทางเครื่องพิมพ์ (๑ หน้ากระดาษพอดี)"),
        ("การพิมพ์แบบฟอร์มเปล่า\n(สำหรับนำไปเขียนด้วยลายมือ)", "๑. คลิกปุ่ม 'พิมพ์แบบฟอร์มเปล่า (A4)' ที่มุมขวาบนของหน้าระบบเปลี่ยนเวรยาม หรือกดปุ่ม 'สลับเป็นแบบฟอร์มเปล่า' ในหน้าต่างตัวอย่างก่อนพิมพ์\n๒. ระบบจะแสดงแบบฟอร์มที่มีเส้นประสำหรับกรอกด้วยลายมือ พร้อมสั่งพิมพ์ทันที")
    ]
    add_styled_table(doc, ["รูปแบบการพิมพ์", "ขั้นตอนการดำเนินการ"], swap_print_rows, header_bg="002060")


def write_system_6(doc, chapter_prefix="บทที่ ๖ "):
    add_title(doc, f"{chapter_prefix}ระบบขออนุญาตใช้รถยนต์ส่วนกลาง (Vehicle Reservation v2.0)", level=1)
    add_paragraph_std(
        doc,
        "ระบบจัดการห้องเรียนได้บูรณาการจุดเชื่อมต่อโดยตรงเข้ากับ 'ระบบขออนุญาตใช้รถยนต์ส่วนกลาง (Version 2.0)' ของคณะวิทยาการจัดการ มหาวิทยาลัยนราธิวาสราชนครินทร์ เพื่อให้คณาจารย์และบุคลากรสามารถเข้าถึงบริการด้านอาคารสถานที่และยานพาหนะได้จากจุดเดียวอย่างครบวงจร",
        indent=True
    )

    add_title(doc, "๑. ช่องทางการเข้าสู่ระบบขออนุญาตใช้รถยนต์ (๔ จุดทางลัด)", level=2)
    add_bullet_item(doc, "คลิกปุ่มไอคอนรูปรถยนต์สีเขียว บนแถบเมนูด้านบนสุดของหน้าจอ (ข้างปุ่ม Admin และปุ่มจองห้อง)", bold_prefix="จุดที่ ๑ แถบเมนูหลักด้านบน (Top Navbar) : ")
    add_bullet_item(doc, "คลิกปุ่มสีเขียว 'ขอใช้รถยนต์ (v2.0)' บนแบนเนอร์ต้อนรับในหน้าแดชบอร์ด", bold_prefix="จุดที่ ๒ แบนเนอร์หน้าแดชบอร์ด : ")
    add_bullet_item(doc, "คลิกปุ่ม 'เข้าสู่ระบบขอใช้รถยนต์' บนการ์ดบริการคณะวิทยาการจัดการ ด้านล่างหน้าแดชบอร์ด", bold_prefix="จุดที่ ๓ การ์ดบริการด้านล่างหน้าแดชบอร์ด : ")
    add_bullet_item(doc, "คลิกเมนู 'ขอใช้รถ' บนแถบเมนูด้านล่างสำหรับผู้ใช้งานผ่านโทรศัพท์มือถือ (Mobile Navigation)", bold_prefix="จุดที่ ๔ เมนูสำหรับสมาร์ตโฟน : ")

    add_title(doc, "๒. ขั้นตอนการขออนุญาตใช้รถยนต์ส่วนกลาง", level=2)
    car_steps = [
        ("๑. เข้าสู่ระบบขอใช้รถยนต์", "คลิกปุ่มทางลัดเข้าสู่ระบบขออนุญาตใช้รถยนต์ (https://car-git-main-khongpitak-6338.vercel.app/index.php)"),
        ("๒. ตรวจสอบปฏิทินคิวรถ", "ตรวจสอบตารางการใช้รถยนต์ส่วนกลางและสถานะความพร้อมของพนักงานขับรถในวันที่ต้องการเดินทาง"),
        ("๓. กรอกคำขออนุญาตใช้รถ", "ระบุชื่อ-นามสกุล ตำแหน่ง สถานที่ไปราชการ วัตถุประสงค์ จำนวนคนนั่ง และวัน-เวลาไป-กลับ"),
        ("๔. ติดตามผลและพิมพ์ใบขออนุญาต", "เจ้าหน้าที่ยานพาหนะตรวจสอบและเสนอผู้บริหารอนุมัติ ผู้ขอสามารถตรวจสอบสถานะและพิมพ์แบบฟอร์มได้จากระบบ")
    ]
    add_styled_table(doc, ["ขั้นตอน", "รายละเอียดการดำเนินการของผู้ใช้งาน"], car_steps, header_bg="1B365D")


# ==============================================================================
# MASTER BOOK & INDIVIDUAL BOOKS GENERATOR
# ==============================================================================

def create_master_manual_docx(output_path):
    doc = setup_document()

    add_cover_page(
        doc,
        main_title="คู่มือการใช้งานระบบสารสนเทศ\n(User Operating Manual)",
        sub_title="ระบบบริหารจัดการห้องเรียน ห้องปฏิบัติการคอมพิวเตอร์\nห้องประชุม งานซ่อมบำรุง งานเปลี่ยนเวรยาม และยานพาหนะส่วนกลาง"
    )

    add_preface_page(doc, [
        "คู่มือการใช้งานระบบสารสนเทศ (User Operating Manual) ฉบับนี้ จัดทำขึ้นเพื่อเป็นแนวทางสำหรับคณาจารย์ บุคลากร และนักศึกษา คณะวิทยาการจัดการ มหาวิทยาลัยนราธิวาสราชนครินทร์ ในการเข้าใช้งานระบบบริหารจัดการห้องเรียน ห้องปฏิบัติการคอมพิวเตอร์ ห้องประชุม และงานบริการอาคารสถานที่อย่างครบวงจร",
        "ภายในเล่มได้แยกเนื้อหาคู่มือการใช้งานออกเป็น ๖ ระบบงานย่อยอย่างชัดเจน ประกอบด้วย (๑) ระบบแดชบอร์ดและค้นหาห้องเรียน/ห้องประชุม (๒) ระบบตารางการใช้ห้องเรียนและคาบการสอน (๓) ระบบจองห้องเรียนและห้องประชุมออนไลน์ (๔) ระบบแจ้งซ่อมและดูแลอุปกรณ์ประจำห้อง (๕) ระบบหนังสือขออนุญาตเปลี่ยนเวรยามออนไลน์ และ (๖) ระบบขออนุญาตใช้รถยนต์ส่วนกลาง เพื่อให้ผู้ใช้งานสามารถศึกษาขั้นตอนการปฏิบัติงานได้เข้าใจง่ายและรวดเร็ว",
        "คณะทำงานหวังเป็นอย่างยิ่งว่า คู่มือการใช้งานฉบับนี้จะช่วยอำนวยความสะดวกในการใช้บริการด้านอาคารสถานที่ โสตทัศนูปกรณ์ และยานพาหนะของคณะวิทยาการจัดการให้เกิดประสิทธิภาพและประโยชน์สูงสุดต่อไป"
    ])

    toc_items = [
        ("คำนำ", "ก"),
        ("สารบัญ", "ข"),
        ("บทที่ ๑ ระบบแดชบอร์ดและค้นหาห้องเรียน / ห้องประชุม", "๑"),
        ("  ๑. ข้อมูลห้องเรียน ห้องปฏิบัติการ และห้องประชุมในระบบ (๒๒ ห้อง)", "๑"),
        ("  ๒. ขั้นตอนการใช้งานหน้าแดชบอร์ดภาพรวม (Dashboard)", "๑"),
        ("  ๓. ขั้นตอนการค้นหาและกรองห้องเรียน (เมนูรายการห้องเรียน)", "๒"),
        ("  ๔. ความหมายของป้ายสถานะห้อง (Status Badges)", "๒"),
        ("บทที่ ๒ ระบบตารางการใช้ห้องเรียนและคาบการสอน (Timetable Matrix)", "๓"),
        ("  ๑. ขั้นตอนการตรวจสอบตารางเรียนแยกตามห้องเรียน", "๓"),
        ("  ๒. ขั้นตอนการค้นหาตารางสอนตามชื่ออาจารย์ผู้สอน", "๓"),
        ("  ๓. การตรวจสอบรายการห้องว่างทั้งหมดในวันนี้", "๓"),
        ("  ๔. สรุปผังการทำงานของระบบตารางเรียน", "๓"),
        ("บทที่ ๓ ระบบจองห้องเรียน ห้องปฏิบัติการ และห้องประชุมออนไลน์", "๔"),
        ("  ๑. ขั้นตอนการยื่นคำขอจองห้องเรียน / ห้องประชุม", "๔"),
        ("  ๒. แผนผังกระบวนการจองและอนุมัติห้องเรียน (Booking Workflow)", "๔"),
        ("  ๓. การติดตามสถานะการจองและการส่งออกไฟล์ CSV", "๔"),
        ("บทที่ ๔ ระบบแจ้งซ่อมและดูแลอุปกรณ์ประจำห้อง (Equipment Maintenance)", "๕"),
        ("  ๑. หมวดหมู่อุปกรณ์ที่รองรับการแจ้งซ่อม (๙ หมวดหมู่)", "๕"),
        ("  ๒. ขั้นตอนการแจ้งปัญหาอุปกรณ์ชำรุดสำหรับผู้ใช้งาน", "๕"),
        ("  ๓. การติดตามสถานะการซ่อมบำรุง", "๕"),
        ("บทที่ ๕ ระบบหนังสือขออนุญาตเปลี่ยนเวรยามออนไลน์ (A4 Official Form)", "๖"),
        ("  ๑. ขั้นตอนการยื่นคำขอเปลี่ยนเวรยามออนไลน์", "๖"),
        ("  ๒. ขั้นตอนการสั่งพิมพ์หนังสือราชการขนาด A4 และแบบฟอร์มเปล่า", "๖"),
        ("บทที่ ๖ ระบบขออนุญาตใช้รถยนต์ส่วนกลาง (Vehicle Reservation v2.0)", "๗"),
        ("  ๑. ช่องทางการเข้าสู่ระบบขออนุญาตใช้รถยนต์ (๔ จุดทางลัด)", "๗"),
        ("  ๒. ขั้นตอนการขออนุญาตใช้รถยนต์ส่วนกลาง", "๗")
    ]
    add_toc_page(doc, toc_items)

    write_system_1(doc, "บทที่ ๑ ")
    doc.add_page_break()
    write_system_2(doc, "บทที่ ๒ ")
    doc.add_page_break()
    write_system_3(doc, "บทที่ ๓ ")
    doc.add_page_break()
    write_system_4(doc, "บทที่ ๔ ")
    doc.add_page_break()
    write_system_5(doc, "บทที่ ๕ ")
    doc.add_page_break()
    write_system_6(doc, "บทที่ ๖ ")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)


def create_individual_manual_docx(output_path, sys_num_thai, sys_title, sub_title, preface_desc, toc_subitems, writer_fn):
    doc = setup_document()

    add_cover_page(
        doc,
        main_title=f"คู่มือการใช้งานระบบสารสนเทศ\n(เล่มที่ {sys_num_thai})",
        sub_title=f"{sys_title}\n{sub_title}",
        doc_code=f"เอกสารคู่มือผู้ใช้งาน (User Manual) - เล่มที่ {sys_num_thai}"
    )

    add_preface_page(doc, [
        f"คู่มือการใช้งาน {sys_title} ฉบับนี้ จัดทำขึ้นเพื่อเป็นแนวทางปฏิบัติสำหรับคณาจารย์ บุคลากร และนักศึกษา คณะวิทยาการจัดการ มหาวิทยาลัยนราธิวาสราชนครินทร์ ในการเข้าใช้งานระบบสารสนเทศด้านอาคารสถานที่และบริการการศึกษาได้อย่างถูกต้อง สะดวก และรวดเร็ว",
        preface_desc,
        "คณะทำงานหวังเป็นอย่างยิ่งว่า คู่มือการใช้งานฉบับนี้จะเป็นประโยชน์ต่อผู้รับบริการทุกท่าน และช่วยยกระดับประสิทธิภาพการบริหารจัดการทรัพยากรส่วนกลางของคณะวิทยาการจัดการให้เกิดประโยชน์สูงสุด"
    ])

    toc_items = [
        ("คำนำ", "ก"),
        ("สารบัญ", "ข"),
        (sys_title, "๑"),
    ] + [(f"  {sub}", "๑") for sub in toc_subitems]

    add_toc_page(doc, toc_items)
    writer_fn(doc, chapter_prefix="")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)


if __name__ == "__main__":
    base_dir = r"C:\Users\PNUCOM4_043\.gemini\antigravity\scratch\classroom-management-system"
    word_dir = os.path.join(base_dir, "manuals", "word")

    # 1. สร้างเล่มรวมฉบับสมบูรณ์ (รวมทั้ง 6 ระบบในเล่มเดียว)
    master_path = os.path.join(base_dir, "คู่มือการใช้งานระบบสารสนเทศ_สำหรับผู้ใช้งาน_ฉบับสมบูรณ์.docx")
    create_master_manual_docx(master_path)
    master_copy_path = os.path.join(word_dir, "00_คู่มือการใช้งานรวมทุกระบบ_ฉบับสมบูรณ์.docx")
    create_master_manual_docx(master_copy_path)

    # 2. สร้างเล่มแยกเฉพาะแต่ละระบบ (6 เล่มแยกกัน มีปก คำนำ สารบัญ ครบทุกเล่ม)
    individual_configs = [
        (
            "01_คู่มือการใช้งาน_ระบบแดชบอร์ดและค้นหาห้องเรียน.docx",
            "๑",
            "ระบบแดชบอร์ดและค้นหาห้องเรียน / ห้องประชุม",
            "(Dashboard & Room Directory System)",
            "เนื้อหาภายในเล่มอธิบายโครงสร้างห้องเรียน ห้องปฏิบัติการคอมพิวเตอร์ และห้องประชุมทั้ง ๒๒ ห้อง ขั้นตอนการดูภาพรวมสถานะห้องแบบเรียลไทม์ การค้นหาห้องว่างตามวันที่ และความหมายของป้ายสถานะต่างๆ อย่างละเอียด",
            [
                "๑. ข้อมูลห้องเรียน ห้องปฏิบัติการ และห้องประชุมในระบบ (๒๒ ห้อง)",
                "๒. ขั้นตอนการใช้งานหน้าแดชบอร์ดภาพรวม (Dashboard)",
                "๓. ขั้นตอนการค้นหาและกรองห้องเรียน (เมนูรายการห้องเรียน)",
                "๔. ความหมายของป้ายสถานะห้อง (Status Badges)"
            ],
            write_system_1
        ),
        (
            "02_คู่มือการใช้งาน_ระบบตารางการใช้ห้องเรียน.docx",
            "๒",
            "ระบบตารางการใช้ห้องเรียนและคาบการสอน",
            "(Timetable Matrix System)",
            "เนื้อหาภายในเล่มอธิบายขั้นตอนการตรวจสอบตารางเรียนประจำสัปดาห์ (๑๘๔ คาบเรียน) การดูตารางเรียนแยกตามรายห้อง การค้นหาตารางสอนตามชื่ออาจารย์ผู้สอน และการดูรายการห้องว่างทั้งหมดในวันปัจจุบัน",
            [
                "๑. ขั้นตอนการตรวจสอบตารางเรียนแยกตามห้องเรียน",
                "๒. ขั้นตอนการค้นหาตารางสอนตามชื่ออาจารย์ผู้สอน",
                "๓. การตรวจสอบรายการห้องว่างทั้งหมดในวันนี้",
                "๔. สรุปผังการทำงานของระบบตารางเรียน"
            ],
            write_system_2
        ),
        (
            "03_คู่มือการใช้งาน_ระบบจองห้องเรียนและห้องประชุม.docx",
            "๓",
            "ระบบจองห้องเรียน ห้องปฏิบัติการ และห้องประชุมออนไลน์",
            "(Online Room Booking System)",
            "เนื้อหาภายในเล่มอธิบายขั้นตอนการยื่นคำขอจองห้องเรียนและห้องประชุมออนไลน์ ระบบการตรวจสอบเวลาชนกันอัตโนมัติ ตารางกระบวนการพิจารณาอนุมัติ และการติดตามสถานะคำขอจองห้อง",
            [
                "๑. ขั้นตอนการยื่นคำขอจองห้องเรียน / ห้องประชุม",
                "๒. แผนผังกระบวนการจองและอนุมัติห้องเรียน (Booking Workflow)",
                "๓. การติดตามสถานะการจองและการส่งออกไฟล์ CSV"
            ],
            write_system_3
        ),
        (
            "04_คู่มือการใช้งาน_ระบบแจ้งซ่อมและดูแลอุปกรณ์.docx",
            "๔",
            "ระบบแจ้งซ่อมและดูแลอุปกรณ์ประจำห้อง",
            "(Equipment Maintenance & Issue Reporting System)",
            "เนื้อหาภายในเล่มอธิบายหมวดหมู่อุปกรณ์ที่รองรับการแจ้งซ่อมทั้ง ๙ หมวดหมู่ ขั้นตอนการเลือกอาการเสียอัตโนมัติ การแนบรูปถ่ายหลักฐาน และการติดตามสถานะการซ่อมบำรุง",
            [
                "๑. หมวดหมู่อุปกรณ์ที่รองรับการแจ้งซ่อม (๙ หมวดหมู่)",
                "๒. ขั้นตอนการแจ้งปัญหาอุปกรณ์ชำรุดสำหรับผู้ใช้งาน",
                "๓. การติดตามสถานะการซ่อมบำรุง"
            ],
            write_system_4
        ),
        (
            "05_คู่มือการใช้งาน_ระบบหนังสือขออนุญาตเปลี่ยนเวรยาม.docx",
            "๕",
            "ระบบหนังสือขออนุญาตเปลี่ยนเวรยามออนไลน์",
            "(Official Shift Swap Request & A4 Printing System)",
            "เนื้อหาภายในเล่มอธิบายขั้นตอนการยื่นคำขออนุญาตเปลี่ยนเวรยามออนไลน์ การระบุผู้รับเปลี่ยนเวรและวันอยู่เวรชดเชย ตลอดจนการสั่งพิมพ์หนังสือราชการขนาด A4 ทั้งแบบมีข้อมูลครบถ้วนและแบบฟอร์มเปล่า",
            [
                "๑. ขั้นตอนการยื่นคำขอเปลี่ยนเวรยามออนไลน์",
                "๒. ขั้นตอนการสั่งพิมพ์หนังสือราชการขนาด A4 และแบบฟอร์มเปล่า"
            ],
            write_system_5
        ),
        (
            "06_คู่มือการใช้งาน_ระบบขออนุญาตใช้รถยนต์ส่วนกลาง.docx",
            "๖",
            "ระบบขออนุญาตใช้รถยนต์ส่วนกลาง (Version 2.0)",
            "(Faculty Vehicle Request Portal)",
            "เนื้อหาภายในเล่มอธิบายช่องทางลัดทั้ง ๔ จุดในการเข้าสู่ระบบขออนุญาตใช้รถยนต์ส่วนกลางของคณะวิทยาการจัดการ ขั้นตอนการตรวจสอบคิวรถ และการยื่นคำขออนุญาตเดินทางไปราชการ",
            [
                "๑. ช่องทางการเข้าสู่ระบบขออนุญาตใช้รถยนต์ (๔ จุดทางลัด)",
                "๒. ขั้นตอนการขออนุญาตใช้รถยนต์ส่วนกลาง"
            ],
            write_system_6
        ),
    ]

    for filename, num_th, title, sub, pref, sub_toc, fn in individual_configs:
        out_file = os.path.join(word_dir, filename)
        create_individual_manual_docx(out_file, num_th, title, sub, pref, sub_toc, fn)

    print("SUCCESS: Generated all Word (.docx) user manual books!")
