#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 competition/docs 下的 Markdown 文书导成适合评审阅读的 PDF。

本机没有 markdown 库、也没有 pandoc，所以这里自带一个够用的
Markdown → HTML 转换器（标题 / 加粗 / 行内代码 / 代码块 / 表格 /
有序无序列表 / 引用 / 分隔线 / 复选框），再交给 Chrome 无头模式打印成 PDF。

用法： <python> make_docs.py
输出： docs/pdf/<原名>.pdf
"""
import html
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "docs")
OUTDIR = os.path.join(DOCS, "pdf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 纸墨红，和作品本身一套视觉
CSS = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: "PingFang SC", "Hiragino Sans GB", "Songti SC", serif;
  color: #17120d; background: #fff; font-size: 10.5pt; line-height: 1.75;
  margin: 0;
}
h1 { font-size: 19pt; margin: 0 0 6pt; padding-bottom: 6pt;
     border-bottom: 2.5pt solid #a3272c; letter-spacing: .01em; }
h2 { font-size: 14pt; margin: 20pt 0 8pt; padding-left: 8pt;
     border-left: 4pt solid #a3272c; }
h3 { font-size: 12pt; margin: 15pt 0 6pt; color: #7e1c21; }
h4 { font-size: 11pt; margin: 12pt 0 5pt; }
p { margin: 0 0 8pt; }
strong { color: #000; }
code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9pt;
       background: #f4efe3; padding: 1pt 3pt; border: .5pt solid #e0d8c6; }
pre { background: #f9f5ea; border: .5pt solid #e0d8c6; border-left: 3pt solid #a8862f;
      padding: 8pt 10pt; overflow-wrap: break-word; white-space: pre-wrap;
      font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 8.6pt;
      line-height: 1.5; margin: 0 0 10pt; }
pre code { background: none; border: none; padding: 0; font-size: 8.6pt; }
table { border-collapse: collapse; width: 100%; margin: 0 0 12pt; font-size: 9.4pt; }
th, td { border: .5pt solid #c9c0ad; padding: 4pt 6pt; text-align: left;
         vertical-align: top; }
th { background: #f4efe3; font-weight: 600; }
tr:nth-child(even) td { background: #fbf8f1; }
blockquote { margin: 0 0 10pt; padding: 7pt 10pt; background: #f9f5ea;
             border-left: 3pt solid #a3272c; color: #4a423a; }
blockquote p:last-child { margin-bottom: 0; }
ul, ol { margin: 0 0 9pt; padding-left: 18pt; }
li { margin-bottom: 3pt; }
hr { border: none; border-top: .8pt solid #d8d0c0; margin: 16pt 0; }
.cb { font-family: "PingFang SC", sans-serif; }
a { color: #7e1c21; text-decoration: none; }
"""


def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"<a href='\2'>\1</a>", t)
    return t


def md_to_html(md: str) -> str:
    lines = md.split("\n")
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]

        # 代码块
        if ln.startswith("```"):
            buf = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(html.escape(lines[i]))
                i += 1
            i += 1
            out.append("<pre><code>" + "\n".join(buf) + "</code></pre>")
            continue

        # 表格
        if ln.lstrip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
            header = [c.strip() for c in ln.strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            t = ["<table><thead><tr>"]
            t += [f"<th>{inline(c)}</th>" for c in header]
            t.append("</tr></thead><tbody>")
            for r in rows:
                t.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
            t.append("</tbody></table>")
            out.append("".join(t))
            continue

        # 标题
        m = re.match(r"^(#{1,6})\s+(.*)$", ln)
        if m:
            lv = len(m.group(1))
            out.append(f"<h{lv}>{inline(m.group(2))}</h{lv}>")
            i += 1
            continue

        # 分隔线
        if re.match(r"^\s*([-*_])\1{2,}\s*$", ln):
            out.append("<hr>")
            i += 1
            continue

        # 引用
        if ln.lstrip().startswith(">"):
            buf = []
            while i < len(lines) and lines[i].lstrip().startswith(">"):
                buf.append(lines[i].lstrip()[1:].strip())
                i += 1
            out.append("<blockquote>" + "".join(f"<p>{inline(b)}</p>" for b in buf) + "</blockquote>")
            continue

        # 列表（含复选框）
        if re.match(r"^\s*([-*+]|\d+\.)\s+", ln):
            ordered = bool(re.match(r"^\s*\d+\.\s+", ln))
            items = []
            while i < len(lines) and re.match(r"^\s*([-*+]|\d+\.)\s+", lines[i]):
                body = re.sub(r"^\s*([-*+]|\d+\.)\s+", "", lines[i])
                box = ""
                mb = re.match(r"^\[([ xX])\]\s*(.*)$", body)
                if mb:
                    box = '<span class="cb">☑ </span>' if mb.group(1).lower() == "x" else '<span class="cb">☐ </span>'
                    body = mb.group(2)
                items.append(f"<li>{box}{inline(body)}</li>")
                i += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(items) + f"</{tag}>")
            continue

        # 空行
        if not ln.strip():
            i += 1
            continue

        # 段落（合并到下一个空行）
        buf = [ln]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
            r"^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|>|\||```)", lines[i]
        ) and not re.match(r"^\s*([-*_])\1{2,}\s*$", lines[i]):
            buf.append(lines[i])
            i += 1
        out.append("<p>" + inline(" ".join(buf)) + "</p>")

    return "\n".join(out)


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    files = sorted(f for f in os.listdir(DOCS) if f.endswith(".md"))
    made = []
    for name in files:
        src = os.path.join(DOCS, name)
        md = open(src, encoding="utf-8").read()
        html_doc = (
            "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>"
            f"<title>{html.escape(name)}</title><style>{CSS}</style></head><body>"
            + md_to_html(md) + "</body></html>"
        )
        stem = os.path.splitext(name)[0]
        tmp = os.path.join(OUTDIR, stem + ".html")
        open(tmp, "w", encoding="utf-8").write(html_doc)
        pdf = os.path.join(OUTDIR, stem + ".pdf")
        subprocess.run([
            CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
            f"--print-to-pdf={pdf}", "file://" + tmp,
        ], check=False, capture_output=True)
        ok = os.path.exists(pdf) and os.path.getsize(pdf) > 3000
        print(("  ✅ " if ok else "  ❌ ") + name + " → " + os.path.basename(pdf)
              + (f" ({os.path.getsize(pdf)//1024} KB)" if ok else " 生成失败"))
        if ok:
            made.append(pdf)
        else:
            try:
                os.remove(tmp)
            except OSError:
                pass
    print(f"\n共生成 {len(made)} 个 PDF → {OUTDIR}")


if __name__ == "__main__":
    main()
