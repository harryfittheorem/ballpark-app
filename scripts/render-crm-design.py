#!/usr/bin/env python3
"""Build the standalone CRM leadership document using the Python standard library."""

import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/crm-design/specification.html"
TOC = []
USED_IDS = set()
LOCAL_LINKS = {
    "../../research/crm-scope-review.md": "#research-review",
    "../../research/sources.json": "#source-register",
    "scenario-review.md": "#scenario-review",
}


def inline(text):
    tokens = re.compile(r"`([^`]+)`|\[([^\n]*?)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*")
    result, last = [], 0
    for match in tokens.finditer(text):
        result.append(html.escape(text[last:match.start()]))
        if match.group(1) is not None:
            result.append("<code>" + html.escape(match.group(1)) + "</code>")
        elif match.group(2) is not None:
            label, url = match.group(2), match.group(3)
            url = LOCAL_LINKS.get(url, url)
            if not (url.startswith("https://") or url.startswith("#")):
                result.append(html.escape(label))
            else:
                result.append('<a href="' + html.escape(url, quote=True) + '">'
                              + html.escape(label) + "</a>")
        else:
            result.append("<strong>" + html.escape(match.group(4)) + "</strong>")
        last = match.end()
    result.append(html.escape(text[last:]))
    return "".join(result)


def render(markdown):
    lines, out, i = markdown.splitlines(), [], 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            out.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
            i += 1
            continue
        heading = re.match(r"^(#{1,6}) (.+)$", line)
        if heading:
            level, title = len(heading.group(1)), heading.group(2)
            base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            anchor, n = base, 1
            while anchor in USED_IDS:
                n += 1
                anchor = f"{base}-{n}"
            USED_IDS.add(anchor)
            out.append(f'<h{level} id="{anchor}">{inline(title)}</h{level}>')
            if level == 2:
                TOC.append((anchor, title))
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(
                r"^\|[\s:|\-]+\|$", lines[i + 1].strip()):
            cells = lambda row: [c.strip() for c in row.strip().strip("|").split("|")]
            headers = cells(line)
            out.append('<div class="table-scroll"><table><thead><tr>' +
                       "".join("<th>" + inline(c) + "</th>" for c in headers) +
                       "</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                out.append("<tr>" + "".join("<td>" + inline(c) + "</td>"
                                          for c in cells(lines[i])) + "</tr>")
                i += 1
            out.append("</tbody></table></div>")
            continue
        if re.match(r"^(?:- |\d+\. )", line):
            ordered = bool(re.match(r"^\d+\. ", line))
            tag = "ol" if ordered else "ul"
            out.append("<" + tag + ">")
            while i < len(lines) and re.match(r"^(?:- |\d+\. )", lines[i].strip()):
                content = re.sub(r"^(?:- |\d+\. )", "", lines[i].strip())
                out.append("<li>" + inline(content) + "</li>")
                i += 1
            out.append("</" + tag + ">")
            continue
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
                r"^(?:#|```|\||- |\d+\. )", lines[i].strip()):
            paragraph.append(lines[i].strip())
            i += 1
        out.append("<p>" + inline(" ".join(paragraph)) + "</p>")
    return "\n".join(out)


def build():
    specification = render((ROOT / "docs/crm-design/specification.md").read_text())
    scenarios = render((ROOT / "docs/crm-design/scenario-review.md").read_text())
    research = render((ROOT / "research/crm-scope-review.md").read_text())
    registry = json.loads((ROOT / "research/sources.json").read_text())
    sources = registry if isinstance(registry, list) else registry["sources"]
    source_rows = "".join(
        "<tr><td>" + inline(f'[{s["title"]}]({s["url"]})') + "</td><td>" +
        html.escape(s["publicationDate"]) + "</td><td>" +
        html.escape(s.get("scope", "")) + "</td></tr>" for s in sources)
    toc = "".join(f'<a href="#{anchor}">{html.escape(title)}</a>'
                  for anchor, title in TOC)
    document = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clubhouse CRM — Leadership design and plan</title>
<style>
:root{color-scheme:light;--ink:#242a27;--accent:#40634e;--paper:#fbfaf6;--line:#dcded5}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,sans-serif}
header{background:#24362c;color:#f8f3df;padding:54px max(24px,calc((100vw - 1240px)/2))}
header small{letter-spacing:.16em;text-transform:uppercase;color:#ddcf9d}
header h1{font-size:clamp(32px,4vw,56px);line-height:1.12;margin:14px 0}
header p{max-width:820px;color:#e0e6dc}.status{display:inline-block;padding:5px 12px;border:1px solid #81927b;border-radius:30px;font-size:13px}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:46px;max-width:1320px;margin:auto;padding:40px 28px}
nav{position:sticky;top:20px;max-height:92vh;overflow:auto;align-self:start;font-size:13px}
nav strong{display:block;margin-bottom:14px}nav a{display:block;padding:7px 9px;border-left:2px solid var(--line);text-decoration:none;color:#45564a}
nav a:hover,nav a:focus-visible{border-color:var(--accent);background:#e8eee4}
main{min-width:0}h1,h2,h3{line-height:1.25;letter-spacing:-.025em}main h1{font-size:38px}
h2{font-size:26px;margin-top:46px;padding-top:18px;border-top:1px solid var(--line)}
h3{font-size:21px;margin-top:28px}a{color:#2f6346;text-underline-offset:3px}
p{max-width:86ch}strong{font-weight:650}li{margin:8px 0}
code{font:13px/1.6 ui-monospace,monospace;background:#eeeede;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}
pre{overflow:auto;padding:15px;background:#eeeede}.table-scroll{overflow:auto;margin:22px 0;border:1px solid var(--line);border-radius:9px}
table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.5}th,td{text-align:left;vertical-align:top;padding:13px 14px;border-bottom:1px solid var(--line);min-width:125px}
th{background:#e8eddf;color:#2a4434;font-weight:650}tr:last-child td{border-bottom:0}
tr:nth-child(even) td{background:#f5f5ed}section.appendix{margin-top:70px;border-top:4px solid #b4be9e}
footer{padding:28px;text-align:center;border-top:1px solid var(--line);font-size:13px;color:#596257}
@media(max-width:850px){.layout{display:block;padding:24px 18px}nav{position:static;max-height:220px;margin-bottom:30px}header{padding:35px 22px}th,td{padding:10px}main h1{font-size:30px}}
@media print{nav{display:none}.layout{display:block;max-width:none;padding:0}header{padding:24px;background:white;color:black}header p,header small{color:#333}.status{border-color:#555}h2{break-after:avoid}tr{break-inside:avoid}.table-scroll{overflow:visible}a{color:inherit}body{font-size:11px}table{font-size:10px}footer{display:none}}
</style></head><body>
<header><small>Infinite Hitting / Clubhouse</small><h1>Native CRM<br>Leadership design and plan</h1>
<p>One review package for the proposed experience, family-safe communication, tagging, opportunity pipelines and configurable workflows.</p>
<span class="status">Design proposal · Sample data · No live sends</span></header>
<div class="layout"><nav aria-label="Document contents"><strong>Review contents</strong>""" + toc + """
<a href="#scenario-review">Scenario review checklist</a><a href="#research-review">Research appendix</a>
<a href="#source-register">Source register</a></nav><main>""" + specification + """
<section class="appendix" id="scenario-review">""" + scenarios + """</section>
<section class="appendix" id="research-review">""" + research + """</section>
<section class="appendix" id="source-register"><h2>Source register</h2>
<p>Dates below are copied from retrieved primary evidence where established; unknown dates are not inferred.</p>
<div class="table-scroll"><table><thead><tr><th>Source</th><th>Publication/update evidence</th><th>Scope</th></tr></thead><tbody>""" + source_rows + """</tbody></table></div></section>
</main></div><footer>Review and approval artifact. Not production software, legal certification or permission to contact customers.</footer></body></html>"""
    OUTPUT.write_text(document)
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
