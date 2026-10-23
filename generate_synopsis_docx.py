"""
Generate a professional, academic/institutional Microsoft Word (.docx) Synopsis Report
for 3D-ULPIN (3D Cadastral System for Vertical Property Mapping and Unique Spatial Identity).
Formatting: Strictly Bold Black / Monochrome Typography, New Page per Section,
and Exact Title/Consent Pages at the beginning.
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

# --- Color Palette: Strict Formal Black & Grayscale ---
COLOR_BLACK_HEX = "000000"
COLOR_DARK_HEX = "111111"
COLOR_MUTED_HEX = "333333"
COLOR_LIGHT_BG_HEX = "F4F4F4"     # Light Neutral Shading
COLOR_ALT_ROW_HEX = "FAFAFA"      # Very subtle alternating row
COLOR_BORDER_HEX = "999999"       # Clear border gray

COLOR_BLACK = RGBColor(0, 0, 0)
COLOR_DARK = RGBColor(17, 17, 17)
COLOR_MUTED = RGBColor(51, 51, 51)

def set_cell_background(cell, hex_color):
    """Set background color of a table cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tc_pr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    """Set inner padding for a table cell in dxa (1 pt = 20 dxa)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tc_pr.append(tc_mar)

def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    """Set specific borders on a cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = OxmlElement('w:tcBorders')
    
    borders = {'top': top, 'bottom': bottom, 'left': left, 'right': right}
    for border_name, border_style in borders.items():
        if border_style:
            b_element = parse_xml(
                f'<w:{border_name} {nsdecls("w")} '
                f'w:val="{border_style.get("val", "single")}" '
                f'w:sz="{border_style.get("sz", "4")}" '
                f'w:space="0" '
                f'w:color="{border_style.get("color", "000000")}"/>'
            )
            tc_borders.append(b_element)
        else:
            b_element = parse_xml(f'<w:{border_name} {nsdecls("w")} w:val="none"/>')
            tc_borders.append(b_element)
    tc_pr.append(tc_borders)

def add_callout(doc, text, title=""):
    """Add a professional black & grayscale callout box."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, COLOR_LIGHT_BG_HEX)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=180)
    set_cell_borders(cell, left={"val": "single", "sz": "24", "color": COLOR_BLACK_HEX},
                           top={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                           bottom={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                           right={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX})
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    if title:
        run_title = p.add_run(f"{title}\n")
        run_title.bold = True
        run_title.font.name = 'Times New Roman'
        run_title.font.size = Pt(11)
        run_title.font.color.rgb = COLOR_BLACK
        
    run_text = p.add_run(text)
    run_text.font.name = 'Times New Roman'
    run_text.font.size = Pt(10)
    run_text.font.color.rgb = COLOR_DARK
    
    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(0)
    p_spacer.paragraph_format.space_after = Pt(4)

def format_table(table, col_widths, col_alignments=None):
    """Format table with bold black headers, solid borders, and clean row spacing."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    for i, row in enumerate(table.rows):
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
        
        if i == 0:
            trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
        
        for j, cell in enumerate(row.cells):
            cell.width = col_widths[j]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            
            if col_alignments and j < len(col_alignments):
                p.alignment = col_alignments[j]
            
            if i == 0:
                set_cell_background(cell, COLOR_BLACK_HEX)
                set_cell_borders(cell, 
                    top={"val": "single", "sz": "12", "color": COLOR_BLACK_HEX},
                    bottom={"val": "single", "sz": "12", "color": COLOR_BLACK_HEX},
                    left={"val": "single", "sz": "4", "color": "333333"},
                    right={"val": "single", "sz": "4", "color": "333333"}
                )
                for run in p.runs:
                    run.bold = True
                    run.font.name = 'Times New Roman'
                    run.font.size = Pt(10)
                    run.font.color.rgb = RGBColor(255, 255, 255)
            else:
                bg = COLOR_ALT_ROW_HEX if i % 2 == 1 else "FFFFFF"
                set_cell_background(cell, bg)
                set_cell_borders(cell, 
                    top={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                    bottom={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                    left={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                    right={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX}
                )
                for run in p.runs:
                    run.font.name = 'Times New Roman'
                    run.font.size = Pt(9.5)
                    run.font.color.rgb = COLOR_BLACK

def create_synopsis_document(output_path):
    doc = docx.Document()
    
    # Page Setup
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
        
        # Configure Header & Footer
        header = section.header
        p_hdr = header.paragraphs[0]
        p_hdr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_hdr = p_hdr.add_run("3D Cadastral System for Vertical Property Mapping (3D ULPIN)")
        r_hdr.font.name = 'Times New Roman'
        r_hdr.font.size = Pt(8.5)
        r_hdr.font.color.rgb = COLOR_MUTED
        
        footer = section.footer
        p_ftr = footer.paragraphs[0]
        p_ftr.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_ftr_l = p_ftr.add_run("Department of CSE (AI & ML) | PIET (Affiliated to Kurukshetra University)")
        r_ftr_l.font.name = 'Times New Roman'
        r_ftr_l.font.size = Pt(8.5)
        r_ftr_l.font.color.rgb = COLOR_MUTED

    # Global Style: Times New Roman / Calibri, Black
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Times New Roman'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = COLOR_BLACK

    # Helper text functions
    def add_p(text, bold_prefix="", align=WD_ALIGN_PARAGRAPH.LEFT, space_before=0, space_after=6):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.bold = True
            r_pre.font.name = 'Times New Roman'
            r_pre.font.color.rgb = COLOR_BLACK
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.color.rgb = COLOR_BLACK
        return p

    def add_bullet(text, bold_prefix="", level=0):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.left_indent = Inches(0.25 * (level + 1))
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.bold = True
            r_pre.font.name = 'Times New Roman'
            r_pre.font.color.rgb = COLOR_BLACK
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.color.rgb = COLOR_BLACK
        return p

    def add_h1(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.bold = True
        r.font.name = 'Times New Roman'
        r.font.size = Pt(15)
        r.font.color.rgb = COLOR_BLACK
        return h

    def add_h2(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(10)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.bold = True
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12.5)
        r.font.color.rgb = COLOR_BLACK
        return h

    def add_h3(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(8)
        h.paragraph_format.space_after = Pt(2)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.bold = True
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.font.color.rgb = COLOR_BLACK
        return h

    # =============================================================
    # PAGE 1: COVER / TITLE PAGE (Matches Image 1)
    # =============================================================
    add_p("Project Synopsis", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=2)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(18)
    
    add_p("on", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(14)
    
    add_p("3D Cadastral System for Vertical Property Mapping\nand Unique Spatial Identity (3D ULPIN)", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=14)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(17)
    
    add_p("Submitted in partial fulfillment\nfor the award of the degree of", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=6, space_after=10)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(13)
    
    add_p("Bachelor of Technology", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=4, space_after=2)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(15)
    
    add_p("in", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(13)
    
    add_p("Computer Science Engineering\n(Artificial Intelligence & Machine Learning)", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=14)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(14)
    
    add_p("Submitted By", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=6, space_after=4)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(14)
    
    # Students Table
    t_stud = doc.add_table(rows=3, cols=2)
    t_stud.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_stud.autofit = False
    stud_w = [Inches(3.0), Inches(2.0)]
    stud_data = [
        ("Harsh Tiwari", "28240572"),
        ("Rishabh Dev", "28240579"),
        ("Prateek Singh Bisht", "28240591")
    ]
    for idx, (name, roll) in enumerate(stud_data):
        row = t_stud.rows[idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width, c1.width = stud_w[0], stud_w[1]
        set_cell_borders(c0, top={"val":"none"}, bottom={"val":"none"}, left={"val":"none"}, right={"val":"none"})
        set_cell_borders(c1, top={"val":"none"}, bottom={"val":"none"}, left={"val":"none"}, right={"val":"none"})
        set_cell_margins(c0, top=20, bottom=20, left=40, right=40)
        set_cell_margins(c1, top=20, bottom=20, left=40, right=40)
        
        p0 = c0.paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r0 = p0.add_run(name)
        r0.bold = True
        r0.font.name = 'Times New Roman'
        r0.font.size = Pt(12)
        r0.font.color.rgb = COLOR_BLACK
        
        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r1 = p1.add_run(roll)
        r1.bold = True
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(12)
        r1.font.color.rgb = COLOR_BLACK

    add_p("Under the Supervision of", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=14, space_after=2)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(14)
    
    add_p("Prof. (Dr.) Devendra Parsad", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=0)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(13)
    
    add_p("HOD CSE AI & ML", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=8)
    doc.paragraphs[-1].runs[0].bold = False
    doc.paragraphs[-1].runs[0].font.size = Pt(11)
    
    # PIET Logo
    if os.path.exists("assets/piet_logo.png"):
        p_logo1 = doc.add_paragraph()
        p_logo1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo1.paragraph_format.space_before = Pt(2)
        p_logo1.paragraph_format.space_after = Pt(4)
        run_logo1 = p_logo1.add_run()
        run_logo1.add_picture("assets/piet_logo.png", width=Inches(1.2))
    
    add_p("Panipat Institute of Engineering & Technology,\nSamalkha, Panipat", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=2)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(13)
    
    add_p("Affiliated to", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=2)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(12)
    
    # KUK Logo
    if os.path.exists("assets/kuk_logo.png"):
        p_logo2 = doc.add_paragraph()
        p_logo2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo2.paragraph_format.space_before = Pt(2)
        p_logo2.paragraph_format.space_after = Pt(4)
        run_logo2 = p_logo2.add_run()
        run_logo2.add_picture("assets/kuk_logo.png", width=Inches(1.15))
        
    add_p("Kurukshetra University Kurukshetra, India", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=2)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(13)
    
    add_p("(2024-2028)", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=0)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(12)

    # =============================================================
    # PAGE 2: SUPERVISOR'S CONSENT & DPEC REMARKS (Matches Image 2)
    # =============================================================
    doc.add_page_break()
    
    add_p("Supervisor's Consent", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=16, space_after=18)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(18)
    
    # Consent Table (2 columns, Left content, Right signature box)
    t_consent = doc.add_table(rows=1, cols=2)
    t_consent.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_consent.autofit = False
    t_consent_w = [Inches(4.5), Inches(2.0)]
    
    row_c = t_consent.rows[0]
    c_left, c_right = row_c.cells[0], row_c.cells[1]
    c_left.width, c_right.width = t_consent_w[0], t_consent_w[1]
    set_cell_background(c_left, "FFFFFF")
    set_cell_background(c_right, "FFFFFF")
    set_cell_margins(c_left, top=140, bottom=140, left=140, right=140)
    set_cell_margins(c_right, top=140, bottom=140, left=140, right=140)
    set_cell_borders(c_left, top={"val":"single", "sz":"8", "color":"000000"},
                             bottom={"val":"single", "sz":"8", "color":"000000"},
                             left={"val":"single", "sz":"8", "color":"000000"},
                             right={"val":"single", "sz":"8", "color":"000000"})
    set_cell_borders(c_right, top={"val":"single", "sz":"8", "color":"000000"},
                              bottom={"val":"single", "sz":"8", "color":"000000"},
                              left={"val":"single", "sz":"8", "color":"000000"},
                              right={"val":"single", "sz":"8", "color":"000000"})
    
    p_cl = c_left.paragraphs[0]
    p_cl.paragraph_format.line_spacing = 1.2
    r_cl1 = p_cl.add_run("The synopsis of final year project work titled ")
    r_cl1.font.name = 'Times New Roman'
    r_cl1.font.size = Pt(10.5)
    r_cl2 = p_cl.add_run("“3D Cadastral System for Vertical Property Mapping and Unique Spatial Identity (3D ULPIN)”")
    r_cl2.bold = True
    r_cl2.font.name = 'Times New Roman'
    r_cl2.font.size = Pt(10.5)
    r_cl3 = p_cl.add_run(" by the students’ group id. ........... has been written with my consent and every section of this synopsis report is reflecting the work to be carried out by the group.")
    r_cl3.font.name = 'Times New Roman'
    r_cl3.font.size = Pt(10.5)
    
    p_cr = c_right.paragraphs[0]
    p_cr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cr.paragraph_format.space_before = Pt(30)
    r_cr = p_cr.add_run("(Signature of\nsupervisor with date)")
    r_cr.italic = True
    r_cr.font.name = 'Times New Roman'
    r_cr.font.size = Pt(10)
    
    add_p("Department Project Evaluation Committee (DPEC) Remarks", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=40, space_after=20)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(14)
    
    add_p(
        "The project is ..................................................... by DPEC. The group is advised to submit progress of the project work in progress presentation to be held on .......................................................................",
        space_before=6, space_after=14
    )
    doc.paragraphs[-1].paragraph_format.line_spacing = 1.3
    
    add_p("OR", align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=10)
    doc.paragraphs[-1].runs[0].bold = True
    doc.paragraphs[-1].runs[0].font.size = Pt(12)
    
    add_p(
        "The project is ..................................................... by DPEC. The group is advised to submit the synopsis report again after making changes as suggested by DPEC on .....................................................................",
        space_before=10, space_after=40
    )
    doc.paragraphs[-1].paragraph_format.line_spacing = 1.3
    
    p_dpec_sign = doc.add_paragraph()
    p_dpec_sign.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_dpec_sign.paragraph_format.space_before = Pt(30)
    p_dpec_sign.paragraph_format.space_after = Pt(0)
    r_dots = p_dpec_sign.add_run("..................................................................\n")
    r_sign = p_dpec_sign.add_run("Name & Signature of DPEC member (s) with date")
    r_dots.font.name = 'Times New Roman'
    r_sign.font.name = 'Times New Roman'
    r_sign.font.size = Pt(10.5)

    # =============================================================
    # PAGE 3: EXECUTIVE SUMMARY & PROJECT METADATA
    # =============================================================
    doc.add_page_break()
    
    add_h1("Executive Summary & Project Overview")
    
    meta_tbl = doc.add_table(rows=5, cols=2)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_tbl.autofit = False
    col_w = [Inches(2.2), Inches(4.3)]
    
    meta_data = [
        ("Project Title:", "3D Cadastral System for Vertical Property Mapping and Unique Spatial Identity (3D ULPIN)"),
        ("Project Domain / Field:", "Geospatial AI, 3D Geographic Information Systems (GIS), Cadastral Science"),
        ("Standard Compliance:", "ISO 19152 LADM, OGC CityGML/CityJSON LoD-1/2, DILRMP Bhu-Aadhaar"),
        ("Core Technology Stack:", "FastAPI, React 18, Deck.gl v9, Three.js, PostgreSQL/PostGIS, Gemini Vision AI"),
        ("Academic Affiliation:", "PIET, Kurukshetra University, Haryana, India (Batch: 2024-2028)")
    ]
    
    for row_idx, (label, val) in enumerate(meta_data):
        row = meta_tbl.rows[row_idx]
        cell_lbl, cell_val = row.cells[0], row.cells[1]
        cell_lbl.width, cell_val.width = col_w[0], col_w[1]
        set_cell_background(cell_lbl, COLOR_LIGHT_BG_HEX)
        set_cell_background(cell_val, "FFFFFF")
        set_cell_margins(cell_lbl, top=60, bottom=60, left=100, right=100)
        set_cell_margins(cell_val, top=60, bottom=60, left=100, right=100)
        set_cell_borders(cell_lbl, top={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                                   bottom={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                                   left={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                                   right={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX})
        set_cell_borders(cell_val, top={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                                   bottom={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                                   left={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX},
                                   right={"val": "single", "sz": "4", "color": COLOR_BORDER_HEX})
        
        p0 = cell_lbl.paragraphs[0]
        p0.paragraph_format.space_before, p0.paragraph_format.space_after = Pt(2), Pt(2)
        r0 = p0.add_run(label)
        r0.bold = True
        r0.font.name = 'Times New Roman'
        r0.font.size = Pt(9.5)
        r0.font.color.rgb = COLOR_BLACK
        
        p1 = cell_val.paragraphs[0]
        p1.paragraph_format.space_before, p1.paragraph_format.space_after = Pt(2), Pt(2)
        r1 = p1.add_run(val)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = COLOR_BLACK

    add_p("", space_before=4, space_after=4)
    
    add_callout(doc,
        "Abstract & Synopsis Summary:\n\n"
        "Traditional land administration worldwide relies on 2D surface cadastral maps (Khasra/Plot parcels). In modern high-density urban agglomerations, multi-story residential towers, commercial high-rises, and subterranean utilities (metro tunnels, water, gas, electricity) occupy the same 2D footprint, resulting in profound vertical ambiguity, property dispute vulnerabilities, and municipal revenue leakages. The 3D-ULPIN platform presents an end-to-end, AI-powered 3D Cadastral & Volumetric Land Registry System. By ingesting OpenStreetMap data, high-resolution satellite imagery, and indoor CAD/GeoJSON floor plans, and processing them through Google Gemini Multimodal Vision AI, OpenCV heuristics, and PostGIS 3D topological engines, 3D-ULPIN synthesizes standardized volumetric parcel identifiers (ULPIN-3D), generates 3D digital twin meshes across Level-of-Detail 1 and 2, detects underground infrastructure clashes, and enables interactive strata visualization.",
        "EXECUTIVE SUMMARY & ABSTRACT"
    )

    # =============================================================
    # PAGE 4: 1. INTRODUCTION
    # =============================================================
    doc.add_page_break()
    add_h1("1. Introduction")
    
    add_h2("1.1 Background and Context")
    add_p(
        "Land administration and cadastral survey systems form the foundational bedrock of national economic infrastructure, property rights protection, municipal taxation, and urban planning. Historically, cadastres originated as planar 2D recording systems designed to map agricultural fields and surface parcels (known in India as Khasra or Survey Numbers). Under the Digital India Land Records Modernization Programme (DILRMP), the Department of Land Resources (DoLR), Ministry of Rural Development, introduced the 14-digit Unique Land Parcel Identification Number (ULPIN) — colloquially termed 'Bhu-Aadhaar' — to establish a single, georeferenced identity for every land parcel across India."
    )
    add_p(
        "While 2D ULPIN represents a monumental milestone for horizontal land governance, the rapid urbanization of metropolitan regions (such as Mumbai, Delhi-NCR, Bengaluru, Hyderabad, and Pune) has precipitated unprecedented vertical densification. Modern urban developments are characterized by high-rise residential towers, multi-tier commercial complexes, sky-bridges, underground transit tunnels, multi-level basement parking, and intricate subterranean utility networks. All these diverse spatial entities share a single 2D polygon footprint on the surface plane, creating a severe operational bottleneck in traditional 2D land registers."
    )
    
    add_h2("1.2 The Paradigm Shift: 2D Surface Cadastre vs. 3D Volumetric Cadastre")
    add_p(
        "In a conventional 2D cadastre, an entire 40-story residential skyscraper containing 200 distinct ownership units and 3 basement levels is registered as a single flat polygon. Consequently, ownership rights to individual vertical apartments are documented purely through textual deeds (e.g., 'Flat 1402, 14th Floor, Tower B') with zero spatial representation in the GIS land registry. This discrepancy manifests in several critical vulnerabilities:"
    )
    add_bullet("Vertical Spatial Ambiguity: ", "Inability to delineate discrete 3D property boundaries (Z-axis elevations, floor heights, unit volumes) or verify physical overlaps between vertically stacked apartments.")
    add_bullet("Subsurface Infrastructure Blind Spots: ", "Absence of spatial records for subterranean assets (metro tunnels, pipeline corridors, fiber-optic ducts, deep foundations), leading to catastrophic utility strikes during urban excavation.")
    add_bullet("Legal and Financial Friction: ", "Banks, title insurance providers, and judicial courts face immense friction when verifying collateral in multi-unit strata titles, exacerbating real-estate litigation.")
    add_bullet("Taxation and Valuation Inefficiencies: ", "Municipal corporations lack volumetric data to compute property tax based on actual floor area, floor height premiums, daylight obstruction, and view factors.")

    add_p(
        "The 3D-ULPIN project bridges this critical gap by expanding the 2D Bhu-Aadhaar paradigm into a Volumetric 3D Cadastral Digital Twin System, fully aligned with the International Standard for Land Administration (ISO 19152 LADM) and Open Geospatial Consortium (OGC) CityGML/CityJSON Level of Detail (LoD) specifications."
    )

    add_h3("Comparative Analysis: 2D Land Cadastre vs. 3D-ULPIN Volumetric Digital Twin")
    t_comp = doc.add_table(rows=6, cols=3)
    t_comp_widths = [Inches(1.8), Inches(2.3), Inches(2.4)]
    
    t_comp_data = [
        ("Cadastral Parameter", "Traditional 2D Cadastre (Bhu-Aadhaar)", "3D-ULPIN Volumetric Cadastre"),
        ("Spatial Domain", "2D Planar Surface Polygon (X, Y Coordinates)", "3D Volumetric Spatial Envelope (X, Y, Z_min, Z_max)"),
        ("Strata Property Delineation", "Textual records only; no vertical GIS geometry", "Explicit 3D bounding geometry per unit and common area"),
        ("Subsurface Infrastructure", "Completely unmapped / outside cadastre", "Dedicated 3D utility layers with depth and buffer clearance"),
        ("Topological Validation", "2D polygon non-overlap and containment", "3D Boolean intersection, clash detection & volume checks"),
        ("Data Standards", "State-specific 2D shapefiles / DWG", "ISO 19152 LADM, CityJSON, GeoJSON-3D, GLTF/GLB")
    ]
    for r_idx, row_vals in enumerate(t_comp_data):
        for c_idx, val in enumerate(row_vals):
            t_comp.rows[r_idx].cells[c_idx].paragraphs[0].text = val
    format_table(t_comp, t_comp_widths, [WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT])

    # =============================================================
    # PAGE 5: 2. OBJECTIVES
    # =============================================================
    doc.add_page_break()
    add_h1("2. Project Objectives")
    add_p(
        "The primary ambition of the 3D-ULPIN platform is to engineer an automated, robust, and scalable software framework capable of converting 2D cadastral records, satellite imagery, and architectural plans into mathematically validated, vertically partitioned 3D cadastral digital twins."
    )
    
    add_h2("2.1 Primary Objectives")
    add_bullet("Universal 3D Property Identification (ULPIN-3D): ", "Formulate and implement an algorithmic identifier standard that hierarchically extends India's 14-digit ULPIN by embedding geodetic centroids, building identifiers, vertical floor indices, discrete unit codes, and 3D spatial Geohashes.")
    add_bullet("Autonomous 3D Building Reconstruction: ", "Develop an automated pipeline combining OpenStreetMap (OSM) Overpass vector geometry, ESRI/Mapbox satellite imagery, and Computer Vision (OpenCV + Gemini Multimodal Vision AI) to extract building footprints and extrude 3D volumetric envelopes.")
    add_bullet("Multi-Strata Vertical Partitioning: ", "Implement geometric slicing algorithms and indoor CAD/GeoJSON floor plan parsers to partition 3D building masses into discrete floors, residential/commercial units, and common utility areas.")
    add_bullet("Subterranean Infrastructure & Clash Detection: ", "Incorporate 3D subsurface utility mapping (water, gas, electricity, telecom, stormwater) and subterranean parking/metro corridors with automated vertical buffer clearance calculations.")
    add_bullet("3D Topological Validation Engine: ", "Construct a rigorous 3D spatial validator using PostGIS and Shapely to verify boundary containment, zero volumetric overlaps, and non-intersection constraints across all strata units.")
    add_bullet("Interactive High-Performance 3D Viewport: ", "Deliver an intuitive, browser-based 3D digital twin studio powered by Deck.gl v9, Three.js, and WebGL/WebGPU, offering dynamic strata isolation, X-ray mode, daylight shadow simulations, and multi-format spatial export.")

    add_h2("2.2 Secondary and Operational Objectives")
    add_bullet("Interoperability & Open Standards: ", "Support seamless bi-directional data exchange through GeoJSON-3D, CityJSON, OBJ, and GLTF/GLB formats to integrate with municipal GIS portals.")
    add_bullet("Automated Cadastral Certificate Generation: ", "Produce cryptographically verifiable, downloadable 3D Cadastral Property Passports and title certificates embedding volumetric dimensions, floor heights, and QR-verifiable ULPINs.")
    add_bullet("Low-Latency Microservice Architecture: ", "Engineer an asynchronous FastAPI backend paired with background worker queues and distributed caching to ensure high-throughput processing across thousands of parcels.")

    # =============================================================
    # PAGE 6: 3. PROJECT SCOPE
    # =============================================================
    doc.add_page_break()
    add_h1("3. Project Scope")
    
    add_h2("3.1 Functional Scope")
    add_p("The functional scope encompasses all technical modules required for modern 3D land administration:")
    add_bullet("Geospatial Ingestion Workbench: ", "Accepts multiple input modalities including coordinate pairs (DD, DMS, directional), landmark queries, postal addresses, and 2D cadastral shapefiles.")
    add_bullet("AI-Assisted Architectural Extraction: ", "Autonomous extraction of structural dimensions, floor counts, building heights, and roof typologies using multimodal satellite vision analysis and empirical building code heuristics.")
    add_bullet("Floor Plan Ingestion & Regularization: ", "Parsing of DXF/DWG/GeoJSON architectural layout drawings into georeferenced internal unit boundaries.")
    add_bullet("Volumetric Cadastre Management: ", "Full CRUD lifecycle management of land parcels, multi-building societies, floors, strata units, and subterranean assets in a 3D PostGIS spatial database.")
    add_bullet("Inspection & Analysis HUD: ", "Rich graphical interface enabling 3D slicing, floor-by-floor inspection, sunlight/shadow trajectory analysis, and volumetric area calculations.")

    add_h2("3.2 Spatial and Architectural Scope")
    add_bullet("High-Rise Residential and Commercial Complexes: ", "Multi-tower gated societies, commercial office parks, and mixed-use urban developments.")
    add_bullet("Historical & Complex Structures: ", "Parametric LoD-2 volumetric modeling for landmarks, heritage structures, and institutional campuses.")
    add_bullet("Subterranean Corridors: ", "Underground basement parking levels (B1, B2, B3), metro transit tunnels, deep foundation envelopes, and utility corridors up to 30 meters depth.")

    add_h2("3.3 Stakeholder Ecosystem")
    add_bullet("Revenue & Land Survey Departments: ", "State and central cadastral authorities modernizing registry databases under DILRMP.")
    add_bullet("Municipal Corporations & Urban Local Bodies (ULBs): ", "City planning, property tax assessment, FAR/FSI compliance monitoring, and building permission approvals.")
    add_bullet("Financial Institutions & Mortgage Lenders: ", "Verification of 3D spatial titles to prevent double-mortgaging and fraudulent land transactions.")
    add_bullet("Utility Operators & Infrastructure Agencies: ", "Coordinating underground pipeline excavation to eliminate utility clashes and service disruptions.")
    add_bullet("Citizens & Property Buyers: ", "Verifying authentic vertical strata titles, unit dimensions, daylight rights, and legal encumbrance reports.")

    add_h2("3.4 Current Operational Boundaries & Constraints")
    add_p(
        "The current implementation (MVP Level 2/3) utilizes mathematical extrusion (2.5D) from regularized 2D footprints and grid-based floor slicing when raw architectural CAD plans are unavailable. While advanced features such as high-density LiDAR point-cloud meshing, drone photogrammetry, and real-time blockchain title notarization are scoped for future phases, the existing system establishes a fully functional, production-ready microservices baseline."
    )

    # =============================================================
    # PAGE 7: 4. SYSTEM ARCHITECTURE
    # =============================================================
    doc.add_page_break()
    add_h1("4. System Architecture")
    add_p(
        "The 3D-ULPIN system is designed on a modular, decoupled, multi-tier architecture optimized for geospatial computing, asynchronous AI workloads, and low-latency 3D mesh streaming. The architecture comprises five primary functional tiers."
    )
    
    add_h2("4.1 Architectural Overview")
    
    t_arch = doc.add_table(rows=6, cols=3)
    t_arch_widths = [Inches(1.5), Inches(2.2), Inches(2.8)]
    
    t_arch_data = [
        ("Tier / Layer", "Core Technologies", "Key Responsibilities & Components"),
        ("Presentation Layer (Frontend Client)", "React 18, TypeScript 5.4, Vite, Deck.gl v9, Three.js, MapLibre GL", "Interactive 3D Cadastral Studio, Strata Inspector HUD, Subsurface Visualizer, Certificate Generator, Glassmorphic UI"),
        ("API Gateway & Orchestration", "FastAPI (Python 3.11), Uvicorn, Pydantic v2, Async Background Jobs", "RESTful routing, asynchronous job queuing, coordinate validation, rate limiting, and response serialization"),
        ("Spatial AI & Geometric Engine", "OpenCV, Shapely, GeoPandas, Google Gemini 2.5/3.6 Flash, pygeohash", "Satellite tile processing, hybrid contour extraction, LLM vision classification, 3D polygon extrusion, ULPIN synthesis"),
        ("Data Persistence & 3D GIS", "PostgreSQL 15+, PostGIS 3.3+, SQLAlchemy ORM, Supabase", "3D spatial indexing (ST_3DIntersects), relational storage of Parcels, Buildings, Floors, Units, Validation Logs"),
        ("External Geospatial Providers", "OpenStreetMap Overpass API, ESRI World Imagery, Mapbox Satellite", "Global vector basemaps, high-resolution satellite imagery tiles, geocoding & elevation services")
    ]
    for r_idx, row_vals in enumerate(t_arch_data):
        for c_idx, val in enumerate(row_vals):
            t_arch.rows[r_idx].cells[c_idx].paragraphs[0].text = val
    format_table(t_arch, t_arch_widths, [WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT])

    add_h2("4.2 Database Relational and Spatial Schema")
    add_p(
        "The database follows an enhanced cadastral hierarchy representing the complete 3D property lifecycle with native PostGIS geometric types (EPSG:4326):"
    )
    add_bullet("Parcels Table: ", "Stores parent land parcels with 2D boundary polygons, geodetic center (lat/lon), and legal 2D Parcel ID.")
    add_bullet("Buildings Table: ", "Represents individual structures within a parcel with 2D footprint geometry, total height (meters), floor counts, centroid, and society relationships.")
    add_bullet("Floors Table: ", "Dedicated vertical tier capturing floor number, elevation range (z_min, z_max), height in meters, floor area, and 2D floor boundary.")
    add_bullet("Units Table: ", "Represents individual strata units (apartments, offices, retail spaces) storing unique ULPIN-3D strings, floor height, 3D spatial centroid, square footage, and polygon boundaries.")
    add_bullet("ValidationLogs Table: ", "Maintains topological integrity reports, overlap counts, containment status, and quantitative confidence scores.")
    add_bullet("Jobs Table: ", "Tracks asynchronous pipeline execution states (pending, processing, completed, failed) with step progress telemetry.")

    # =============================================================
    # PAGE 8: 5. METHODOLOGY & IMPLEMENTATION PIPELINE
    # =============================================================
    doc.add_page_break()
    add_h1("5. Methodology & Implementation Pipeline")
    add_p(
        "The end-to-end processing pipeline transforms raw geographic coordinates or landmark queries into a fully validated 3D cadastral digital twin through a nine-stage scientific workflow."
    )

    add_h2("5.1 Phase 1: Universal Geospatial Ingestion & Coordinate Parsing")
    add_p(
        "The ingestion pipeline accepts diverse spatial inputs (Decimal Degrees, DMS, landmark strings) and standardizes them via a robust geocoding resolver. It verifies coordinates against the WGS84 (EPSG:4326) reference ellipsoid and determines the bounding envelope for subsequent tile fetching."
    )

    add_h2("5.2 Phase 2: High-Resolution Satellite & Vector Data Acquisition")
    add_p(
        "The system dispatches concurrent queries to OpenStreetMap (OSM) Overpass API to fetch building footprints, height tags (height, building:levels), and parcel boundaries. In parallel, it downloads high-resolution optical satellite imagery tiles (Zoom Level 18-19) from ESRI World Imagery and Mapbox for computer vision analysis."
    )

    add_h2("5.3 Phase 3: AI Multimodal Vision & Hybrid Footprint Extraction")
    add_p(
        "Building boundaries are extracted using a robust hybrid methodology combining deterministic GIS ground truth, classical computer vision, and Large Multimodal Models (LMMs):"
    )
    add_bullet("Primary Extraction (Vector GIS): ", "Direct extraction of topological building polygons from OpenStreetMap Overpass datasets.")
    add_bullet("Vision AI Analysis (Gemini 2.5/3.6 Flash): ", "Satellite tiles are analyzed by Google Gemini Vision to classify structural typology, roof configuration (flat, pitched, hipped), aesthetic facade attributes, and estimated floor levels.")
    add_bullet("Heuristic Regularization (OpenCV & Shapely): ", "Canny edge detection and Douglas-Peucker polygon simplification algorithms smooth raw contours and rectify non-orthogonal building edges.")

    add_h2("5.4 Phase 4: Elevation, Height Estimation, and LoD Modeling")
    add_p(
        "Building heights are calculated through a multi-tier hierarchy: (1) explicit OSM height tags; (2) Gemini Vision vertical estimation; (3) regional building code standard floor height multipliers (h = N_floors * 3.5m). Buildings are modeled as Level of Detail 1 (LoD-1) prismatic volumes or LoD-2 structured geometries with roof pitch adjustments."
    )

    add_h2("5.5 Phase 5: Multi-Strata Slicing & Indoor CAD Plan Ingestion")
    add_p(
        "The 3D volume is vertically divided into discrete floor slabs: [z_min_i, z_max_i] = [i * h_floor, (i+1) * h_floor]. Where indoor CAD/DWG or GeoJSON floor plans are uploaded, the system parses internal wall vectors and unit polygons. In the absence of architectural drawings, floor footprints are partitioned into strata units using mathematical quadrant division algorithms."
    )

    add_h2("5.6 Phase 6: Volumetric 3D-ULPIN Synthesis Algorithm")
    add_p(
        "Every 3D unit is assigned a deterministic, globally unique 3D-ULPIN identifier following the mathematical formulation:"
    )
    
    add_callout(doc,
        "Mathematical Standard for 3D-ULPIN Synthesis:\n\n"
        "ULPIN-3D = {PARCEL_ID}-{BLDG_UUID[:8]}-F{FLOOR:02d}-U{UNIT_ID}-{GEOHASH_3D}\n\n"
        "Where:\n"
        "• PARCEL_ID = Official 14-digit Bhu-Aadhaar 2D Land Identifier\n"
        "• BLDG_UUID = Unique Hexadecimal Building Sub-Identifier\n"
        "• FLOOR = Two-digit zero-padded vertical floor index (e.g., F14, B02)\n"
        "• UNIT_ID = Unit designation within the floor (e.g., UA01, U102)\n"
        "• GEOHASH_3D = 7-character Geohash encoding spatial centroid + vertical elevation band (z_min to z_max)",
        "3D-ULPIN ALGORITHM SPECIFICATION"
    )

    add_h2("5.7 Phase 7: Subterranean Infrastructure & Utility Corridor Modeling")
    add_p(
        "The underground engine constructs 3D spatial models for subterranean utilities spanning water distribution mains (depth: -1.5m), gas pipelines (depth: -2.0m), electrical conduits (depth: -1.2m), stormwater sewers (depth: -3.5m), and basement parking levels (-3.5m per tier). It computes real-time 3D Euclidean distances to identify hazardous utility strikes."
    )

    add_h2("5.8 Phase 8: 3D Topological Validation & Quality Assurance")
    add_p(
        "A dedicated PostGIS validation engine performs 3D Boolean spatial checks:"
    )
    add_bullet("Volumetric Non-Overlap: ", "Verifies that Volume(Unit_A ∩ Unit_B) == 0 for all distinct units.")
    add_bullet("Envelope Containment: ", "Confirms that all internal strata polygons lie strictly inside the legal parent parcel boundary.")
    add_bullet("Confidence Metric: ", "Computes an aggregate topological confidence score (0-100%) factoring geometric precision, elevation consistency, and data provenance.")

    add_h2("5.9 Phase 9: Real-Time 3D Rendering & Multi-Format Spatial Export")
    add_p(
        "The interactive viewport renders 3D geometries via Deck.gl v9 and Three.js with full lighting, raycasted shadow envelopes, and interactive strata selection. Parcels can be exported directly to standard geospatial formats: GeoJSON-3D, CityJSON, Wavefront OBJ, and GLTF/GLB."
    )

    add_h3("End-to-End Pipeline Execution Stages")
    t_pipe = doc.add_table(rows=10, cols=3)
    t_pipe_widths = [Inches(0.8), Inches(2.2), Inches(3.5)]
    
    pipe_stages = [
        ("Stage", "Pipeline Module", "Input / Processing / Output Artifacts"),
        ("P1", "Universal Geocoder", "In: Coordinates / Address -> Out: Standard WGS84 (EPSG:4326) Bounding Box"),
        ("P2", "Geospatial Ingestion", "In: BBox -> Out: OSM Overpass Vector Polygons & Satellite Image Tiles"),
        ("P3", "AI Vision Analyzer", "In: Aerial Image -> Out: Facade style, roof typology, floor estimates (Gemini)"),
        ("P4", "Footprint Extruder", "In: 2D Footprint + Height -> Out: 3D LoD-1/LoD-2 Prismatic Spatial Volume"),
        ("P5", "Strata Partitioning", "In: 3D Mesh + Floor Plans -> Out: Floor Slabs [z_min, z_max] & Unit Boundaries"),
        ("P6", "ULPIN-3D Generator", "In: Parcel + Building + Floor + Unit -> Out: Hierarchical 3D-ULPIN Code"),
        ("P7", "Subsurface Engine", "In: Infrastructure Data -> Out: 3D Underground Utility Network & Basements"),
        ("P8", "Topology Validator", "In: 3D Meshes -> Out: 3D Boolean Overlap & Boundary Containment Audit Report"),
        ("P9", "Viewport & Exporter", "In: Validated 3D Entities -> Out: WebGL/Deck.gl 3D Stream + CityJSON/GLTF Exports")
    ]
    for r_idx, row_vals in enumerate(pipe_stages):
        for c_idx, val in enumerate(row_vals):
            t_pipe.rows[r_idx].cells[c_idx].paragraphs[0].text = val
    format_table(t_pipe, t_pipe_widths, [WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT])

    # =============================================================
    # PAGE 9: 6. HARDWARE AND SOFTWARE REQUIREMENTS
    # =============================================================
    doc.add_page_break()
    add_h1("6. Hardware and Software Requirements")
    add_p(
        "The 3D-ULPIN system is engineered as a modern cloud-native web application capable of running on scalable server infrastructure while delivering smooth 60 FPS graphics on standard client browser workstations."
    )

    add_h2("6.1 Hardware Specifications")
    
    t_hw = doc.add_table(rows=6, cols=3)
    t_hw_widths = [Inches(1.8), Inches(2.3), Inches(2.4)]
    
    t_hw_data = [
        ("Component", "Minimum Requirement (Development/Testing)", "Recommended Requirement (Production Cloud Deployment)"),
        ("Server Processor (CPU)", "Quad-Core Intel i5 / AMD Ryzen 5 (2.5 GHz+)", "8+ Core Intel Xeon / AMD EPYC (3.2 GHz+) or Cloud vCPU"),
        ("Server Memory (RAM)", "8 GB DDR4 RAM", "32 GB DDR4/DDR5 ECC RAM"),
        ("Server Storage", "50 GB NVMe SSD", "250+ GB High-IOPS NVMe SSD (for PostGIS Spatial Indexing)"),
        ("Client Workstation", "Dual-Core 2.0 GHz CPU, 4 GB RAM, WebGL 1.0", "Quad-Core 2.5 GHz+, 8 GB RAM, Dedicated GPU (NVIDIA/AMD/Apple M-Series) with WebGL 2.0 / WebGPU"),
        ("Network Bandwidth", "5 Mbps Broadband", "100+ Mbps Low-Latency Fiber (for 3D Tile & Satellite Streaming)")
    ]
    for r_idx, row_vals in enumerate(t_hw_data):
        for c_idx, val in enumerate(row_vals):
            t_hw.rows[r_idx].cells[c_idx].paragraphs[0].text = val
    format_table(t_hw, t_hw_widths, [WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT])

    add_h2("6.2 Software Stack and Dependencies")
    
    t_sw = doc.add_table(rows=11, cols=3)
    t_sw_widths = [Inches(1.6), Inches(2.2), Inches(2.7)]
    
    t_sw_data = [
        ("Layer / Ecosystem", "Software / Library", "Version & Functional Role"),
        ("Operating System", "Ubuntu Linux 22.04 LTS / Windows 11", "Host operating system for server services and local development"),
        ("Backend Runtime", "Python 3.10 / 3.11", "Core execution runtime for backend API and AI pipelines"),
        ("Backend Framework", "FastAPI, Uvicorn, Pydantic v2", "High-throughput asynchronous REST API framework"),
        ("Database Engine", "PostgreSQL 15+ with PostGIS 3.3+", "Spatial relational database with 3D geometry types and spatial indexing"),
        ("Database ORM", "SQLAlchemy 2.0, GeoAlchemy2, Alembic", "Object Relational Mapper and database migration manager"),
        ("Frontend Runtime", "Node.js 18+ / 20+ LTS, npm / yarn", "Client application build runtime"),
        ("Frontend Framework", "React 18, TypeScript 5.4, Vite 5", "Component-based typed single-page application framework"),
        ("3D Geospatial Engine", "Deck.gl v9, Three.js, MapLibre GL", "Hardware-accelerated WebGL/WebGPU 3D geospatial rendering"),
        ("Spatial AI & Vision", "OpenCV, Shapely, GeoPandas, google-genai", "Image edge detection, polygon geometry operations, Gemini Vision AI"),
        ("Cloud & Container", "Docker, Docker Compose, Supabase, Render", "Containerization, cloud persistence, and automated CI/CD deployment")
    ]
    for r_idx, row_vals in enumerate(t_sw_data):
        for c_idx, val in enumerate(row_vals):
            t_sw.rows[r_idx].cells[c_idx].paragraphs[0].text = val
    format_table(t_sw, t_sw_widths, [WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT])

    # =============================================================
    # PAGE 10: 7. FUTURE SCOPE & ENHANCEMENT ROADMAP
    # =============================================================
    doc.add_page_break()
    add_h1("7. Future Scope and Enhancement Roadmap")
    add_p(
        "To elevate the 3D-ULPIN platform from an advanced prototype (Level 2/3) to an enterprise-grade National Cadastral Infrastructure (Level 5), the following technical advancements are scheduled on the product roadmap:"
    )
    
    add_h2("7.1 Integration of High-Density LiDAR & Drone Photogrammetry")
    add_p(
        "Ingestion of high-precision airborne LiDAR point clouds (LAS/LAZ format) and Unmanned Aerial Vehicle (UAV) photogrammetric meshes. This will replace heuristic height approximations with true Digital Surface Models (DSM) and Digital Elevation Models (DEM), enabling centimeter-accurate LoD-3 building models with architectural overhangs and stepped facades."
    )

    add_h2("7.2 4D Spatio-Temporal Cadastre (Time-Series Modeling)")
    add_p(
        "Incorporation of the 4th dimension (Time / Temporal validity) into the cadastral schema. This will track the historical evolution of land parcels, pre-construction approvals, structural modifications, vertical floor additions, and historical ownership chains over multi-decade lifecycles."
    )

    add_h2("7.3 Blockchain-Backed Immutable Strata Title Registry")
    add_p(
        "Integrating a permissioned distributed ledger (Hyperledger Fabric / Polygon Supernets) to issue non-fungible, cryptographically signed 3D Strata Title Deeds. This guarantees tamper-proof property history, automated smart-contract escrow transactions, and instant encumbrance verifications for commercial banks."
    )

    add_h2("7.4 Smart City Digital Twin & Real-Time IoT Sensor Integration")
    add_p(
        "Connecting 3D-ULPIN volumetric parcels with Internet of Things (IoT) sensors, structural health monitoring systems, smart utility sub-meters, and solar potential raycasting algorithms. This transforms the cadastre from a passive legal registry into an active urban operational twin."
    )

    add_h2("7.5 Augmented & Virtual Reality (AR/VR) Field Inspection Tools")
    add_p(
        "Developing mobile AR applications for municipal field surveyors to project 3D subsurface utility pipes and vertical property boundaries directly over the physical building site through real-time camera overlays."
    )

    # =============================================================
    # PAGE 11: 8. CONCLUSION
    # =============================================================
    doc.add_page_break()
    add_h1("8. Conclusion")
    add_p(
        "The 3D-ULPIN platform represents a pioneering, transformative breakthrough in modern cadastral science and land administration technology. By confronting the fundamental spatial limitations of 2D land records in densely populated vertical cities, the project establishes a scalable, standards-compliant, and automated pathway toward true 3D volumetric governance."
    )
    add_p(
        "Through the seamless convergence of OpenStreetMap vector data, Google Gemini Multimodal Vision AI, PostGIS 3D spatial indexing, and high-performance WebGL/Deck.gl visualization, 3D-ULPIN proves that complex vertical towers and subterranean utility networks can be autonomously converted into mathematically validated 3D digital twins. The generation of standardized 3D-ULPIN identifiers delivers unequivocal legal clarity to multi-owner strata developments, drastically curtails title litigation, unlocks transparent municipal taxation, and safeguards vital underground infrastructure."
    )
    add_p(
        "In alignment with the Digital India Land Records Modernization Programme (DILRMP) and the global ISO 19152 LADM benchmark, 3D-ULPIN provides a robust, future-ready foundation for the next generation of smart city governance and digital land administration in India and across the globe."
    )

    # =============================================================
    # PAGE 12: 9. REFERENCES & CITATIONS
    # =============================================================
    doc.add_page_break()
    add_h1("9. References")
    
    refs = [
        ("Department of Land Resources (DoLR), Ministry of Rural Development, Government of India (2021). ", "Unique Land Parcel Identification Number (ULPIN) - Bhu-Aadhaar Implementation Framework & Operational Guidelines."),
        ("International Organization for Standardization (ISO) (2012 / 2023). ", "ISO 19152: Geographic Information — Land Administration Domain Model (LADM) — Part 1: Generic Conceptual Model & Part 2: Land Registration."),
        ("Open Geospatial Consortium (OGC) (2021). ", "OGC City Geography Markup Language (CityGML) 3.0 Standard & CityJSON Specification v1.1.3 for 3D City Models."),
        ("Stoter, J., Ploeger, H., & van Oosterom, P. (2013). ", "3D Cadastre in practice: An evaluation of 3D Cadastral models worldwide. Computers, Environment and Urban Systems, 40, 1-6."),
        ("van Oosterom, P. (2018). ", "Best Practices 3D Cadastres: Extended Information and Operational 3D Cadastres. International Federation of Surveyors (FIG) Publication No. 70, Copenhagen, Denmark."),
        ("Biljecki, F., Stoter, J., Ledoux, H., Zlatanova, S., & Çöltekin, A. (2015). ", "Applications of 3D city models: State of the art review. ISPRS International Journal of Geo-Information, 4(4), 2842-2889."),
        ("Rajabifard, A., Atazadeh, B., & Kalantari, M. (2018). ", "BIM and 3D Cadastres: A Framework for Multi-Storey Building Land Administration. Spatial Information Research, 26(4), 395-407."),
        ("FastAPI & PostGIS Development Teams (2024). ", "FastAPI Asynchronous Framework Documentation & PostGIS 3D Spatial Database Manual (Ref: ST_3DIntersects, ST_Extrude).")
    ]
    
    for r_idx, (author_year, title_source) in enumerate(refs, 1):
        p_ref = doc.add_paragraph()
        p_ref.paragraph_format.space_before = Pt(3)
        p_ref.paragraph_format.space_after = Pt(4)
        p_ref.paragraph_format.left_indent = Inches(0.4)
        p_ref.paragraph_format.first_line_indent = Inches(-0.4)
        p_ref.paragraph_format.line_spacing = 1.15
        
        r_num = p_ref.add_run(f"[{r_idx}] ")
        r_num.bold = True
        r_num.font.name = 'Times New Roman'
        r_num.font.color.rgb = COLOR_BLACK
        
        r_auth = p_ref.add_run(author_year)
        r_auth.bold = True
        r_auth.font.name = 'Times New Roman'
        r_auth.font.color.rgb = COLOR_BLACK
        
        r_tit = p_ref.add_run(title_source)
        r_tit.font.name = 'Times New Roman'
        r_tit.font.color.rgb = COLOR_BLACK

    # Save document
    doc.save(output_path)
    print(f"Successfully generated synopsis document at: {output_path}")

if __name__ == "__main__":
    output_file = os.path.abspath("3D_ULPIN_Project_Synopsis_Report_Final.docx")
    create_synopsis_document(output_file)
    try:
        create_synopsis_document(os.path.abspath("3D_ULPIN_Project_Synopsis_Report.docx"))
    except Exception:
        pass
