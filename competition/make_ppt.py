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
HEAD_RULE_Y = 1.62
BODY_Y = 1.95
FOOT_Y = 7.02

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]
_page = {"n": 0}
_pending_transitions = []
USE_TRANSITIONS = False   # 淡入看久了像在等它，作者说影响浏览；改成硬切


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
    _pending_transitions.append(s)
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


def head(slide, title, conclusion, tsize=28):
    """版头（指导老师三轮意见收敛后的样子）：
    · 不带阿拉伯数字序号
    · 前面这行带中文数字（一、/二、…）的，是主标题——放大、黑色
    · 红字是这一页的结论，缩小作导语，放在主标题下面"""
    hair(slide, ML, HEAD_RULE_Y, CW)
    rect(slide, ML, 0.38, 0.075, 0.54, RED)
    if _HAVE_DISPLAY:
        display(slide, ML + 0.30, 0.36, title, tsize, color=INK, max_w=CW - 0.42)
    else:
        tb(slide, ML + 0.30, 0.38, CW - 0.42, 0.56, title, tsize, True, INK,
           font=SERIF, spacing=1.0, line=1.0)
    tb(slide, ML + 0.32, 1.12, CW - 0.42, 0.26, conclusion, 13, True, RED, spacing=0.8)


def foot(slide):
    tb(slide, ML, FOOT_Y, 6.0, 0.26, "门外谈 · 作品编号 375993 · https://outgate.chat",
       9.5, False, INK_FAINT)
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

_SHOT_CROPS = {
    "04-圆桌辩论-公开交锋.png":   (330, 296, 1224, 727),
    "05-悄悄话消息-仅一人可见.png": (340, 92, 1222, 530),
    "06-点名对质-当众摊牌.png":   (340, 92, 1222, 620),
    "03-主持人收尾-拆穿伪共识.png": (338, 56, 1222, 532),
    "02-人物志.png":              (330, 165, 1230, 727),
}


def shot(relpath):
    """整页截图缩到幻灯片上字只有 4px，必须裁到关键区域。"""
    import tempfile
    name = os.path.basename(relpath)
    box = _SHOT_CROPS.get(name)
    if not box:
        return relpath
    src = os.path.join(HERE, relpath)
    out = os.path.join(tempfile.gettempdir(), "v4shot_" + name)
    im = Image.open(src).convert("RGB")
    x0, y0, x1, y1 = box
    im.crop((max(0, x0), max(0, y0), min(im.width, x1),
             min(im.height, y1))).save(out)
    return out

# ============================================================
# 01 封面
# ============================================================
s = new_slide()
tb(s, 6.55, 0.72, 6.4, 6.0, "辩", 250, True, GHOST, font=SERIF,
   align=PP_ALIGN.CENTER, line=1.0)
rect(s, 0, 0, W, 0.10, RED)
tb(s, ML, 0.86, 9.4, 0.28,
   "2026 年第十四届全国大学生数字媒体科技作品及创意竞赛", 11.5, True, RED, spacing=1.6)
if _HAVE_DISPLAY:
    display(s, ML, 1.40, "门外谈", 100, spacing=0.10)
else:
    tb(s, ML, 1.40, 6.6, 1.47, "门外谈", 100, True, INK, font=SERIF, spacing=6, line=1.0)
tb(s, ML, 3.06, 6.9, 0.40,
   "——基于信息不对称机制的多智能体圆桌辩论系统", 17.5, False, INK_SOFT, spacing=0.4)
tb(s, ML, 3.58, 6.9, 0.30,
   "一个让多位思想者同桌交锋的思辨工具", 13, False, RED, spacing=0.8)
hair(s, ML, 4.04, 3.2, RED, 3)
# 官方《参赛作品材料提交规范》：不得在封面、页眉页脚或正文中展示
# 参赛学校、团队成员、指导教师等身份信息。此处只保留作品编号与分类。
META = [
    ("作品编号", "375993"),
    ("参赛分类", "自主选题类 · 移动与网络应用开发类赛项"),
    ("作品形态", "Web 应用 · 桌面端与移动端浏览器"),
    ("在线地址", "https://outgate.chat"),
]
yy = 4.34
for k, v in META:
    tb(s, ML, yy, 1.15, 0.26, k, 10.5, False, INK_FAINT, spacing=1.2)
    tb(s, ML + 1.25, yy - 0.01, 6.4, 0.28, v, 11.5, False, INK, spacing=0.3)
    yy += 0.40

# ============================================================
# 02 目录
# ============================================================
s = new_slide()
rect(s, 0, 0, W, 0.10, RED)
if _HAVE_DISPLAY:
    display(s, ML, 1.55, "目录", 78, spacing=0.08)
else:
    tb(s, ML, 1.60, 4.0, 1.15, "目录", 78, True, INK, font=SERIF, spacing=8, line=1.0)
tb(s, ML, 3.02, 4.0, 0.28, "CONTENT", 13, True, RED, spacing=5)
hair(s, ML, 3.50, 2.6, LINE)

TOC = [
    ("一", "选题背景", "为什么做这个"),
    ("二", "作品设计", "它由什么构成"),
    ("三", "系统实现", "怎么落地"),
    ("四", "验证与效果", "改前改后差在哪"),
    ("五", "创新与应用", "新在哪、给谁用"),
    ("六", "在线体验", "现在就能打开"),
]
TX = 6.35
TW = ML + CW - TX
for i, (no, name, desc) in enumerate(TOC):
    y = 1.62 + i * 0.86
    tb(s, TX, y, 0.55, 0.28, no, 11.5, True, RED, spacing=1.4)
    tb(s, TX + 0.62, y - 0.10, 2.5, 0.40, name, 19, True, INK, font=SERIF, spacing=1.2)
    tb(s, TX + 3.30, y + 0.04, TW - 3.3, 0.28, desc, 11, False, INK_FAINT)
    hair(s, TX, y + 0.56, TW, LINE)
foot(s)

# ============================================================
# 03 一、选题背景｜多人一起讨论，为什么总是聊不出东西
# ============================================================
s = new_slide()
head(s, "一、选题背景 · 一次小组讨论通常怎么结束", "讨论往往没有产生分歧")

tb(s, ML, BODY_Y + 0.06, 5.30, 1.5,
   "一次小组讨论，通常是这样结束的：\n"
   "说得最大声的那个人定了调，其余的人点头；\n"
   "真正不同意的那个，从头到尾没开口。",
   14.5, False, INK_SOFT, line=2.0)

tb(s, ML, 3.56, 5.30, 1.2,
   "真正被讨论的，往往是最容易达成一致的那部分。\n"
   "分歧最大的地方，从第一分钟起就被绕开了。",
   13.5, False, INK_SOFT, line=1.95)

rect(s, ML, 4.92, 0.055, 0.46, RED)
tb(s, ML + 0.26, 4.96, 5.1, 0.42, "于是问题被绕过去了。", 14, True, RED, spacing=0.8)

PROBS = [
    ("抢话", "谁先开口，谁就定了调子"),
    ("重复", "三个人说的是同一件事"),
    ("沉默", "最该说话的人不开口"),
]
XR = 6.55
for i, (k, v) in enumerate(PROBS):
    y = BODY_Y + 0.10 + i * 1.22
    tb(s, XR, y, 0.36, 0.28, f"0{i+1}", 11, True, RED)
    tb(s, XR + 0.48, y - 0.06, 1.4, 0.34, k, 17, True, INK, font=SERIF, spacing=2)
    tb(s, XR + 2.05, y, 3.74, 0.30, v, 12, False, INK_SOFT)
    if i < 2:
        hair(s, XR, y + 0.86, 4.9, LINE)

tb(s, ML, 6.30, CW, 0.34,
   "讨论不是没进行，是没有产生分歧——而分歧恰恰是讨论唯一有价值的东西。",
   13, False, INK, line=1.6)
foot(s)

# ============================================================
# 05 一、选题背景｜概念：一张给思想者摆的桌子
# ============================================================
s = new_slide()
head(s, "一、选题背景 · 作品概念", "门外谈是一张有信息差的桌子")

tb(s, ML, BODY_Y + 0.06, 5.20, 2.6,
   "既然讨论的价值在于分歧，那就先把分歧摆上桌。\n\n"
   "门外谈是一个网站，也是一张桌子：\n"
   "你把一个问题摆在桌上，请几位思想者入席，\n"
   "看他们当场各执一词。\n\n"
   "他们看得见彼此说过的话，也可以被单独告知\n一些别人不知道的事。",
   13.5, False, INK_SOFT, line=1.9)

# 右侧三层结构示意图：共边堆叠，读成「层」而不是三个盒子
LX, LW = 6.55, 4.90
LY = BODY_Y + 0.06
ROW = 1.14
LAYERS = [
    ("信息层", "谁被谁看见了　·　本届新增", True),
    ("圆桌层", "多位思想者轮流发言，后说的人看得到前文", False),
    ("人格层", "34 位蒸馏人格，各自带着自己的立场", False),
]
for i, (name, desc, hot) in enumerate(LAYERS):
    y = LY + i * ROW
    rect(s, LX, y, LW, ROW, CARD, RED if hot else LINE)
    tb(s, LX + 0.26, y + 0.18, 1.6, 0.34, name, 16, True,
       RED if hot else INK, font=SERIF, spacing=1.6)
    tb(s, LX + 0.26, y + 0.66, LW - 0.48, 0.30, desc, 10.5,
       False, RED if hot else INK_SOFT)
tb(s, LX, LY + 3 * ROW + 0.16, LW, 0.30,
   "红色这一层，是本届新做的部分。", 10, False, INK_FAINT)

# 左下角补一句总结，填掉左侧的空白
rect(s, ML, 5.28, 0.055, 1.10, RED)
tb(s, ML + 0.28, 5.32, 5.0, 1.05,
   "人格决定他们想什么，\n圆桌决定他们怎么说话，\n信息层决定他们会不会吵起来。",
   13.5, True, INK, line=1.8)
foot(s)


# ============================================================
# 06 二、作品设计｜人物介绍（一）为什么这些角色像真人
# ============================================================
s = new_slide()
head(s, "二、作品设计 · 人物介绍之一", "人设有立场，才谈得上反驳")

tb(s, ML, BODY_Y + 0.04, 5.30, 1.15,
   "一般做法是给模型一句人设：「你是鲁迅，说话犀利」。\n"
   "模型于是变得犀利——但那是你要的犀利，不是鲁迅的。\n\n"
   "蒸馏人格是另一回事：把一个人拆成可执行的几节。",
   12.5, False, INK_SOFT, line=1.85)

PARTS = [
    ("核心身份", "他是谁。第一人称发言，明确不是替你写作的工具"),
    ("思想根基", "在什么问题上必然持什么立场"),
    ("语言特征", "句式、修辞、结构、意象，逐条写成约束"),
    ("语录库", "收他的原话，用来校准语气"),
]
yy = 3.92
for i, (k, v) in enumerate(PARTS):
    tb(s, ML, yy, 0.34, 0.28, f"0{i+1}", 10.5, True, RED)
    tb(s, ML + 0.44, yy - 0.02, 1.05, 0.30, k, 12, True, INK, font=SERIF, spacing=0.4)
    tb(s, ML + 1.58, yy - 0.02, 3.75, 0.62, v, 10.5, False, INK_SOFT, line=1.6)
    yy += 0.60

rect(s, ML, 6.34, 0.055, 0.40, RED)
tb(s, ML + 0.24, 6.38, 5.2, 0.36,
   "所以他不顺着你说话——因为他本来就有立场。", 12, True, INK, line=1.5)

# WPS 的行高比 LibreOffice 大约 10%，这里必须留足余量：
# 字号降到 9.5、行距 1.42，并去掉两处空行，卡片高度不变。
XR = 6.85
rect(s, XR, BODY_Y + 0.02, 5.55, 4.22, CARD, LINE)
tb(s, XR + 0.30, BODY_Y + 0.26, 4.95, 3.55,
   "---\nname: luxun\n---\n\n"
   "# 鲁迅 · 人物志\n"
   "你就是鲁迅本人，不是任何人的视角替身，\n更不是写作工具。\n\n"
   "## 思想根基\n批判精神 · 国民性分析 · 文学救国\n\n"
   "## 写作风格指南\n语言特征 · 修辞技法 · 结构模式 · 意象体系",
   9.5, False, INK_SOFT, line=1.42)
tb(s, XR, BODY_Y + 4.36, 5.55, 0.28,
   "鲁迅那份 SKILL.md 的真实开头 · 站内 34 份、合计约 40 万字节", 9.5, False, INK_FAINT)
foot(s)

# ============================================================
# 07 二、作品设计｜人物介绍（二）34 位从哪来
# ============================================================
s = new_slide()
head(s, "二、作品设计 · 人物介绍之二", "34 位人物，来自开源社区")

NAMES = "鲁迅 哈耶克 凯恩斯 柏拉图 孔子 马克思 乔布斯 马斯克 尼采 福柯 苏格拉底 维特根斯坦 爱因斯坦 图灵 黄仁勋 巴菲特 达利欧 波伏娃 亚里士多德 亚当·斯密 康德 达尔文 罗素 奥威尔 加缪 马丁·路德·金 福尔摩斯 梵高 薛定谔 丘吉尔 爱丽丝 牛顿 叔本华 莎士比亚".split()

tb(s, ML, BODY_Y + 0.04, 4.20, 3.4,
   "桌上的人物不是我们凭空造的。\n\n"
   "它们原本散落在开源社区的不同仓库里：格式统一为 SKILL.md，"
   "但体例、文案、可用程度各不相同。\n\n"
   "本作品做的是把它们汇总、筛选、补齐、接入——"
   "统一中英文名与首字标记，标注每一份的上游仓库，"
   "并逐位调校到能在同一张桌上说话不跑题。\n\n"
   "站内没有的人物，用户可以在「创意工坊」粘贴仓库地址实时导入。",
   11.5, False, INK_SOFT, line=1.8)

XR, YR = 5.55, BODY_Y - 0.02
tb(s, XR, YR, 6.9, 0.26,
   f"站内人物 {len(NAMES)} 位（3 位内置 + {len(NAMES)-3} 位开源社区导入）",
   10, False, INK_FAINT, spacing=0.4)
hair(s, XR, YR + 0.32, 6.88, LINE)
cols = 5
cwid = 6.88 / cols
for i, nm in enumerate(NAMES):
    r, c = divmod(i, cols)
    tb(s, XR + c * cwid, YR + 0.46 + r * 0.42, cwid - 0.06, 0.30, nm,
       10.5, False, INK if i < 3 else INK_SOFT, line=1.2)
tb(s, XR, YR + 0.46 + 7 * 0.42 + 0.06, 6.9, 0.26,
   "深色为内置，浅色为开源社区导入。", 9.5, False, INK_FAINT)
foot(s)

# ============================================================
# 08 二、作品设计｜圆桌：让发言有次序
# ============================================================
s = new_slide()
head(s, "二、作品设计 · 圆桌机制", "有次序，才有一句一句的交锋")

RULE = [
    ("轮流发言", "每位依次开口，后说的人能看到前面说了什么"),
    ("座次可调", "拖动卡片调整发言顺序，手机上长按拖"),
    ("人数定形式", "1 位＝单人对谈，2 位以上＝圆桌辩论"),
    ("火候三档", "随口 / 较真 / 上头，控制回答长短，气氛上来自动升级"),
]
for i, (k, v) in enumerate(RULE):
    y = BODY_Y + 0.10 + i * 0.98
    tb(s, ML, y, 0.36, 0.28, f"0{i+1}", 10.5, True, RED)
    tb(s, ML + 0.46, y - 0.04, 1.5, 0.32, k, 14, True, INK, font=SERIF, spacing=1.0)
    tb(s, ML + 2.10, y, 3.45, 0.62, v, 10.5, False, INK_SOFT, line=1.6)

rect(s, ML, 6.06, 0.055, 0.50, RED)
tb(s, ML + 0.26, 6.10, 5.4, 0.44,
   "次序解决的是「谁能说」，还没解决「为什么吵」。", 12.5, True, INK, line=1.5)

img = shot(f"{SH}/04-圆桌辩论-公开交锋.png")
iw, ih = Image.open(os.path.join(HERE, img)).size
w_ = 5.90
pic(s, img, ML + CW - w_, BODY_Y + 0.06, w=w_)
tb(s, ML + CW - w_, BODY_Y + 0.06 + w_ * ih / iw + 0.10, w_, 0.26,
   "真实圆桌对话 · 三位已入席", 9.5, False, INK_FAINT)
foot(s)

# ============================================================
# 09–12 二、作品设计｜信息层三页 + 打太极
# ============================================================
MECH = [
    ("06", "二、作品设计 · 信息层之一", "每个人的历史可以不一样",
     "每条发言带一个可见性标记（public 或某个人）。\n"
     "生成每位发言者的回复时，只投喂他有权读到的那部分历史——\n"
     "不是前端隐藏，是根本没有进入他的上下文。",
     "结果：同一张桌子上，三个人拿着三份不同的信息。",
     f"{SH}/05-悄悄话消息-仅一人可见.png", "这条消息只有一个人看得到"),

    ("07", "二、作品设计 · 信息层之二", "一句话，只让他一个人听见",
     "点「私下说」，选一个人。说出的话只有他看得到。\n"
     "选定后按钮变红并显示对方名字，上方出现状态栏提醒你正在对谁低语。",
     "悄悄话原文不写日志，也不参与联网检索——否则会被搜成场外情报。",
     f"{SH}/07-悄悄话入口与人选.png", "点开「私下说」→ 选人 → 按钮变红"),

    ("08", "二、作品设计 · 信息层之三", "被私下告知的人当众摊牌",
     "被私下告知的人，往往会在下一轮把这句公开带出来，当众点名对方。\n"
     "被点名的人不知道情报从哪来，只能正面接。",
     "被点名者被要求不得用「我同意」开场——讨论从轮流发言变成有暗流的博弈。",
     f"{SH}/06-点名对质-当众摊牌.png", "鲁迅当众点名乔布斯"),

    ("09", "二、作品设计 · 机制兜底", "打太极时，系统强制换角度",
     "每一轮用字符 2-gram 重叠率估算这一轮说出了多少新东西。\n"
     "判定趋同，先强制每位发言者提一个反对意见；仍无新意，主持人亲自出面拆穿。",
     "这个数字不展示给用户看——只在他们真的开始互相附和时，变成一条系统按语。",
     f"{SH}/03-主持人收尾-拆穿伪共识.png", "系统按语 + 主持人收尾"),
]
for _no, section, concl, body, quote, img, cap in MECH:
    s = new_slide()
    head(s, section, concl)
    tb(s, ML, BODY_Y + 0.06, 5.12, 2.2, body, 13, False, INK_SOFT, line=1.95)
    rect(s, ML, BODY_Y + 2.40, 0.055, 1.05, RED)
    tb(s, ML + 0.24, BODY_Y + 2.46, 4.85, 1.0, quote, 12, False, INK, line=1.7)
    img2 = shot(img)
    iw, ih = Image.open(os.path.join(HERE, img2)).size
    maxw, maxh = 5.75, 4.10
    w_ = min(maxw, maxh * iw / ih)
    h_ = w_ * ih / iw
    px = ML + CW - w_
    py = BODY_Y + 0.02 + (maxh - h_) / 2
    pic(s, img2, px, py, w=w_)
    tb(s, px, py + h_ + 0.10, w_, 0.26, cap, 9.5, False, INK_FAINT)
    foot(s)

# ============================================================
# 13 三、系统实现｜技术架构
# ============================================================
s = new_slide()
head(s, "三、系统实现 · 技术架构", "裁剪在服务端，前端拿不到")

LAYERS = [
    ("客户端", ["浏览器 Web", "移动端 Web"]),
    ("前端层", ["app/page.tsx", "Next.js App Router · SSE 流式"]),
    ("接口层", ["POST /api/chat", "GET /api/characters", "POST /api/import-skill"]),
    ("核心层", ["圆桌调度器  →  可见性过滤器  →  模型调用  →  输出装配"]),
    ("模型层", ["智谱 GLM-4-Flash（默认）", "BYOK · 任意 OpenAI 兼容接口"]),
    ("部署层", ["阿里云香港 · podman", "nginx 反代 · HTTPS"]),
]
LY, ROW_H, GAP = BODY_Y - 0.02, 0.60, 0.15
for i, (label, items) in enumerate(LAYERS):
    y = LY + i * (ROW_H + GAP)
    core = (label == "核心层")
    tb(s, ML, y + 0.14, 1.05, 0.30, label, 11, True, RED if core else INK_FAINT, spacing=1.6)
    x = ML + 1.18
    wtotal = CW - 1.18
    n = len(items)
    if n == 1:
        rect(s, x, y, wtotal, ROW_H, CARD, RED if core else LINE)
        tb(s, x + 0.16, y + 0.14, wtotal - 0.3, 0.32, items[0], 12, core,
           RED if core else INK, spacing=0.4)
    else:
        iw2 = (wtotal - 0.14 * (n - 1)) / n
        for j, it in enumerate(items):
            ix = x + j * (iw2 + 0.14)
            rect(s, ix, y, iw2, ROW_H, CARD, LINE)
            tb(s, ix + 0.14, y + 0.14, iw2 - 0.26, 0.32, it, 11.5, False, INK, spacing=0.3)
tb(s, ML, 6.62, CW, 0.30,
   "每条发言带「public / 仅某人可见」标记；组装 prompt 之前按可见性裁剪历史。",
   11, False, INK_FAINT)
foot(s)

# ============================================================
# 13b 三、系统实现｜稳定与隐私
# ============================================================
s = new_slide()
head(s, "三、系统实现 · 稳定与隐私", "稳定和数据安全，都在服务端兜住")

COLW2 = (CW - 0.70) / 2

# 左：稳定性
X1 = ML
tb(s, X1, BODY_Y + 0.04, COLW2, 0.30, "系统稳定性", 13, True, RED, spacing=1.6)
hair(s, X1, BODY_Y + 0.42, COLW2, RED, 2)
STAB = [
    ("进程托管", "容器交给 systemd 管理，异常退出自动重启，不用人工守着"),
    ("对外服务", "nginx 反代 + HTTPS，单端口映射，前端只走标准 80/443"),
    ("长连接", "回复走 SSE 流式推送，中途断了重新发送即可，不丢历史"),
]
yy = BODY_Y + 0.62
for i, (k, v) in enumerate(STAB):
    tb(s, X1, yy, 1.30, 0.28, k, 11.5, True, INK, spacing=1.0)
    tb(s, X1, yy + 0.32, COLW2 - 0.1, 0.60, v, 10.5, False, INK_SOFT, line=1.65)
    yy += 1.28

# 右：数据安全与隐私
X2 = ML + COLW2 + 0.70
tb(s, X2, BODY_Y + 0.04, COLW2, 0.30, "数据安全与隐私", 13, True, RED, spacing=1.6)
hair(s, X2, BODY_Y + 0.42, COLW2, RED, 2)
SEC = [
    ("不收集身份", "没有账号体系，不要姓名、手机号、邮箱——没有可泄漏的用户资料"),
    ("Key 不落库", "自带的 API Key 只存在浏览器本地，服务端仅用于当次调用，不写库不写日志"),
    ("悄悄话不进日志", "带悄悄话的消息在日志里被替换为 [whisper — content not logged]"),
]
yy = BODY_Y + 0.62
for i, (k, v) in enumerate(SEC):
    tb(s, X2, yy, 1.90, 0.28, k, 11.5, True, INK, spacing=1.0)
    tb(s, X2, yy + 0.32, COLW2 - 0.1, 0.60, v, 10.5, False, INK_SOFT, line=1.65)
    yy += 1.28

rect(s, ML, 6.42, 0.055, 0.36, RED)
tb(s, ML + 0.26, 6.46, CW - 0.3, 0.32,
   "可见性在服务端裁剪历史，不可见的内容根本不进 prompt；悄悄话也不参与联网检索（T2 / T6 / T7 实测）。",
   10.5, False, INK_SOFT, line=1.5)
foot(s)

# ============================================================
# 14 四、验证与效果｜v1 到 v2
# ============================================================
s = new_slide()
head(s, "四、验证与效果 · v1 与 v2 对照", "加了信息层，才吵得起来")

tb(s, ML, BODY_Y + 0.06, 5.2, 0.30, "v1 · 没有信息层", 12.5, True, INK_FAINT, spacing=2)
hair(s, ML, BODY_Y + 0.42, 5.2, LINE)
tb(s, ML, BODY_Y + 0.58, 5.2, 2.9,
   "鲁迅：学外语的意义，绝不仅仅在于翻译与写作……\n\n"
   "乔布斯：我同意鲁迅的观点。\n\n"
   "→ 两个立场最互斥的人，第一轮就合流。",
   12.5, False, INK_SOFT, line=1.85)

rect(s, ML + 5.55, BODY_Y + 0.05, 0.012, 3.90, LINE)

XR = ML + 5.95
tb(s, XR, BODY_Y + 0.06, 5.2, 0.30, "v2 · 有信息层", 12.5, True, RED, spacing=2)
hair(s, XR, BODY_Y + 0.42, 5.2, RED, 2)
tb(s, XR, BODY_Y + 0.58, 5.2, 2.9,
   "鲁迅（收到悄悄话）：乔布斯那套「追随内心」，我怀疑是幸存者偏差——\n\n"
   "乔布斯（被点名）：你说得对，我不是一个人做成的。\n\n"
   "→ 桌上有人揣着话，有人被点了名。",
   12.5, False, INK, line=1.85)

hair(s, ML, 5.62, CW, LINE)
tb(s, ML, 5.70, CW, 0.28,
   "差别不在人格写得多像，在于这几个人掌握的信息不再相同。", 12, True, INK)

TESTROW = [
    ("9", "项机制测试", "T1–T9 逐项实测，全部通过"),
    ("2", "处泄漏已修", "悄悄话串进检索、写入日志"),
    ("1", "个关键回归", "摊牌真的触发，不是摆样子"),
]
colw = CW / 3
for i, (num, name, desc) in enumerate(TESTROW):
    x = ML + i * colw
    tb(s, x, 6.24, 0.52, 0.40, num, 20, True, RED, font=SERIF, line=1.0)
    tb(s, x + 0.54, 6.28, colw - 0.62, 0.26, name, 11, True, INK, spacing=1.0)
    tb(s, x + 0.54, 6.56, colw - 0.62, 0.26, desc, 9.5, False, INK_FAINT)
foot(s)

# ============================================================
# 15 五、创新与应用｜三点创新
# ============================================================
s = new_slide()
head(s, "五、创新与应用 · 创新点", "三处改动，都在改谁知道什么")

INNO = [
    ("机制创新", "把「信息差」做成可操作的三步",
     "可见性 → 悄悄话 → 点名对质。\n"
     "不是让角色更凶，而是改变谁知道什么。"),
    ("交互创新", "用户从提问者变成信息分配者",
     "一次私下告知，就能改变整场讨论的走向。\n"
     "用户做的事情，从「问问题」变成「决定谁掌握什么」。"),
    ("工程创新", "信息裁剪在服务端完成",
     "按接收者裁剪上下文，不可见的内容根本不进 prompt；\n"
     "悄悄话不写日志、不参与联网检索。"),
]
for i, (tag, name, body) in enumerate(INNO):
    y = BODY_Y + 0.08 + i * 1.44
    rect(s, ML, y + 0.04, 0.055, 0.92, RED)
    tb(s, ML + 0.26, y, 1.1, 0.26, tag, 10.5, True, RED, spacing=1.6)
    tb(s, ML + 1.45, y - 0.05, 5.6, 0.36, name, 16, True, INK, font=SERIF, spacing=0.8)
    tb(s, ML + 1.45, y + 0.40, 9.6, 0.62, body, 11.5, False, INK_SOFT, line=1.7)

tb(s, ML, 6.44, CW, 0.32,
   "三点合起来回答一个问题：为什么这些角色能吵起来，而不是互相附和。", 12, False, INK_FAINT)
foot(s)

# ============================================================
# 16 五、创新与应用｜应用场景
# ============================================================
s = new_slide()
head(s, "五、创新与应用 · 应用场景", "一张可以反复练习的桌子")

SCENE = [
    ("课堂小组研讨", "发言有次序，观点有记录。\n老师能看见谁在什么时候改变了立场。"),
    ("英语辩论与口语训练", "立场由人格给定，不靠临场想。\n可以先私下「通气」，练接招。"),
    ("议题讨论与写作构思", "先把分歧摆出来，再决定自己站哪边。\n比一上来就找论据更接近真实思考。"),
]
cw2 = (CW - 0.50) / 3
for i, (name, body) in enumerate(SCENE):
    x = ML + i * (cw2 + 0.25)
    rect(s, x, BODY_Y + 0.10, cw2, 2.02, CARD, LINE)
    tb(s, x + 0.26, BODY_Y + 0.34, 0.36, 0.26, f"0{i+1}", 10.5, True, RED)
    tb(s, x + 0.26, BODY_Y + 0.66, cw2 - 0.5, 0.62, name, 15, True, INK, font=SERIF, line=1.5)
    tb(s, x + 0.26, BODY_Y + 1.40, cw2 - 0.5, 0.90, body, 10.5, False, INK_SOFT, line=1.7)

rect(s, ML, 4.78, 0.055, 1.02, RED)
tb(s, ML + 0.26, 4.82, CW - 0.3, 0.96,
   "为什么这些场景成立：门外谈不是一个聊天玩具，是一张有规则的桌子。\n"
   "规则固定下来，才能反复练习；反复练习，才谈得上训练。",
   13, False, INK, line=1.8)
foot(s)

# ============================================================
# 17 六、在线体验｜扫码体验 · 感谢聆听
# ============================================================
s = new_slide()
rect(s, 0, 0, W, 0.10, RED)
tb(s, ML, 1.10, 4.0, 0.26, "六、在线体验", 10, False, INK_SOFT, spacing=1.2)
if _HAVE_DISPLAY:
    display(s, ML, 1.55, "现在就能打开。", 62, spacing=0.06, max_w=8.4)
else:
    tb(s, ML, 1.65, 8.0, 0.95, "现在就能打开。", 58, True, INK, font=SERIF, spacing=2)
hair(s, ML, 3.10, 3.2, RED, 3)
tb(s, ML, 3.42, 7.4, 1.2,
   "outgate.chat　免费、无需注册，手机上也能用。\n"
   "选择一个议题，请两三位入席，然后私下对其中一个人说点什么。",
   14, False, INK_SOFT, line=1.85)

qr = "/tmp/qr_clean.png"
if os.path.exists(qr):
    s.shapes.add_picture(qr, Inches(10.10), Inches(1.45), Inches(2.10), Inches(2.10))
    tb(s, 10.10, 3.66, 2.10, 0.26, "扫码直接进", 10, False, INK_FAINT, align=PP_ALIGN.CENTER)

tb(s, ML, 5.35, 7.4, 0.8,
   "作品编号：375993　　参赛分类：移动与网络应用开发类赛项",
   12, False, INK_SOFT, line=1.9)
if _HAVE_DISPLAY:
    display(s, ML, 6.42, "感谢聆听", 30, spacing=0.10)
else:
    tb(s, ML, 6.46, 4.0, 0.42, "感谢聆听", 30, True, INK, font=SERIF, spacing=4)
foot(s)

# ============================================================
out = os.path.join(HERE, "答辩PPT.pptx")
prs.save(out)
print("已生成:", out, "| 页数:", len(prs.slides._sldIdLst))
