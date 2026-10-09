#!/usr/bin/env python3
"""Convert markdown interim report to HTML then to DOCX."""
import sys
import os
import markdown
from datetime import datetime

# Paths
MD_PATH = r"E:\重要内容\GenAI比赛\Inter-university 比赛\voltguard-site\docs\INTERIM_REPORT_V2.md"
HTML_PATH = r"E:\重要内容\GenAI比赛\Inter-university 比赛\voltguard-site\docs\output\stage2\formatted-interim-report.html"
DOCX_PATH = r"E:\重要内容\GenAI比赛\Inter-university 比赛\voltguard-site\docs\output\stage3\VoltGuard_Interim_Report.docx"

PLUGIN_ROOT = r"C:\Users\Admin1\.workbuddy-ai\plugins\cache\workbuddy-builtin\tencent-docx\5.6.2-wb.39458645.g35219ed6.h85a557611a02"
HTML_TO_DOCX_SCRIPTS = os.path.join(PLUGIN_ROOT, "skills", "html-to-docx", "scripts")
VENV_PYTHON = r"C:\Users\Admin1\.workbuddy\binaries\python\envs\default\Scripts\python.exe"

def read_md():
    with open(MD_PATH, "r", encoding="utf-8") as f:
        return f.read()

def md_to_html(md_text):
    # Convert markdown to HTML body
    md = markdown.Markdown(extensions=[
        "tables",
        "fenced_code",
        "toc",
        "nl2br",
    ])
    body_html = md.convert(md_text)
    return body_html, md.toc

def build_full_html(body_html, toc_html):
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>VoltGuard AI — Interim Progress Report</title>
<style>
:root {{
  --primary: #0c2f3d;
  --accent: #168b78;
  --text: #10252f;
  --muted: #60747d;
  --border: #d8e1e3;
  --bg: #f4f7f6;
  --white: #ffffff;
}}
@page {{
  @bottom-center {{ content: counter(page) " / " counter(pages); font-size: 9pt; color: var(--muted); }}
  @top-right {{ content: "VoltGuard AI — Interim Report"; font-size: 8pt; color: var(--muted); }}
}}
@page cover {{
  @bottom-center {{ content: none; }}
  @top-right {{ content: none; }}
}}
body {{
  font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: 11pt;
  line-height: 1.7;
  color: var(--text);
  background: var(--white);
  margin: 0;
  padding: 0;
}}
section[role="cover"] {{
  page: cover;
  text-align: center;
  padding: 120px 60px;
  background: linear-gradient(135deg, #0c2f3d 0%, #168b78 100%);
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}}
section[role="cover"] h1 {{
  font-size: 32pt;
  font-weight: 800;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}}
section[role="cover"] .subtitle {{
  font-size: 14pt;
  font-weight: 400;
  opacity: 0.9;
  margin-bottom: 60px;
}}
section[role="cover"] .meta {{
  font-size: 11pt;
  opacity: 0.8;
  line-height: 2;
}}
section[role="body"] {{
  padding: 40px 60px;
  max-width: 210mm;
  margin: 0 auto;
}}
h1 {{ font-size: 20pt; color: var(--primary); margin-top: 36pt; margin-bottom: 12pt; border-bottom: 2px solid var(--accent); padding-bottom: 8pt; page-break-after: avoid; }}
h2 {{ font-size: 14pt; color: var(--primary); margin-top: 24pt; margin-bottom: 10pt; page-break-after: avoid; }}
h3 {{ font-size: 12pt; color: var(--primary); margin-top: 18pt; margin-bottom: 8pt; page-break-after: avoid; }}
h4 {{ font-size: 11pt; color: var(--primary); margin-top: 14pt; margin-bottom: 6pt; font-weight: 600; }}
p {{ margin: 8pt 0; text-align: justify; }}
strong {{ color: var(--primary); }}
table {{
  width: 100%;
  border-collapse: collapse;
  margin: 14pt 0;
  font-size: 10pt;
  page-break-inside: avoid;
}}
th {{
  background: var(--primary);
  color: white;
  padding: 8pt 10pt;
  text-align: left;
  font-weight: 600;
}}
td {{
  padding: 7pt 10pt;
  border-bottom: 1px solid var(--border);
}}
tr:nth-child(even) {{ background: var(--bg); }}
tr:hover {{ background: #e8f5f1; }}
ul, ol {{ margin: 8pt 0; padding-left: 24pt; }}
li {{ margin: 4pt 0; }}
blockquote {{
  margin: 14pt 0;
  padding: 12pt 18pt;
  border-left: 4px solid var(--accent);
  background: var(--bg);
  color: var(--muted);
  font-style: italic;
}}
code {{
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 9.5pt;
  background: #f0f4f4;
  padding: 2pt 5pt;
  border-radius: 3pt;
}}
pre {{
  background: #f0f4f4;
  padding: 12pt;
  border-radius: 6pt;
  overflow-x: auto;
  font-size: 9pt;
  line-height: 1.5;
  page-break-inside: avoid;
}}
hr {{ border: none; border-top: 1px solid var(--border); margin: 24pt 0; }}
nav.doc-toc {{
  background: var(--bg);
  padding: 18pt 24pt;
  border-radius: 8pt;
  margin: 18pt 0;
}}
nav.doc-toc h2 {{
  font-size: 12pt;
  margin-top: 0;
  color: var(--primary);
}}
nav.doc-toc ul {{
  list-style: none;
  padding-left: 0;
}}
nav.doc-toc li {{
  margin: 3pt 0;
  font-size: 10pt;
}}
nav.doc-toc a {{
  color: var(--accent);
  text-decoration: none;
}}
</style>
</head>
<body>

<section role="cover">
  <h1>VoltGuard AI</h1>
  <div class="subtitle">Interim Progress Report<br>Hack for SDGs 2026 — Track 1: Green Transport & Smart Mobility</div>
  <div class="meta">
    <strong>Team</strong>: 1023 / LadyBanana, HKBU<br>
    <strong>Date</strong>: 4 October 2026<br>
    <strong>Event</strong>: The Hong Kong Inter-University Generative AI Hackathon for SDGs
  </div>
</section>

<section role="body" data-page-restart="1">
  <nav class="doc-toc">
    <h2>Table of Contents</h2>
    {toc_html}
  </nav>
  {body_html}
</section>

</body>
</html>'''
    return html

def save_html(html_text):
    os.makedirs(os.path.dirname(HTML_PATH), exist_ok=True)
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_text)
    print(f"HTML saved: {HTML_PATH}")

def convert_to_docx():
    os.makedirs(os.path.dirname(DOCX_PATH), exist_ok=True)
    cmd = [
        VENV_PYTHON, "-m", "html_to_docx", "convert", HTML_PATH,
        "-o", DOCX_PATH,
        "--page-size", "A4",
        "--orientation", "portrait",
        "--margin-top", "2.54",
        "--margin-bottom", "2.54",
        "--margin-left", "3.17",
        "--margin-right", "3.17",
    ]
    env = os.environ.copy()
    env["PYTHONPATH"] = HTML_TO_DOCX_SCRIPTS
    import subprocess
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    print("Return code:", result.returncode)
    return result.returncode == 0

def main():
    print("Reading markdown...")
    md_text = read_md()
    print("Converting to HTML...")
    body_html, toc_html = md_to_html(md_text)
    full_html = build_full_html(body_html, toc_html)
    save_html(full_html)
    print("Converting to DOCX...")
    success = convert_to_docx()
    if success:
        print(f"DOCX saved: {DOCX_PATH}")
    else:
        print("DOCX conversion failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
