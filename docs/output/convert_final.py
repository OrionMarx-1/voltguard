#!/usr/bin/env python3
"""Convert improved interim report to professional DOCX with charts."""
import os
import markdown
from docx import Document
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# Paths
MD_PATH = r"E:\重要内容\GenAI比赛\Inter-university 比赛\voltguard-site\docs\INTERIM_REPORT_FINAL.md"
CHARTS_DIR = r"E:\重要内容\GenAI比赛\Inter-university 比赛\voltguard-site\docs\output\charts"
OUTPUT_DOCX = r"E:\重要内容\GenAI比赛\Inter-university 比赛\INTERIM_REPORT_FINAL.docx"

def set_cell_shading(cell, color_hex):
    """Set cell background color."""
    shading = OxmlElement('w:shd')
    shading.set(qn('w:fill'), color_hex)
    cell._tc.get_or_add_tcPr().append(shading)

def add_heading_custom(doc, text, level):
    """Add a styled heading."""
    para = doc.add_heading(text, level=level)
    for run in para.runs:
        run.font.color.rgb = RGBColor(0x0c, 0x2f, 0x3d)
        if level == 1:
            run.font.size = Pt(18)
            run.font.bold = True
        elif level == 2:
            run.font.size = Pt(14)
            run.font.bold = True
        elif level == 3:
            run.font.size = Pt(12)
            run.font.bold = True
    return para

def add_cover_page(doc):
    """Add a professional cover page."""
    # Spacer
    for _ in range(6):
        doc.add_paragraph()

    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("VoltGuard AI")
    run.font.size = Pt(36)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0c, 0x2f, 0x3d)

    # Subtitle
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("Interim Progress Report")
    run.font.size = Pt(20)
    run.font.color.rgb = RGBColor(0x16, 0x8b, 0x78)

    # Event
    event = doc.add_paragraph()
    event.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = event.add_run("Hack for SDGs 2026")
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)

    track = doc.add_paragraph()
    track.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = track.add_run("Track 1 — Green Transport & Smart Mobility")
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)

    # Spacer
    for _ in range(4):
        doc.add_paragraph()

    # Team info
    info = doc.add_paragraph()
    info.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = info.add_run("Team 1023 / LadyBanana\nHong Kong Baptist University (HKBU)")
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0x10, 0x25, 0x2f)

    date_para = doc.add_paragraph()
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = date_para.add_run("4 October 2026")
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)

    # Page break
    doc.add_page_break()

def add_toc_page(doc):
    """Add table of contents page."""
    toc_heading = doc.add_heading("Table of Contents", level=1)
    for run in toc_heading.runs:
        run.font.color.rgb = RGBColor(0x0c, 0x2f, 0x3d)

    toc_items = [
        ("Executive Summary", 1),
        ("SDG Alignment", 1),
        ("Question Mapping", 1),
        ("Part 1: Problem and Scope", 1),
        ("    Q1. Specific Pain Point", 2),
        ("    Q2. Research & Data", 2),
        ("    Q3. Significance & Affected Groups", 2),
        ("    Q4. Existing Solutions & Gaps", 2),
        ("Part 2: Proposed Solution", 1),
        ("    Q5. Primary Objectives", 2),
        ("    Q6. Project Boundaries", 2),
        ("    Q7. Assumptions", 2),
        ("    Q8. Target Audience", 2),
        ("    Q9. Client", 2),
        ("    Q10. Needs Gathering & Testing", 2),
        ("Part 3: Teamwork", 1),
        ("    Q11. Team Structure", 2),
        ("    Q12. Communication Strategies", 2),
        ("Part 4: Progress", 1),
        ("    Q13. Achievements", 2),
        ("    Q14. Current Work", 2),
        ("    Q15. Next Steps & Milestones", 2),
        ("    Q16. Success Evaluation", 2),
        ("Part 5: Challenges", 1),
        ("    Q17. Encountered Challenges", 2),
        ("    Q18. Upcoming Challenges", 2),
        ("Part 6: Resources", 1),
        ("    Q19. Resources Utilised", 2),
        ("    Q20. Missing Resources", 2),
        ("Part 7: Learnings", 1),
        ("    Q21. Learnings", 2),
        ("    Q22. Evolution", 2),
        ("    Q23. Other Comments", 2),
    ]

    for item, level in toc_items:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.3 * (level - 1))
        run = p.add_run(item)
        run.font.size = Pt(11 if level == 1 else 10)
        run.font.color.rgb = RGBColor(0x10, 0x25, 0x2f) if level == 1 else RGBColor(0x60, 0x74, 0x7d)

    doc.add_page_break()

def parse_md_to_docx(md_text, doc):
    """Parse markdown and add to docx document."""
    lines = md_text.split('\n')
    i = 0
    in_table = False
    table_rows = []
    table_alignments = []

    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines at start
        if not line and i < 5:
            i += 1
            continue

        # Headings
        if line.startswith('# ') and not line.startswith('## '):
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            add_heading_custom(doc, line[2:], 1)
            i += 1
            continue
        elif line.startswith('## '):
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            add_heading_custom(doc, line[3:], 2)
            i += 1
            continue
        elif line.startswith('### '):
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            add_heading_custom(doc, line[4:], 3)
            i += 1
            continue
        elif line.startswith('#### '):
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            add_heading_custom(doc, line[5:], 4)
            i += 1
            continue

        # Horizontal rule / page break indicator
        if line == '---':
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            # Check if next line is a major section
            if i + 1 < len(lines) and lines[i+1].strip().startswith('# '):
                doc.add_page_break()
            else:
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(6)
                p.paragraph_format.space_after = Pt(6)
            i += 1
            continue

        # Table detection
        if '|' in line and not line.startswith('**'):
            parts = [p.strip() for p in line.split('|')]
            parts = [p for p in parts if p]  # Remove empty
            if parts:
                # Check if it's a separator row (contains only dashes)
                if all(set(p) <= set('-|: ') for p in parts):
                    i += 1
                    continue
                if not in_table:
                    in_table = True
                    table_rows = []
                    table_alignments = []
                table_rows.append(parts)
            i += 1
            continue
        elif in_table and (not line or not '|' in line):
            flush_table(doc, table_rows, table_alignments)
            in_table = False
            table_rows = []

        # Bold text
        if line.startswith('**') and line.endswith('**') and ' ' not in line[2:-2]:
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            run = p.add_run(line.strip('*'))
            run.bold = True
            run.font.color.rgb = RGBColor(0x0c, 0x2f, 0x3d)
            i += 1
            continue

        # Bullet points
        if line.startswith('- ') or line.startswith('* '):
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            p = doc.add_paragraph(line[2:], style='List Bullet')
            p.paragraph_format.left_indent = Inches(0.25)
            for run in p.runs:
                run.font.size = Pt(10.5)
            i += 1
            continue

        # Numbered lists
        if line and line[0].isdigit() and '. ' in line[:4]:
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            text = line[line.find('. ')+2:]
            p = doc.add_paragraph(text, style='List Number')
            p.paragraph_format.left_indent = Inches(0.25)
            for run in p.runs:
                run.font.size = Pt(10.5)
            i += 1
            continue

        # Blockquote
        if line.startswith('>'):
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            p = doc.add_paragraph(line[1:].strip())
            p.paragraph_format.left_indent = Inches(0.3)
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.space_after = Pt(3)
            for run in p.runs:
                run.italic = True
                run.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)
            i += 1
            continue

        # Regular paragraph
        if line:
            if in_table:
                flush_table(doc, table_rows, table_alignments)
                in_table = False
                table_rows = []
            p = doc.add_paragraph()
            # Process bold and italic inline
            process_inline_formatting(p, line)
            p.paragraph_format.space_after = Pt(4)
            for run in p.runs:
                run.font.size = Pt(10.5)

        i += 1

    if in_table:
        flush_table(doc, table_rows, table_alignments)

def process_inline_formatting(paragraph, text):
    """Process bold and italic markdown in text."""
    import re
    # Simple pattern: split by **bold** and *italic*
    parts = re.split(r'(\*\*.*?\*\*|\*.*?\*)', text)
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith('*') and part.endswith('*'):
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        else:
            paragraph.add_run(part)

def flush_table(doc, rows, alignments):
    """Flush accumulated table rows to document."""
    if not rows:
        return

    # Determine max columns
    max_cols = max(len(r) for r in rows)

    table = doc.add_table(rows=len(rows), cols=max_cols)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    for i, row_data in enumerate(rows):
        row = table.rows[i]
        for j, cell_text in enumerate(row_data):
            if j < max_cols:
                cell = row.cells[j]
                cell.text = cell_text
                # Style header row
                if i == 0:
                    set_cell_shading(cell, '0c2f3d')
                    for para in cell.paragraphs:
                        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        for run in para.runs:
                            run.font.bold = True
                            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                            run.font.size = Pt(9)
                else:
                    for para in cell.paragraphs:
                        for run in para.runs:
                            run.font.size = Pt(9)
                    # Alternate row shading
                    if i % 2 == 0:
                        set_cell_shading(cell, 'f4f7f6')

    # Add spacing after table
    doc.add_paragraph()

def insert_chart_after_text(doc, search_text, image_path, caption, width=5.5):
    """Insert a chart after a paragraph containing search_text."""
    for i, para in enumerate(doc.paragraphs):
        if search_text.lower() in para.text.lower():
            # Find insertion index
            p_element = para._p
            # Create new paragraph for image
            new_p = OxmlElement('w:p')
            p_element.addnext(new_p)

            # We need to add to docx model too
            # Add paragraph after current
            idx = doc.paragraphs.index(para)
            if idx + 1 < len(doc.paragraphs):
                insert_idx = idx + 1
            else:
                insert_idx = len(doc.paragraphs)

            # Add spacing
            space_p = doc.paragraphs[insert_idx] if insert_idx < len(doc.paragraphs) else doc.add_paragraph()

            # Add image
            img_p = doc.add_paragraph()
            img_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = img_p.add_run()
            run.add_picture(image_path, width=Inches(width))

            # Add caption
            cap_p = doc.add_paragraph()
            cap_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            cap_run = cap_p.add_run(caption)
            cap_run.italic = True
            cap_run.font.size = Pt(9)
            cap_run.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)

            # Add spacing
            doc.add_paragraph()
            return True
    return False

def add_page_numbers(doc):
    """Add page numbers to footer."""
    for section in doc.sections:
        footer = section.footer
        footer.is_linked_to_previous = False
        para = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Add page number field
        run = para.add_run("Team 1023 / LadyBanana, HKBU  |  ")
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)

        # Page number field
        fldChar1 = OxmlElement('w:fldChar')
        fldChar1.set(qn('w:fldCharType'), 'begin')
        instrText = OxmlElement('w:instrText')
        instrText.set(qn('xml:space'), 'preserve')
        instrText.text = "PAGE"
        fldChar2 = OxmlElement('w:fldChar')
        fldChar2.set(qn('w:fldCharType'), 'end')

        run2 = para.add_run()
        run2._r.append(fldChar1)
        run2._r.append(instrText)
        run2._r.append(fldChar2)
        run2.font.size = Pt(8)
        run2.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)

def add_header(doc):
    """Add header to each page."""
    for section in doc.sections:
        header = section.header
        header.is_linked_to_previous = False
        para = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run = para.add_run("VoltGuard AI — Interim Progress Report")
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)
        run.italic = True

def main():
    print("Reading final markdown...")
    with open(MD_PATH, 'r', encoding='utf-8') as f:
        md_text = f.read()

    print("Creating document...")
    doc = Document()

    # Set page margins
    for section in doc.sections:
        section.top_margin = Cm(2.54)
        section.bottom_margin = Cm(2.54)
        section.left_margin = Cm(3.17)
        section.right_margin = Cm(3.17)

    # Add cover page
    add_cover_page(doc)

    # Add TOC
    add_toc_page(doc)

    # Parse main content
    print("Parsing markdown content...")
    parse_md_to_docx(md_text, doc)

    # Add header and footer
    add_header(doc)
    add_page_numbers(doc)

    # Insert charts
    print("Inserting charts...")
    chart_insertions = [
        ("q3. why is this problem significant", os.path.join(CHARTS_DIR, 'chart_stakeholders.png'),
         'Figure 1: Stakeholder Impact & Urgency Assessment'),
        ("q2. what research have you conducted", os.path.join(CHARTS_DIR, 'chart_nasa_data.png'),
         'Figure 2: NASA Ames PCoE Dataset Statistics'),
        ("q4. what existing solutions are available", os.path.join(CHARTS_DIR, 'chart_ev_growth.png'),
         'Figure 3: Hong Kong EV Registration Growth (2022-2026)'),
        ("q5. describe the primary objectives", os.path.join(CHARTS_DIR, 'chart_architecture.png'),
         'Figure 4: VoltGuard Two-Tier Safety Architecture'),
        ("q15. what are your immediate next steps", os.path.join(CHARTS_DIR, 'chart_milestones.png'),
         'Figure 5: Project Milestones Timeline (Oct 2026)'),
    ]

    for search_text, img_path, caption in chart_insertions:
        if os.path.exists(img_path):
            # Find and insert - we'll add at end since parsing is complex
            pass
        else:
            print(f"  Warning: Chart not found: {img_path}")

    # Save
    doc.save(OUTPUT_DOCX)
    print(f"Document saved: {OUTPUT_DOCX}")

    # Now let's use a simpler approach - rebuild with charts inserted at the right places
    # We'll re-read and insert charts
    print("Re-opening to insert charts at specific positions...")
    doc2 = Document(OUTPUT_DOCX)

    # Since chart insertion after specific text is complex with python-docx,
    # let's just append charts at the end with clear section headers
    doc2.add_page_break()
    doc2.add_heading('Appendix: Data Visualisations', level=1)

    charts_to_append = [
        (os.path.join(CHARTS_DIR, 'chart_stakeholders.png'), 'Figure 1: Stakeholder Impact & Urgency Assessment'),
        (os.path.join(CHARTS_DIR, 'chart_nasa_data.png'), 'Figure 2: NASA Ames PCoE Dataset Statistics'),
        (os.path.join(CHARTS_DIR, 'chart_ev_growth.png'), 'Figure 3: Hong Kong EV Registration Growth (2022-2026)'),
        (os.path.join(CHARTS_DIR, 'chart_architecture.png'), 'Figure 4: VoltGuard Two-Tier Safety Architecture'),
        (os.path.join(CHARTS_DIR, 'chart_milestones.png'), 'Figure 5: Project Milestones Timeline (Oct 2026)'),
    ]

    for img_path, caption in charts_to_append:
        if os.path.exists(img_path):
            doc2.add_paragraph()
            p = doc2.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run()
            run.add_picture(img_path, width=Inches(5.8))

            cap = doc2.add_paragraph()
            cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            crun = cap.add_run(caption)
            crun.italic = True
            crun.font.size = Pt(9)
            crun.font.color.rgb = RGBColor(0x60, 0x74, 0x7d)
            doc2.add_paragraph()

    doc2.save(OUTPUT_DOCX)
    print(f"Final document with charts saved: {OUTPUT_DOCX}")

if __name__ == '__main__':
    main()
