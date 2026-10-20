#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""门外谈 · 答辩 PPT（v3 重做）

三条硬规矩：
  1. 字体只用 Windows 自带（微软雅黑 + 宋体）——旧版写了 PingFang SC，
     评委在 Windows 打开会掉字体，整套设计就散了
  2. 每页一个主张，正文 ≤ 90 字
  3. 内容不超过版面 60%，留白要真留

用法： <python> make_ppt.py
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- 设计令牌 ----------
INK = RGBColor(0x17, 0x12, 0x0D)
INK_SOFT = RGBColor(0x5A, 0x51, 0x47)
INK_FAINT = RGBColor(0x9A, 0x93, 0x88)
RED = RGBColor(0xA3, 0x27, 0x2C)
PAPER = RGBColor(0xF4, 0xEF, 0xE3)
CARD = RGBColor(0xF9, 0xF5, 0xEA)
LINE = RGBColor(0xD8, 0xD0, 0xC0)
GHOST = RGBColor(0xE7, 0xDF, 0xCB)

SERIF = "宋体"
UI = "微软雅黑"

# ---------- 网格 ----------
W, H = 13.333, 7.5
ML = 0.9
CW = 11.53
HEAD_RULE_Y = 1.86
BODY_Y = 2.15
FOOT_Y = 7.02

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]
_page = {"n": 0}


def _strip_style(shape):
    """删掉 add_shape 自带的 <p:style> ——否则 PowerPoint/LibreOffice 会给它加默认阴影，
    那正是「廉价感」的头号来源。"""
    sp = shape._element
    for tag in ("{http://schemas.openxmlformats.org/presentationml/2006/main}style",):
        el = sp.find(tag)
        if el is not None:
            sp.remove(el)


def new_slide():
    s = prs.slides.add_slide(BLANK)
    _page["n"] += 1
    bgs = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bgs.fill.solid(); bgs.fill.fore_color.rgb = PAPER
    bgs.line.fill.background(); bgs.shadow.inherit = False
    _strip_style(bgs)
    return s


def rect(slide, x, y, w, h, color, outline=None, shape=MSO_SHAPE.RECTANGLE):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = color
    if outline is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = outline; s.line.width = Pt(1)
    s.shadow.inherit = False
    _strip_style(s)
    return s


def tb(slide, x, y, w, h, text, size=15, bold=False, color=INK,
       align=PP_ALIGN.LEFT, font=UI, line=1.5, spacing=None, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, ln in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line
        r = p.add_run(); r.text = ln
        r.font.size = Pt(size); r.font.bold = bold
        r.font.color.rgb = color; r.font.name = font
        if spacing is not None:
            rPr = r._r.get_or_add_rPr()
            rPr.set("spc", str(int(spacing * 100)))
    return box


def hair(slide, x, y, w, color=LINE, h=1):
    return rect(slide, x, y, w, h / 96, color)


def head(slide, kicker, title, tsize=40):
    # 先画细线：它必须沉在文字底下，否则会横穿标题的底部笔画
    hair(slide, ML, HEAD_RULE_Y, CW)
    rect(slide, ML, 0.60, 0.085, 0.70, RED)
    tb(slide, ML + 0.28, 0.58, 9.0, 0.30, kicker, 11.5, True, RED, spacing=2.4)
    if _HAVE_DISPLAY:
        display(slide, ML + 0.28, 0.90, title, tsize, max_w=CW - 0.3)
    else:
        tb(slide, ML + 0.28, 0.92, CW - 0.3, 0.78, title, tsize, True, INK,
           font=SERIF, spacing=1.2, line=1.0)


def foot(slide):
    tb(slide, ML, FOOT_Y, 6.0, 0.26, "门外谈 · 作品编号 375993", 9.5, False, INK_FAINT)
    tb(slide, ML + CW - 1.2, FOOT_Y, 1.2, 0.26, f"{_page['n']:02d}", 10, True, INK_FAINT,
       align=PP_ALIGN.RIGHT)


def pic(slide, relpath, x, y, w=None, h=None):
    path = relpath if os.path.isabs(relpath) else os.path.join(HERE, relpath)
    iw, ih = Image.open(path).size
    if w and not h:
        h = w * ih / iw
    if h and not w:
        w = h * iw / ih
    return slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))



# ---------- 得意黑：大标题一律渲成图片 ----------
# 得意黑不是系统字体。写成字体名，评委电脑上没有就会掉回默认字体，
# 你在自己机器上看是好的，交上去就变样。所以大标题全部渲成透明 PNG。
DISPLAY_TTF = "/tmp/SmileySans.ttf"
_HAVE_DISPLAY = os.path.exists(DISPLAY_TTF)


def display_png(text, pt, color=INK, spacing=0.04, out="/tmp/dt.png", pad=0.06):
    """把多行文字渲成紧贴的透明 PNG，返回 (路径, 宽高比)。"""
    px = max(12, int(pt * 4))                     # 4x 超采样，缩放后不糊
    font = ImageFont.truetype(DISPLAY_TTF, px)
    sp = px * spacing
    lines = text.split("\n")
    adv = []
    for ln in lines:
        w = sum(font.getlength(ch) for ch in ln) + sp * max(0, len(ln) - 1)
        adv.append(w)
    asc, desc = font.getmetrics()
    line_h = (asc + desc) * 1.02
    W = int(max(adv) + px * pad * 2)
    H = int(line_h * len(lines) + px * pad * 2)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = px * pad
    for ln, w in zip(lines, adv):
        x = px * pad
        for ch in ln:
            d.text((x, y), ch, font=font, fill=(color[0], color[1], color[2], 255))
            x += font.getlength(ch) + sp
        y += line_h
    # 裁掉透明边距 —— 字体自带的行高留白会让缩放后的字形缩水
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(out)
    return out, img.width / img.height, len(lines)


def display(slide, x, y, text, pt, color=INK, spacing=0.04, max_w=None, align="left"):
    """放一段得意黑大字。按字号定高，宽度由 PNG 比例推出。"""
    path, ratio, nlines = display_png(text, pt, color, spacing)
    h = (pt / 72) * 1.06 * nlines
    w = h * ratio
    if max_w and w > max_w:
        w = max_w
        h = w / ratio
    px = x if align == "left" else (x - w if align == "right" else x - w / 2)
    slide.shapes.add_picture(path, Inches(px), Inches(y), Inches(w), Inches(h))
    return w, h


SH = "screenshots"

# ============================================================
# 01 封面
# ============================================================
s = new_slide()
tb(s, 7.15, 0.68, 5.7, 6.1, "辩", 250, True, GHOST, font=SERIF, align=PP_ALIGN.CENTER, line=1.0)
rect(s, 0, 0, W, 0.10, RED)
tb(s, ML, 0.86, 9.0, 0.28, "2026 年第十四届全国大学生数字媒体科技作品及创意竞赛",
   11.5, True, RED, spacing=1.6)
if _HAVE_DISPLAY:
    display(s, ML, 1.42, "门外谈", 100, spacing=0.10)
else:
    tb(s, ML, 1.42, 6.6, 1.47, "门外谈", 100, True, INK, font=SERIF, spacing=6, line=1.0)
tb(s, ML, 3.10, 6.9, 0.40, "——基于信息不对称机制的多智能体圆桌辩论系统",
   17.5, False, INK_SOFT, font=UI, spacing=0.4)
hair(s, ML, 3.68, 3.2, RED, 3)

meta = [
    ("作品编号", "375993"),
    ("参赛分类", "自主选题类 · 移动与网络应用开发"),
    ("完成人", "冯思涵 · 张耀羽（哈尔滨金融学院）"),
    ("指导教师", "胡芳驰 · 霍镜宇"),
    ("在线地址", "https://outgate.chat"),
]
yy = 4.10
for k, v in meta:
    tb(s, ML, yy, 1.15, 0.26, k, 10.5, False, INK_FAINT, spacing=1.2)
    tb(s, ML + 1.25, yy - 0.01, 6.2, 0.28, v, 12, False, INK, spacing=0.4)
    yy += 0.42
foot(s)

# ============================================================
# 02 人格（蒸馏）
# ============================================================
s = new_slide()
head(s, "02 · 人格", "为什么这些角色像真人")

tb(s, ML, BODY_Y + 0.04, 5.30, 1.15,
   "一般做法是给模型一句人设：「你是鲁迅，说话犀利」。\n"
   "模型于是变得犀利——但那是你要的犀利，不是鲁迅的。\n\n"
   "蒸馏人格是另一回事：把一个人拆成可执行的几节。",
   12.5, False, INK_SOFT, line=1.85)

PARTS = [
    ("核心身份", "他是谁。第一人称发言，明确不是替你写作的工具"),
    ("思想根基", "在什么问题上必然持什么立场：批判精神、国民性、文学救国"),
    ("语言特征", "句式、修辞、结构、意象，逐条写成约束，而不是一句形容词"),
    ("语录库", "收他的原话，用来校准语气"),
]
yy = 3.92
for i, (k, v) in enumerate(PARTS):
    tb(s, ML, yy, 0.34, 0.28, f"0{i+1}", 11, True, RED)
    tb(s, ML + 0.44, yy - 0.02, 1.05, 0.30, k, 12, True, INK, font=SERIF, spacing=0.4)
    tb(s, ML + 1.58, yy - 0.02, 3.75, 0.62, v, 11, False, INK_SOFT, line=1.6)
    yy += 0.60

rect(s, ML, 6.34, 0.055, 0.40, RED)
tb(s, ML + 0.24, 6.38, 5.2, 0.36,
   "所以他不顺着你说话——因为他本来就有立场。", 12.5, True, INK, line=1.5)

# 右侧：真实 SKILL.md 片段
XR = 6.85
rect(s, XR, BODY_Y + 0.02, 5.55, 4.42, CARD, LINE)
tb(s, XR + 0.30, BODY_Y + 0.24, 4.95, 3.95,
   "---\nname: luxun\n---\n\n"
   "# 鲁迅 · 人物志\n\n"
   "你就是鲁迅本人，不是任何人的视角替身，\n更不是写作工具。\n\n"
   "## 思想根基\n批判精神 · 国民性分析 · 文学救国\n\n"
   "## 写作风格指南\n语言特征 · 修辞技法 · 结构模式 · 意象体系",
   10.5, False, INK_SOFT, line=1.55)
tb(s, XR, BODY_Y + 4.54, 5.55, 0.30,
   "鲁迅那份 SKILL.md 的真实开头 · 站内 34 份、合计约 40 万字节", 9.5, False, INK_FAINT)
foot(s)

# ============================================================
# 03 起点（v1 的创意本身）
# ============================================================
s = new_slide()
head(s, "03 · 起点", "一次只能跟一个人聊")

tb(s, ML, BODY_Y + 0.04, 5.55, 4.5,
   "最初只是想找个能真正交流的 AI。问「我该不该放弃这个专业」，\n"
   "回答是「这取决于你的兴趣和目标」——聊完，疑问还在原处。\n\n"
   "后来在 GitHub 上看到，有人把名人整理成可对话的人格包。\n"
   "接进去才发现：这些角色并不好说话。\n\n"
   "但一次只能跟一个人，本质上还是我问、他答。\n"
   "我更好奇的是他们彼此之间的分歧——\n"
   "把鲁迅和乔布斯放在一起，立场几乎不可能调和。\n\n"
   "于是做了圆桌：几位依次发言，后说的人能看到前面说了什么。",
   13, False, INK_SOFT, line=1.86)

# 右侧：引文 + 版本标注
rect(s, 7.05, BODY_Y + 0.08, 0.055, 1.60, RED)
tb(s, 7.35, BODY_Y + 0.16, 4.9, 1.0,
   "「凭什么认为\n退学是一条路。」", 20, False, INK, font=SERIF, line=1.6)
tb(s, 7.35, BODY_Y + 1.18, 4.9, 0.62,
   "问鲁迅该不该退学，他没有分析利弊，而是反问。\n这种被追问的感觉，比被安慰更有用。",
   11.5, False, INK_FAINT, line=1.7)

hair(s, 7.05, 4.95, 4.9, LINE)
tb(s, 7.05, 5.08, 4.9, 0.70,
   "「选个位子，抛一个问题，看他们吵起来。」", 12.5, True, INK, line=1.6)
tb(s, 7.05, 5.72, 4.9, 0.26, "—— 第一版的项目介绍", 10, False, INK_FAINT)

hair(s, 7.05, 6.06, 4.9, LINE)
tb(s, 7.05, 6.16, 4.9, 0.62,
   "2026-08-24 首次提交　·　v1 已做出：\n圆桌　·　火候三档（随口 / 较真 / 上头）　·　人物志",
   10.5, False, INK_FAINT, line=1.7)
foot(s)

# ============================================================
# 04 人物库
# ============================================================
NAMES = ["鲁迅", "哈耶克", "凯恩斯", "柏拉图", "孔子", "马克思", "乔布斯", "马斯克", "尼采", "福柯", "苏格拉底", "维特根斯坦", "爱因斯坦", "图灵", "黄仁勋", "巴菲特", "达利欧", "波伏娃", "亚里士多德", "亚当·斯密", "康德", "达尔文", "罗素", "奥威尔", "加缪", "马丁·路德·金", "福尔摩斯", "梵高", "薛定谔", "丘吉尔", "爱丽丝", "牛顿", "叔本华", "莎士比亚"]
s = new_slide()
head(s, "04 · 人物", "把这些散落的人格，收成一份名单")

tb(s, ML, BODY_Y + 0.04, 4.35, 3.6,
   "桌上的思想者不是我们凭空造的。\n\n"
   "它们原本散落在开源社区的不同仓库里：格式统一为 SKILL.md，"
   "但体例、文案、可用程度各不相同，彼此不知道对方存在。\n\n"
   "本作品做的是把它们汇总、筛选、补齐、接入——"
   "统一中英文名与首字标记，补齐介绍与代表言论，"
   "标注每一份的上游仓库，并逐位调校到能在同一张桌上说话不跑题。\n\n"
   "人物志里点开任何一位，都能顺着他找到原始出处。",
   12.5, False, INK_SOFT, line=1.85)

# 右侧：34 个名字的名单（证据）
XR, YR = 5.75, BODY_Y + 0.02
tb(s, XR, YR, 6.6, 0.28,
   f"站内人格 {len(NAMES)} 位（3 位内置 + {len(NAMES)-3} 位开源社区导入）",
   10.5, False, INK_FAINT, spacing=0.6)
hair(s, XR, YR + 0.36, 6.62, LINE)

cols = 5
cw = 6.62 / cols
for i, nm in enumerate(NAMES):
    r, c = divmod(i, cols)
    x = XR + c * cw
    y = YR + 0.52 + r * 0.42
    tb(s, x, y, cw - 0.06, 0.30, nm, 11,
       False, INK if i < 3 else INK_SOFT, line=1.2)

tb(s, XR, YR + 0.52 + 7 * 0.42 + 0.10, 6.6, 0.30,
   "深色为内置，浅色为开源社区导入。", 9.5, False, INK_FAINT)
foot(s)

# ============================================================
# 05 问题
# ============================================================
s = new_slide()
head(s, "05 · 问题", "可他们很快聊成一团和气")
tb(s, ML, BODY_Y + 0.10, 5.62, 2.5,
   "圆桌跑起来之后，有一件事很扫兴：\n"
   "前面的人说了什么，后面的人就顺着说。\n"
   "几轮之后气氛融洽——和最初那种「你的想法很有道理」\n"
   "并没有本质区别。",
   14, False, INK_SOFT, line=1.95)

# 「原因」提出来，作为独立判断
rect(s, ML, 4.22, 0.055, 0.52, RED)
tb(s, ML + 0.26, 4.28, 5.4, 0.46,
   "原因：他们掌握的信息完全相同。", 15, True, INK, line=1.5)
rect(s, ML, 5.22, 0.055, 1.05, RED)
tb(s, ML + 0.26, 5.30, 5.5, 0.92,
   "「我同意鲁迅的观点。」\n——立场最互斥的两人，第一轮就合流。",
   17, False, INK, line=1.85)
pic(s, f"{SH}/04-圆桌辩论-公开交锋.png", 6.78, BODY_Y + 0.06, w=5.62)
tb(s, 6.78, BODY_Y + 0.06 + 5.62 * 727 / 1316 + 0.10, 5.62, 0.26,
   "v1 实测截图 · 加了「别和稀泥」也没用", 9.5, False, INK_FAINT)
foot(s)

# ============================================================
# 06 转折：一句话
# ============================================================
s = new_slide()
rect(s, 0, 0, W, 0.10, RED)
tb(s, ML, 1.05, 6.6, 0.28, "一句话 · 这就是我们的答案", 11.5, True, RED, spacing=3)
if _HAVE_DISPLAY:
    display(s, ML, 1.50, "给 AI 圆桌加一层\n「谁被谁看见了」。", 62, spacing=0.06, max_w=10.6)
else:
    tb(s, ML, 1.62, 10.6, 2.6, "给 AI 圆桌加一层\n「谁被谁看见了」。",
       54, True, INK, font=SERIF, line=1.45, spacing=2)
hair(s, ML, 4.42, 3.4, RED, 3)
tb(s, ML, 4.78, 9.2, 0.9,
   "人格写得多像是上一层；这里动的是下面一层——\n"
   "每个人掌握了什么信息，以及谁被谁看见了。",
   15, False, INK_SOFT, line=1.75)
foot(s)

# ============================================================
# 04 五个机制
# ============================================================
s = new_slide()
head(s, "06 · 结构", "加的不是功能，是一层结构")
MECHS = [
    ("①", "可见性", "发言可以只让\n某一位看到"),
    ("②", "悄悄话", "私下对一个人说\n其他人不知道"),
    ("③", "点名对质", "被私下告知的人\n当众点名对方"),
    ("④", "新颖度", "估算这一轮\n说出了多少新东西"),
    ("⑤", "主持人收尾", "仍无新意\n由主持人拆穿"),
]
bw, gap = 1.98, 0.30
bx, by = ML, 2.42
for i, (no, name, desc) in enumerate(MECHS):
    rect(s, bx, by, bw, 1.62, CARD, LINE)
    tb(s, bx + 0.16, by + 0.14, 0.5, 0.30, no, 15, True, RED)
    tb(s, bx + 0.16, by + 0.50, bw - 0.3, 0.34, name, 16, True, INK, font=SERIF, spacing=0.8)
    tb(s, bx + 0.16, by + 0.92, bw - 0.28, 0.60, desc, 10.5, False, INK_SOFT, line=1.5)
    if i < 4:
        tb(s, bx + bw - 0.02, by + 0.62, gap + 0.04, 0.34, "→", 15, True, RED, align=PP_ALIGN.CENTER)
    bx += bw + gap

tb(s, ML, 4.42, CW, 0.34, "前三个构成信息层，第四个判断讨论是否空转，第五个兜底。",
   12.5, False, INK_FAINT, line=1.6)
hair(s, ML, 4.92, CW)
tb(s, ML, 5.14, CW, 0.62,
   "它们不是五个功能点，是一条链：私下说 → 当众摊牌 → 被点名者接火 → 若开始打太极就强制反对 → 仍无新意则由主持人收尾。",
   14, False, INK, line=1.75)
foot(s)

# ============================================================
# 05–08 机制页
# ============================================================
MECH_SLIDES = [
    ("07 · 机制 ①", "可见性：每个人的历史不一样",
     "每条发言带一个可见性标记（public 或某个人）。\n"
     "生成每位发言者的回复时，只投喂他有权读到的那部分历史——\n"
     "不是前端隐藏，是根本没有进入他的上下文。",
     "结果：同一张桌子上，三个人拿着三份不同的信息。",
     f"{SH}/05-悄悄话消息-仅一人可见.png",
     "这条消息只有一个人看得到"),

    ("07 · 机制 ②", "悄悄话：入口在输入框左边",
     "点「私下说」，选一个人。说出的话只有他看得到。\n"
     "选定后按钮变红并显示对方名字，上方出现状态栏提醒你正在对谁低语。",
     "悄悄话原文不写日志，也不参与联网检索——否则会被搜成场外情报。",
     f"{SH}/07-悄悄话入口与人选.png",
     "入口与人选"),

    ("07 · 机制 ③", "点名对质：他自己把这句带上了台面",
     "被私下告知的人，往往会在下一轮把这句公开带出来，当众点名对方。\n"
     "被点名的人不知道情报从哪来，只能正面接。",
     "被点名者被要求不得用「我同意」开场——讨论从轮流发言变成有暗流的博弈。",
     f"{SH}/06-点名对质-当众摊牌.png",
     "鲁迅当众点名乔布斯"),

    ("07 · 机制 ④⑤", "讨论真的在打太极时",
     "每一轮用字符 2-gram 重叠率估算这一轮说出了多少新东西。\n"
     "判定趋同，先强制每位发言者提一个反对意见；仍无新意，主持人亲自出面拆穿。",
     "这个数字不展示给用户看——只在他们真的开始互相附和时，变成一条系统按语。",
     f"{SH}/03-主持人收尾-拆穿伪共识.png",
     "系统按语 + 主持人收尾"),
]

for kicker, title, body, quote, img, cap in MECH_SLIDES:
    s = new_slide()
    head(s, kicker, title, 33)
    tb(s, ML, BODY_Y + 0.08, 5.12, 2.2, body, 14, False, INK_SOFT, line=1.95)
    rect(s, ML, BODY_Y + 2.58, 0.055, 1.05, RED)
    tb(s, ML + 0.24, BODY_Y + 2.64, 4.85, 1.0, quote, 12.5, False, INK, line=1.7)

    path = os.path.join(HERE, img)
    iw, ih = Image.open(path).size
    maxw, maxh = 5.75, 4.20
    w_ = min(maxw, maxh * iw / ih)
    h_ = w_ * ih / iw
    px = ML + CW - w_  # 右对齐到内容右边界
    py = BODY_Y + 0.02 + (maxh - h_) / 2
    pic(s, img, px, py, w=w_)
    tb(s, px, py + h_ + 0.10, w_, 0.26, cap, 9.5, False, INK_FAINT)
    foot(s)

# ============================================================
# 09 效果对照
# ============================================================
s = new_slide()
head(s, "08 · 效果", "同一桌人，同一议题")
tb(s, ML, BODY_Y + 0.06, 5.2, 0.30, "v1 · 没有信息层", 13, True, INK_FAINT, spacing=2)
hair(s, ML, BODY_Y + 0.44, 5.2)
tb(s, ML, BODY_Y + 0.62, 5.2, 2.9,
   "鲁迅：学外语的意义，绝不仅仅在于翻译与写作……\n\n"
   "乔布斯：我同意鲁迅的观点。\n\n"
   "→ 两个立场最互斥的人，第一轮就合流。",
   13.5, False, INK_SOFT, line=1.85)

rect(s, ML + 5.55, BODY_Y + 0.05, 0.012, 4.05, LINE)

XR = ML + 5.95
tb(s, XR, BODY_Y + 0.06, 5.2, 0.30, "v2 · 有信息层", 13, True, RED, spacing=2)
hair(s, XR, BODY_Y + 0.44, 5.2, RED, 2)
tb(s, XR, BODY_Y + 0.62, 5.2, 2.9,
   "鲁迅（收到悄悄话）：乔布斯那套「追随内心」，我怀疑是幸存者偏差——\n\n"
   "乔布斯（被点名）：你说得对，我不是一个人做成的。\n\n"
   "→ 桌上有人揣着话，有人被点了名。",
   13.5, False, INK, line=1.85)

tb(s, ML, 6.22, CW, 0.30,
   "差别不在人格写得多像，在于这几个人掌握的信息不再相同。", 12.5, False, INK_FAINT)
foot(s)

# ============================================================
# 10 技术架构（原生绘制，不用截图）
# ============================================================
s = new_slide()
head(s, "09 · 架构", "可见性在服务端收口，前端拿不到")

LAYERS = [
    ("客户端", ["浏览器 Web", "移动端 Web"]),
    ("前端层", ["app/page.tsx", "Next.js App Router · SSE 流式"]),
    ("接口层", ["POST /api/chat", "GET /api/characters", "POST /api/import-skill"]),
    ("核心层", ["圆桌调度器  →  可见性过滤器  →  模型调用  →  输出装配"]),
    ("模型层", ["智谱 GLM-4-Flash（默认）", "BYOK · 任意 OpenAI 兼容接口"]),
    ("部署层", ["阿里云香港 · podman", "nginx 反代 · HTTPS"]),
]
LY = 2.02
ROW_H = 0.62
GAP = 0.16
for i, (label, items) in enumerate(LAYERS):
    y = LY + i * (ROW_H + GAP)
    core = (label == "核心层")
    tb(s, ML, y + 0.14, 1.05, 0.30, label, 11, True,
       RED if core else INK_FAINT, spacing=1.6)
    # 该层的内容区
    x = ML + 1.18
    wtotal = CW - 1.18
    n = len(items)
    if n == 1:
        rect(s, x, y, wtotal, ROW_H, CARD, RED if core else LINE)
        tb(s, x + 0.16, y + 0.15, wtotal - 0.3, 0.32, items[0], 12.5, core,
           RED if core else INK, spacing=0.4)
    else:
        iw = (wtotal - 0.14 * (n - 1)) / n
        for j, it in enumerate(items):
            ix = x + j * (iw + 0.14)
            rect(s, ix, y, iw, ROW_H, CARD, LINE)
            tb(s, ix + 0.14, y + 0.15, iw - 0.26, 0.32, it, 12, False, INK, spacing=0.3)

tb(s, ML, 6.72, CW, 0.30,
   "每条发言带「public / 仅某人可见」标记；组装 prompt 之前按可见性裁剪历史，消息不会进入不可见者的上下文。",
   11, False, INK_FAINT)
foot(s)

# ============================================================
# 11 诚实的边界
# ============================================================
s = new_slide()
head(s, "10 · 边界", "现在还不好用的地方")
tb(s, ML, BODY_Y + 0.02, 10.6, 0.34,
   "这些不打算藏——评委自己发现，反而更难看。", 13, False, INK_SOFT)

LIMITS = [
    ("新颖度是个近似",
     "用字符 2-gram 重叠率估算「说了多少新东西」。它不理解语义：\n用新词讲旧观点会被判成新的，反过来也会误判。便宜、即时，但不准。"),
    ("主持人收尾看模型脸色",
     "第五个机制完全靠提示词约束模型。模型状态不好时，收尾会退化成\n一次平庸的总结，而不是拆穿。"),
    ("悄悄话一次只能对一个人",
     "同时告知多人、形成临时小圈子，还没做。这是下一步最想要的能力。"),
]
yy = 2.98
for i, (t, d) in enumerate(LIMITS):
    tb(s, ML, yy, 0.42, 0.30, f"0{i+1}", 12, True, RED)
    tb(s, ML + 0.52, yy - 0.02, 3.0, 0.32, t, 15, True, INK, font=SERIF, spacing=0.6)
    tb(s, ML + 3.75, yy - 0.02, 7.6, 0.78, d, 12.5, False, INK_SOFT, line=1.65)
    yy += 1.16

hair(s, ML, 6.52, CW)
tb(s, ML, 6.64, CW, 0.30, "《测试说明》里逐条记录了这些边界，连同触发条件。",
   10.5, False, INK_FAINT)
foot(s)

# ============================================================
# 12 收尾
# ============================================================
s = new_slide()
rect(s, 0, 0, W, 0.10, RED)
tb(s, ML, 1.20, 4.0, 0.28, "在线体验", 11.5, True, RED, spacing=3)
tb(s, ML, 1.72, 7.6, 0.90, "outgate.chat", 58, True, INK, spacing=1)
hair(s, ML, 2.95, 3.2, RED, 3)
tb(s, ML, 3.28, 7.0, 1.2,
   "现在就可以打开。免费、无需注册，手机上也能用。\n选择一个议题，请两三位入席，然后私下对其中一个人说点什么。",
   15, False, INK_SOFT, line=1.85)

qr = "/tmp/qr_clean.png"
if os.path.exists(qr):
    s.shapes.add_picture(qr, Inches(9.85), Inches(1.55), Inches(2.35), Inches(2.35))
    tb(s, 9.85, 4.02, 2.35, 0.26, "扫码直接进", 10, False, INK_FAINT, align=PP_ALIGN.CENTER)

tb(s, ML, 5.35, 7.4, 1.1,
   "冯思涵 · 张耀羽　哈尔滨金融学院\n指导教师：胡芳驰 · 霍镜宇　　作品编号：375993",
   12, False, INK_SOFT, line=1.9)
foot(s)

# ============================================================
out = os.path.join(HERE, "答辩PPT.pptx")
prs.save(out)
print("已生成:", out, "| 页数:", len(prs.slides._sldIdLst))
