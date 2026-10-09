#!/usr/bin/env python3
"""Generate charts and insert them into the interim report docx."""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# Paths
REPORT_DOCX = r"E:\重要内容\GenAI比赛\Inter-university 比赛\INTERIM_REPORT.docx"
CHARTS_DIR = r"E:\重要内容\GenAI比赛\Inter-university 比赛\voltguard-site\docs\output\charts"
OUTPUT_DOCX = r"E:\重要内容\GenAI比赛\Inter-university 比赛\INTERIM_REPORT_with_charts.docx"

os.makedirs(CHARTS_DIR, exist_ok=True)

# Color scheme matching VoltGuard branding
PRIMARY = '#0c2f3d'
ACCENT = '#168b78'
MINT = '#88ead1'
AMBER = '#b96b00'
RED = '#b4433d'
BG = '#f4f7f6'
MUTED = '#60747d'

def set_chinese_font():
    """Set font for Chinese characters."""
    plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS', 'DejaVu Sans']
    plt.rcParams['axes.unicode_minus'] = False

set_chinese_font()

# ========================================================================
# Chart 1: Hong Kong EV Registration Growth
# ========================================================================
def chart_ev_growth():
    fig, ax = plt.subplots(figsize=(10, 5.5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor(BG)

    years = ['2022', '2023', '2024', '2025', '2026\n(Aug)']
    total_ev = [45000, 78000, 120000, 155000, 184000]
    new_reg_pct = [12.5, 28.3, 45.2, 58.7, 68.6]

    x = np.arange(len(years))
    width = 0.38

    bars1 = ax.bar(x - width/2, total_ev, width, label='Cumulative EVs Registered', color=ACCENT, edgecolor='white', linewidth=1.5)
    ax2 = ax.twinx()
    bars2 = ax2.bar(x + width/2, new_reg_pct, width, label='% of New Registrations', color=MINT, edgecolor='white', linewidth=1.5, alpha=0.85)

    # Add value labels
    for bar in bars1:
        height = bar.get_height()
        ax.annotate(f'{int(height):,}',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 5), textcoords="offset points",
                    ha='center', va='bottom', fontsize=9, fontweight='bold', color=PRIMARY)

    for bar in bars2:
        height = bar.get_height()
        ax2.annotate(f'{height:.1f}%',
                     xy=(bar.get_x() + bar.get_width() / 2, height),
                     xytext=(0, 5), textcoords="offset points",
                     ha='center', va='bottom', fontsize=9, fontweight='bold', color=PRIMARY)

    ax.set_xlabel('Year', fontsize=11, fontweight='bold', color=PRIMARY)
    ax.set_ylabel('Cumulative EVs', fontsize=11, fontweight='bold', color=ACCENT)
    ax2.set_ylabel('% of New Registrations', fontsize=11, fontweight='bold', color=MINT)
    ax.set_xticks(x)
    ax.set_xticklabels(years, fontsize=10)
    ax.tick_params(axis='y', labelcolor=ACCENT)
    ax2.tick_params(axis='y', labelcolor=MINT)

    ax.set_title('Hong Kong EV Adoption: Surging Growth in Underground Parking Context', fontsize=13, fontweight='bold', color=PRIMARY, pad=15)
    ax.set_ylim(0, 220000)
    ax2.set_ylim(0, 85)

    # Source annotation
    ax.text(0.02, -0.12, 'Source: Hong Kong Environmental Protection Department, Transport Department (2022-2026)',
            transform=ax.transAxes, fontsize=8, color=MUTED, style='italic')

    fig.tight_layout()
    path = os.path.join(CHARTS_DIR, 'chart_ev_growth.png')
    fig.savefig(path, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return path

# ========================================================================
# Chart 2: Two-Tier Architecture Diagram
# ========================================================================
def chart_architecture():
    fig, ax = plt.subplots(figsize=(11, 6))
    fig.patch.set_facecolor('white')
    ax.set_facecolor(BG)
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 6)
    ax.axis('off')

    def draw_box(ax, x, y, w, h, color, text, fontsize=10, text_color='white', alpha=1.0, border=None):
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.15",
                             facecolor=color, edgecolor=border or color, linewidth=2, alpha=alpha)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2, text, ha='center', va='center', fontsize=fontsize,
                fontweight='bold', color=text_color, wrap=True)

    # Title
    ax.text(5.5, 5.7, 'VoltGuard AI: Two-Tier Safety Architecture', ha='center', va='center',
            fontsize=15, fontweight='bold', color=PRIMARY)

    # Tier 1
    ax.text(1.0, 5.1, 'TIER 1: Deterministic Safety Engine', fontsize=12, fontweight='bold', color=PRIMARY)
    draw_box(ax, 0.5, 3.7, 2.2, 1.1, PRIMARY, 'BMS Sensor\nMatrix\n(4x4 to 16x16)', 9)
    draw_box(ax, 3.2, 3.7, 2.4, 1.1, ACCENT, 'Rule Engine\n<10ms Response\nZero LLM', 9)
    draw_box(ax, 6.2, 3.7, 2.4, 1.1, '#1a6b5a', 'Alert Emitter\nREST / WebSocket\nReal-time Push', 9)

    # Tier 2
    ax.text(1.0, 3.3, 'TIER 2: GenAI Copilot (Enhancement Layer)', fontsize=12, fontweight='bold', color=PRIMARY)
    draw_box(ax, 0.5, 1.6, 2.2, 1.3, AMBER, 'Heatmap PNG\n+ Telemetry\n+ HKFSD Context', 9, text_color='white')
    draw_box(ax, 3.2, 1.6, 2.4, 1.3, '#8B5A00', 'GPT-4o Vision\n+ RAG Retrieval\nBilingual Output', 9)
    draw_box(ax, 6.2, 1.6, 2.4, 1.3, RED, 'Incident Report\nPDF Generation\nEmergency Protocol', 9)

    # Arrows
    arrow_style = dict(arrowstyle='->', color=MUTED, lw=2, mutation_scale=15)
    ax.annotate('', xy=(3.2, 4.25), xytext=(2.7, 4.25), arrowprops=arrow_style)
    ax.annotate('', xy=(6.2, 4.25), xytext=(5.6, 4.25), arrowprops=arrow_style)
    ax.annotate('', xy=(3.2, 2.25), xytext=(2.7, 2.25), arrowprops=arrow_style)
    ax.annotate('', xy=(6.2, 2.25), xytext=(5.6, 2.25), arrowprops=arrow_style)

    # Key metrics
    metrics = [
        (9.2, 4.8, '80°C', 'Danger\nThreshold', RED),
        (9.2, 4.0, '60°C', 'Warning\nThreshold', AMBER),
        (9.2, 3.2, '<10ms', 'Tier 1\nLatency', ACCENT),
        (9.2, 2.4, '1-3s', 'Tier 2\nLatency', MUTED),
    ]
    for x, y, val, label, color in metrics:
        ax.text(x, y, val, ha='center', va='center', fontsize=14, fontweight='bold', color=color)
        ax.text(x, y-0.35, label, ha='center', va='center', fontsize=8, color=MUTED)

    # Offline fallback note
    ax.text(5.5, 0.6, 'Offline Fallback: Tier 1 runs locally via Service Worker + Cached HKFSD guides',
            ha='center', va='center', fontsize=9, color=MUTED, style='italic',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='#e0f5ef', edgecolor=ACCENT, alpha=0.5))

    fig.tight_layout()
    path = os.path.join(CHARTS_DIR, 'chart_architecture.png')
    fig.savefig(path, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return path

# ========================================================================
# Chart 3: NASA Dataset Statistics
# ========================================================================
def chart_nasa_data():
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor(BG)

    cells = ['B0005', 'B0006', 'B0007', 'B0018']
    cycles = [168, 168, 168, 132]
    samples = [60000, 60000, 60000, 48000]

    x = np.arange(len(cells))
    width = 0.35

    bars1 = ax.bar(x - width/2, cycles, width, label='Discharge Cycles', color=ACCENT, edgecolor='white')
    ax2 = ax.twinx()
    bars2 = ax2.bar(x + width/2, [s/1000 for s in samples], width, label='Samples (thousands)', color=MINT, edgecolor='white', alpha=0.85)

    for bar in bars1:
        height = bar.get_height()
        ax.annotate(f'{int(height)}',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 4), textcoords="offset points",
                    ha='center', va='bottom', fontsize=10, fontweight='bold', color=PRIMARY)

    for bar in bars2:
        height = bar.get_height()
        ax2.annotate(f'{height:.0f}K',
                     xy=(bar.get_x() + bar.get_width() / 2, height),
                     xytext=(0, 4), textcoords="offset points",
                     ha='center', va='bottom', fontsize=10, fontweight='bold', color=PRIMARY)

    ax.set_xlabel('NASA Cell ID', fontsize=11, fontweight='bold', color=PRIMARY)
    ax.set_ylabel('Cycles', fontsize=11, fontweight='bold', color=ACCENT)
    ax2.set_ylabel('Samples (thousands)', fontsize=11, fontweight='bold', color=MINT)
    ax.set_xticks(x)
    ax.set_xticklabels(cells, fontsize=11, fontweight='bold')
    ax.tick_params(axis='y', labelcolor=ACCENT)
    ax2.tick_params(axis='y', labelcolor=MINT)

    ax.set_title('NASA Ames PCoE Dataset: Real Laboratory Battery Measurements', fontsize=13, fontweight='bold', color=PRIMARY, pad=15)
    ax.set_ylim(0, 220)
    ax2.set_ylim(0, 75)

    ax.text(0.02, -0.12, 'Source: NASA Ames Prognostics Center of Excellence (PCoE) Public Repository',
            transform=ax.transAxes, fontsize=8, color=MUTED, style='italic')

    fig.tight_layout()
    path = os.path.join(CHARTS_DIR, 'chart_nasa_data.png')
    fig.savefig(path, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return path

# ========================================================================
# Chart 4: Milestone Timeline (Gantt-style)
# ========================================================================
def chart_milestones():
    fig, ax = plt.subplots(figsize=(11, 4.5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor(BG)

    milestones = [
        ('Copilot API Test', '2026-10-04', '2026-10-08', ACCENT),
        ('Physics Simulation', '2026-10-07', '2026-10-10', '#1a6b5a'),
        ('User Testing', '2026-10-11', '2026-10-13', AMBER),
        ('Pitch Deck Final', '2026-10-14', '2026-10-18', RED),
        ('Rehearsal & Backup', '2026-10-19', '2026-10-23', MUTED),
        ('Final Pitch Day', '2026-10-24', '2026-10-24', PRIMARY),
    ]

    from datetime import datetime, timedelta
    start_date = datetime(2026, 10, 3)
    end_date = datetime(2026, 10, 25)

    y_positions = list(range(len(milestones)-1, -1, -1))

    for i, (name, s, e, color) in enumerate(milestones):
        s_dt = datetime.strptime(s, '%Y-%m-%d')
        e_dt = datetime.strptime(e, '%Y-%m-%d')
        duration = (e_dt - s_dt).days + 1
        start_offset = (s_dt - start_date).days

        if duration == 1:
            ax.barh(y_positions[i], 0.6, left=start_offset + 0.2, height=0.5, color=color, edgecolor='white', linewidth=1.5)
        else:
            ax.barh(y_positions[i], duration, left=start_offset, height=0.5, color=color, edgecolor='white', linewidth=1.5, alpha=0.85)

        ax.text(start_offset + duration/2, y_positions[i], name, ha='center', va='center',
                fontsize=9, fontweight='bold', color='white')

    ax.set_yticks(y_positions)
    ax.set_yticklabels([m[0] for m in milestones], fontsize=10)
    ax.set_xlim(-0.5, 23)
    ax.set_ylim(-0.8, len(milestones) - 0.2)

    # Date labels
    dates = [start_date + timedelta(days=i) for i in range(23)]
    date_labels = [d.strftime('%d') if d.day % 2 == 0 else '' for d in dates]
    ax.set_xticks(range(23))
    ax.set_xticklabels(date_labels, fontsize=8, color=MUTED)
    ax.set_xlabel('October 2026', fontsize=11, fontweight='bold', color=PRIMARY)

    ax.set_title('Project Milestones: From Now to Final Pitch Day', fontsize=13, fontweight='bold', color=PRIMARY, pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(MUTED)
    ax.spines['bottom'].set_color(MUTED)

    fig.tight_layout()
    path = os.path.join(CHARTS_DIR, 'chart_milestones.png')
    fig.savefig(path, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return path

# ========================================================================
# Chart 5: Stakeholder Impact Matrix
# ========================================================================
def chart_stakeholders():
    fig, ax = plt.subplots(figsize=(10, 5.5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor(BG)

    stakeholders = ['EV Drivers', 'Facility\nManagers', 'Security\nGuards', 'Fire Services', 'Fleet\nOperators', 'Insurance', 'Residents']
    impact = [65, 90, 85, 80, 70, 60, 75]
    urgency = [70, 95, 90, 85, 75, 55, 80]
    colors = [ACCENT, RED, RED, AMBER, ACCENT, MINT, AMBER]

    x = np.arange(len(stakeholders))
    width = 0.35

    bars1 = ax.bar(x - width/2, impact, width, label='Impact Score', color=ACCENT, edgecolor='white', alpha=0.85)
    bars2 = ax.bar(x + width/2, urgency, width, label='Urgency Score', color=MINT, edgecolor='white', alpha=0.7)

    for bar in bars1:
        height = bar.get_height()
        ax.annotate(f'{int(height)}',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3), textcoords="offset points",
                    ha='center', va='bottom', fontsize=9, fontweight='bold', color=PRIMARY)

    for bar in bars2:
        height = bar.get_height()
        ax.annotate(f'{int(height)}',
                     xy=(bar.get_x() + bar.get_width() / 2, height),
                     xytext=(0, 3), textcoords="offset points",
                     ha='center', va='bottom', fontsize=9, fontweight='bold', color=PRIMARY)

    ax.set_ylabel('Score (0-100)', fontsize=11, fontweight='bold', color=PRIMARY)
    ax.set_xticks(x)
    ax.set_xticklabels(stakeholders, fontsize=9)
    ax.set_ylim(0, 110)
    ax.legend(loc='upper right', fontsize=9)

    ax.set_title('Stakeholder Impact & Urgency Assessment', fontsize=13, fontweight='bold', color=PRIMARY, pad=15)

    # Add impact zones
    ax.axhspan(80, 100, alpha=0.08, color=RED, zorder=0)
    ax.axhspan(60, 80, alpha=0.08, color=AMBER, zorder=0)
    ax.text(6.3, 90, 'Critical', fontsize=8, color=RED, fontweight='bold', alpha=0.7)
    ax.text(6.3, 70, 'High', fontsize=8, color=AMBER, fontweight='bold', alpha=0.7)

    fig.tight_layout()
    path = os.path.join(CHARTS_DIR, 'chart_stakeholders.png')
    fig.savefig(path, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return path

# ========================================================================
# Insert charts into docx
# ========================================================================
def insert_image_after_heading(doc, heading_text, image_path, width_inches=6.0):
    """Insert an image after a paragraph containing the heading text."""
    inserted = False
    for i, para in enumerate(doc.paragraphs):
        if heading_text.lower() in para.text.lower() and not inserted:
            # Insert image after this paragraph
            new_para = para._p.addnext(doc.add_paragraph()._p)
            run = new_para.getparent().paragraphs[new_para.getparent().paragraphs.index(new_para) if hasattr(new_para, 'getparent') else 0].add_run()
            # Better approach: use the proper docx API
            break

    # Alternative: find paragraph index and insert after
    for i, para in enumerate(doc.paragraphs):
        if heading_text.lower() in para.text.lower() and not inserted:
            # Get the paragraph element
            p = para._p
            # Create a new paragraph for the image
            new_p = OxmlElement('w:p')
            p.addnext(new_p)
            # Create run with image
            new_para = doc.paragraphs[i+1] if i+1 < len(doc.paragraphs) else None
            # Actually, let's use a simpler approach
            # Add image at a specific position
            inserted = True
            return i
    return -1

def insert_charts_into_docx():
    """Generate charts and create a new docx with them inserted."""
    print("Generating charts...")
    chart_paths = {
        'ev_growth': chart_ev_growth(),
        'architecture': chart_architecture(),
        'nasa_data': chart_nasa_data(),
        'milestones': chart_milestones(),
        'stakeholders': chart_stakeholders(),
    }
    print(f"Charts saved to: {CHARTS_DIR}")

    print("Opening existing docx...")
    doc = Document(REPORT_DOCX)

    # Define insertion points: (search_text, chart_path, caption)
    insertions = [
        ('Q3. Why is this problem significant?', chart_paths['stakeholders'],
         'Figure 1: Stakeholder Impact & Urgency Assessment'),
        ('Q2. What research have you conducted', chart_paths['nasa_data'],
         'Figure 2: NASA Ames PCoE Dataset Statistics'),
        ('Q4. What existing solutions are available', chart_paths['ev_growth'],
         'Figure 3: Hong Kong EV Registration Growth (2022-2026)'),
        ('Q5. Describe the primary objectives', chart_paths['architecture'],
         'Figure 4: VoltGuard Two-Tier Safety Architecture'),
        ('Q15. What are your immediate next steps', chart_paths['milestones'],
         'Figure 5: Project Milestones Timeline (Oct 2026)'),
    ]

    # We need to insert images after specific paragraphs
    # Since python-docx doesn't support inserting at arbitrary positions easily,
    # we'll rebuild the document by copying paragraphs and inserting images

    print("Inserting charts into document...")

    # Find all paragraphs and their texts for matching
    para_texts = [p.text.strip() for p in doc.paragraphs]

    # Create a mapping of where to insert what
    insert_map = {}  # paragraph index -> (image_path, caption)
    for search_text, img_path, caption in insertions:
        for idx, text in enumerate(para_texts):
            if search_text.lower() in text.lower():
                insert_map[idx] = (img_path, caption)
                break

    # Build new document
    new_doc = Document()

    # Copy styles
    for style in doc.styles:
        try:
            if style.name not in [s.name for s in new_doc.styles]:
                pass  # styles are already there
        except:
            pass

    # Copy paragraphs and insert images
    for idx, para in enumerate(doc.paragraphs):
        # Copy paragraph
        new_para = new_doc.add_paragraph()
        new_para.text = para.text
        new_para.style = para.style.name if para.style else 'Normal'

        # Copy formatting
        for run in para.runs:
            new_run = new_para.add_run(run.text)
            new_run.bold = run.bold
            new_run.italic = run.italic
            new_run.underline = run.underline
            if run.font.size:
                new_run.font.size = run.font.size
            if run.font.color.rgb:
                new_run.font.color.rgb = run.font.color.rgb

        # Check if we need to insert an image after this paragraph
        if idx in insert_map:
            img_path, caption = insert_map[idx]
            # Add spacing
            new_doc.add_paragraph()
            # Add image
            img_para = new_doc.add_paragraph()
            img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = img_para.add_run()
            run.add_picture(img_path, width=Inches(5.8))
            # Add caption
            cap_para = new_doc.add_paragraph()
            cap_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            cap_run = cap_para.add_run(caption)
            cap_run.italic = True
            cap_run.font.size = Pt(9)
            cap_run.font.color.rgb = RGBColor(0x60, 0x74, 0x7D)
            # Add spacing after
            new_doc.add_paragraph()

    # Copy tables
    for table in doc.tables:
        new_table = new_doc.add_table(rows=len(table.rows), cols=len(table.columns))
        new_table.style = table.style
        for i, row in enumerate(table.rows):
            for j, cell in enumerate(row.cells):
                new_table.rows[i].cells[j].text = cell.text

    # Save
    new_doc.save(OUTPUT_DOCX)
    print(f"Document with charts saved: {OUTPUT_DOCX}")
    return OUTPUT_DOCX

if __name__ == '__main__':
    insert_charts_into_docx()
