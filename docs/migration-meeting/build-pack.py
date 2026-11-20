#!/usr/bin/env python3
"""Build self-contained meeting documents using only Python's standard library.

This intentionally renders the small Markdown subset used by these documents;
it is not an application endpoint or an operational migration tool.
"""
from html import escape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
OUTPUT = ROOT / "generated-artifacts" / "migration-meeting"
DOC_IDS = {
    "OWNER-BRIEFING.md": "briefing",
    "MEETING-SUMMARY.md": "summary",
    "MEETING-AGENDA.md": "agenda",
    "OPERATIONS-WORKBOOK.md": "workbook",
    "TECHNICAL-APPENDIX.md": "technical",
}

CSS = """
:root { color-scheme: light; --ink:#152337; --gold:#9a6a13; --line:#d9dfe5; }
* { box-sizing:border-box; }
body { margin:0; background:#eef1f4; color:var(--ink);
       font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.cover { background:#152337; color:#fff; padding:68px max(6vw,24px) 52px;
         border-top:7px solid #d3a64b; }
.cover-inner, main, .nav-inner { max-width:1120px; margin:auto; }
.eyebrow { color:#e5bd6c; text-transform:uppercase; font-size:12px; letter-spacing:.18em; }
.cover h1 { font-size:clamp(32px,5vw,58px); line-height:1.12; max-width:850px; margin:20px 0; }
.cover p { max-width:780px; color:#dce3eb; }
.badge { display:inline-block; padding:7px 13px; border:1px solid #687689;
         border-radius:4px; font-size:13px; }
nav { padding:15px 24px; background:#fff; border-bottom:1px solid var(--line); }
nav a { display:inline-block; margin:4px 22px 4px 0; font-size:14px; font-weight:650; }
main { padding:24px 0 60px; }
article { background:#fff; margin:20px 0; padding:44px 48px; border:1px solid var(--line); }
article > h1 { font-size:30px; line-height:1.25; border-bottom:3px solid #d3a64b; padding-bottom:20px; }
h2 { margin-top:42px; font-size:24px; line-height:1.3; }
h3 { margin-top:30px; font-size:19px; line-height:1.4; }
h1,h2,h3 { scroll-margin-top:24px; }
a { color:#235b87; text-underline-offset:3px; overflow-wrap:anywhere; }
p { margin:14px 0; } li { margin:9px 0; }
ul,ol { padding-left:26px; }
code { background:#f1f3f6; padding:2px 5px; border-radius:3px;
       font-size:.84em; overflow-wrap:anywhere; }
.table-wrap { overflow-x:auto; margin:24px 0; }
table { width:100%; border-collapse:collapse; font-size:14px; line-height:1.55; }
th { background:#eaf0f5; text-align:left; color:#152337; }
th,td { padding:13px 14px; border:1px solid var(--line); vertical-align:top; min-width:145px; }
tr:nth-child(even) td { background:#fafbfd; }
blockquote { margin:24px 0; border-left:4px solid #d3a64b; padding:10px 20px; background:#fbf8f0; }
footer { padding:18px 0; font-size:12px; color:#526174; }
@media(max-width:700px) {
 main { padding:0 10px 30px; } article { padding:26px 20px; }
 body { font-size:15px; } h2 { font-size:22px; }
}
@media print {
 @page { size:A4; margin:16mm 13mm; }
 body { background:#fff; font-size:10pt; line-height:1.45; }
 .cover { padding:25mm 12mm; print-color-adjust:exact; }
 .cover h1 { font-size:32pt; }
 nav { display:none; } main { padding:0; max-width:none; }
 article { border:0; margin:0; padding:0; break-before:page; }
 article > h1 { font-size:22pt; } h2 { font-size:16pt; } h3 { font-size:12pt; }
 h1,h2,h3 { break-after:avoid; } tr { break-inside:avoid; }
 table { font-size:8pt; } th,td { min-width:0; padding:6px; overflow-wrap:anywhere; }
 .table-wrap { overflow:visible; } thead { display:table-header-group; }
 a { color:inherit; } footer { font-size:8pt; }
}
"""


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def inline(text, doc_id, included):
    tokens = []

    def token(value):
        tokens.append(value)
        return f"\x00{len(tokens)-1}\x00"

    text = re.sub(r"`([^`]+)`", lambda m: token("<code>" + escape(m[1]) + "</code>"), text)

    def link(match):
        label, href = match.groups()
        if href.startswith("#"):
            href = f"#{doc_id}-{href[1:]}"
        elif href in DOC_IDS:
            target = DOC_IDS[href]
            # Standalone editions remain self-contained: do not create dead links.
            if target not in included:
                return token(escape(label) + " (see companion document)")
            href = "#" + target
        if not (href.startswith(("https://", "#"))):
            return token(escape(label))
        return token(f'<a href="{escape(href, quote=True)}">{escape(label)}</a>')

    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link, text)
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: tokens[int(m[1])], text)


def render(markdown, doc_id, included):
    lines, out = markdown.splitlines(), []
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        heading = re.match(r"^(#{1,6}) (.+)$", line)
        if heading:
            level, text = len(heading[1]), heading[2]
            out.append(f'<h{level} id="{doc_id}-{slug(text)}">{inline(text, doc_id, included)}</h{level}>')
            index += 1
        elif line.startswith("|"):
            rows = []
            while index < len(lines) and lines[index].startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                    rows.append(cells)
                index += 1
            out.append('<div class="table-wrap"><table><thead><tr>')
            out.extend(f"<th>{inline(c, doc_id, included)}</th>" for c in rows[0])
            out.append("</tr></thead><tbody>")
            for row in rows[1:]:
                out.append("<tr>" + "".join(f"<td>{inline(c, doc_id, included)}</td>" for c in row) + "</tr>")
            out.append("</tbody></table></div>")
        elif re.match(r"^(- |\d+\. )", line):
            ordered = bool(re.match(r"^\d+\. ", line))
            tag = "ol" if ordered else "ul"
            start = f' start="{line.split(".")[0]}"' if ordered else ""
            out.append(f"<{tag}{start}>")
            pattern = r"^\d+\. (.*)" if ordered else r"^- (.*)"
            while index < len(lines) and (match := re.match(pattern, lines[index])):
                out.append("<li>" + inline(match[1], doc_id, included) + "</li>")
                index += 1
            out.append(f"</{tag}>")
        else:
            paragraph = [line]
            index += 1
            while index < len(lines) and lines[index].strip() and not re.match(r"^(#|\||- |\d+\. )", lines[index]):
                paragraph.append(lines[index])
                index += 1
            out.append("<p>" + inline(" ".join(paragraph), doc_id, included) + "</p>")
    return "\n".join(out)


def build(filename, title, subtitle, sources):
    included = {DOC_IDS[source] for source in sources}
    nav = " ".join(f'<a href="#{DOC_IDS[source]}">{escape(source.replace(".md", "").replace("-", " ").title())}</a>' for source in sources)
    articles = "\n".join(
        f'<article id="{DOC_IDS[source]}">{render((SOURCE / source).read_text(), DOC_IDS[source], included)}</article>'
        for source in sources
    )
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title><style>{CSS}</style></head><body>
<header class="cover"><div class="cover-inner"><div class="eyebrow">Infinite Hitting · owner meeting · 12 November 2026</div>
<h1>{escape(title)}</h1><p>{escape(subtitle)}</p>
<span class="badge">Clearwater first · conditional 30-day target</span></div></header>
<nav aria-label="Document sections"><div class="nav-inner">{nav}</div></nav>
<main>{articles}<footer>Prepared for discovery and a gated pilot. No cancellation, live collection or network rollout is authorized by this pack. Print this file from your browser to save a PDF.</footer></main>
</body></html>"""
    (OUTPUT / filename).write_text(html)
    print(f"{filename}: {len(html.encode()):,} bytes")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build("owner-meeting-pack.html", "Protect revenue through the Mindbody migration",
          "A decision briefing and practical operating plan for moving to Ballpark by Infinite Hitting—without treating an imported record as working billing.",
          ["OWNER-BRIEFING.md", "OPERATIONS-WORKBOOK.md", "MEETING-AGENDA.md"])
    build("meeting-summary.html", "The Clearwater pilot decision",
          "A short leave-behind: what exists, what remains unverified, what owners are being asked to approve.",
          ["MEETING-SUMMARY.md"])
    build("internal-technical-appendix.html", "Internal evidence and readiness backlog",
          "Code-present is not live-operational acceptance. Use this appendix to scope the work required before cutover.",
          ["TECHNICAL-APPENDIX.md"])
