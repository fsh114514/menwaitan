#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成参赛答辩 PPT。
用法： <python> make_ppt.py
输出： 答辩PPT.pptx（与本脚本同目录）

注意：不要对 slide.shapes._spTree 做 remove/insert 重排——那会把形状树弄坏，
      LibreOffice 渲染出来是全空白（踩过一次）。背景矩形只要第一个添加即可。
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

HERE = os.path.dirname(os.path.abspath(__file__))

INK = RGBColor(0x17, 0x12, 0x0D)
INK_SOFT = RGBColor(0x5A, 0x51, 0x47)
RED = RGBColor(0xA3, 0x27, 0x2C)
PAPER = RGBColor(0xF4, 0xEF, 0xE3)
CARD = RGBColor(0xF9, 0xF5, 0xEA)
LINE = RGBColor(0xD8, 0xD0, 0xC0)
BLUE = RGBColor(0x2F, 0x6F, 0xEB)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def bg(slide, color=PAPER):
    """铺底：必须是本页第一个添加的形状（先加=在最底层），不要重排 spTree。"""
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()
    s.shadow.inherit = False
    return s


def tb(slide, x, y, w, h, text, size=18, bold=False, color=INK,
       align=PP_ALIGN.LEFT, font="PingFang SC", line=None):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, ln in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if line:
            p.line_spacing = line
        r = p.add_run()
        r.text = ln
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        r.font.name = font
    return box


def bar(slide, x, y, w, h, color=RED):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()
    s.shadow.inherit = False
    return s


def head(slide, kicker, title):
    bar(slide, 0.6, 0.55, 0.09, 0.62, RED)
    tb(slide, 0.85, 0.5, 11.5, 0.34, kicker, 12, True, RED)
    tb(slide, 0.85, 0.8, 11.9, 0.62, title, 29, True, INK)


def pic(slide, relpath, x, y, w=None, h=None):
    from PIL import Image
    path = os.path.join(HERE, relpath)
    iw, ih = Image.open(path).size
    if w and not h:
        h = w * ih / iw
    if h and not w:
        w = h * iw / ih
    return slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))


# ============ 1 封面 ============
s = prs.slides.add_slide(BLANK); bg(s)
bar(s, 0, 0, 13.333, 0.16, RED)
tb(s, 1.0, 1.5, 11.3, 0.4, "2026 年第十四届全国大学生数字媒体科技作品及创意竞赛", 15, True, RED)
tb(s, 1.0, 2.05, 11.3, 1.0, "门外谈", 62, True, INK)
tb(s, 1.0, 3.15, 11.3, 0.6, "——基于信息不对称机制的多智能体圆桌辩论系统", 25, True, INK_SOFT)
bar(s, 1.0, 4.0, 2.4, 0.045, RED)
tb(s, 1.0, 4.3, 6.4, 1.9,
   "自主选题类 · 移动与网络应用开发类赛项\n团队负责人：冯思涵（哈尔滨金融学院 · 商务英语）\n"
   "指导教师：胡芳驰、霍镜宇\n作品网址：outgate.chat", 15, False, INK_SOFT, line=1.6)
tb(s, 8.2, 4.3, 4.3, 1.9,
   "一句话\n给 AI 圆桌加一层「谁知道什么」——\n让讨论从轮流发言，变成有暗流的博弈。", 15, True, RED, line=1.6)

# ============ 2 问题 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "01 · 问题", "AI 圆桌为什么总是「和和气气」？")
tb(s, 0.85, 1.8, 5.6, 4.6,
   "现在几乎所有 AI 圆桌 / 多智能体产品，\n都是「全员共享同一份上下文」。\n\n"
   "后果是一个已知的病症：\n所有 agent 都知道别人说了什么，\n于是迅速趋同，产生伪共识。\n\n"
   "看起来在辩论，实际在互相附和。", 17, False, INK_SOFT, line=1.75)
bar(s, 6.9, 1.8, 0.035, 4.6, LINE)
tb(s, 7.3, 1.8, 5.3, 0.5, "实测：加了「别和稀泥」也没用", 15, True, RED)
tb(s, 7.3, 2.45, 5.3, 4.0,
   "用户在公开提问里明确写了\n「请直接给答案，别和稀泥」——\n\n"
   "鲁迅：学外语的意义，绝不仅仅在于翻译与写作……\n\n"
   "乔布斯：我同意鲁迅的观点。\n\n"
   "→ 两个立场最互斥的人，第一轮就合流了。", 15, False, INK, line=1.6)

# ============ 3 核心创新 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "02 · 核心创新", "加的不是功能，是一层结构")
tb(s, 0.85, 1.8, 5.5, 4.6,
   "v1：所有人共享同一份上下文\n　→ 每个人的「所知」完全相同\n　→ 讨论必然走向趋同\n\n"
   "v2：给圆桌加一层「信息层」\n　→ 每条发言可以只让某个人看到\n　→ 每个人看到的上下文不再相同\n\n"
   "「谁知道什么」本身成了设计对象。", 17, False, INK_SOFT, line=1.7)
bar(s, 6.9, 1.8, 5.75, 4.6, CARD)
tb(s, 7.2, 1.98, 5.2, 0.4, "五个机制", 16, True, RED)
tb(s, 7.2, 2.46, 5.2, 3.9,
   "① 可见性　发言带 public / 仅某人可见标签，\n　　　　　进 prompt 之前按可见集合裁剪\n"
   "② 悄悄话　用户可以私下对某一位人物说话\n"
   "③ 点名对质　收到悄悄话的人会当众点名对方\n"
   "④ 信息新颖度　字符 2-gram 不重叠率，\n　　　　　判定讨论是否在空转\n"
   "⑤ 主持人收尾　仍无新信息时，由「门外谈」\n　　　　　出面拆穿这场伪共识", 14.5, False, INK, line=1.5)

# ============ 4 机制 12 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "03 · 机制", "① 可见性　　② 悄悄话")
pic(s, "screenshots/07-悄悄话入口与人选.png", 0.7, 1.62, w=6.0)
tb(s, 0.7, 5.5, 6.0, 1.4,
   "入口在输入框左侧（不在卡片角落）：点「私下说」→ 选人 → 按钮变红显示名字，\n上方出现「正在私下对 鲁迅 说话 —— 桌上其他人看不到」。",
   12.5, False, INK_SOFT, line=1.45)
pic(s, "screenshots/05-悄悄话消息-仅一人可见.png", 7.0, 1.62, w=6.0)
tb(s, 7.0, 5.5, 6.0, 1.4,
   "这条消息在对话流里带锁标记：\n「私下说的 — 只有 鲁迅 看得到」；服务端真过滤，不是前端隐藏。",
   12.5, False, INK_SOFT, line=1.45)

# ============ 5 机制 34 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "04 · 机制", "③ 点名对质　④ 新颖度　⑤ 主持人收尾")
pic(s, "screenshots/06-点名对质-当众摊牌.png", 0.7, 1.62, w=6.0)
tb(s, 0.7, 5.5, 6.0, 1.4,
   "唯一收到悄悄话的鲁迅，当众点名乔布斯：\n「乔布斯曾言…那么我问他：改变世界之前，你改变过多少人替你抬轿子？」",
   12.5, False, INK_SOFT, line=1.45)
bar(s, 7.0, 1.62, 6.0, 2.55, CARD)
tb(s, 7.3, 1.85, 5.4, 2.2,
   "④ 信息新颖度（信息熵判据）\n\n把发言切成字符 2-gram，与此前全部内容比较\n"
   "不重叠率 → 全是旧话接近 0，全是新东西接近 1\n纯本地计算，零额外模型调用\n"
   "低于 0.34 → 判定趋同 → 强制提出反对意见", 13, False, INK, line=1.5)
tb(s, 7.0, 4.42, 6.0, 2.5,
   "⑤ 主持人收尾\n\n判定趋同后先让发言者自己试一轮（强制提反对意见）；\n"
   "仍然空转，就由「门外谈」本人出面收尾——\n"
   "「刚才这一轮等于什么都没谈成。你们只是重复了\n"
   "学习外语的好处，而没有指出真正的问题。」\n\n"
   "为什么用「新颖度」而不是「聊够了」：「聊够了」\n"
   "无法量化，「新信息不再产生」是可以计算的客观事实。",
   12, False, INK_SOFT, line=1.45)

# ============ 6 效果对比 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "05 · 效果", "同一桌人，同一议题，差别在哪")
bar(s, 0.7, 1.8, 5.95, 4.5, CARD)
tb(s, 1.0, 2.05, 5.4, 0.45, "加信息层之前", 17, True, INK_SOFT)
tb(s, 1.0, 2.7, 5.4, 3.3,
   "鲁迅：\n学外语的意义，绝不仅仅在于翻译与写作……\n\n"
   "乔布斯：\n我同意鲁迅的观点。语言确实是文化的载体……\n\n→ 回到讲道理，互相附和",
   14, False, INK_SOFT, line=1.55)
bar(s, 6.85, 1.8, 5.8, 4.5, CARD)
bar(s, 6.85, 1.8, 5.8, 0.06, RED)
tb(s, 7.15, 2.05, 5.2, 0.45, "加信息层之后", 17, True, RED)
tb(s, 7.15, 2.7, 5.2, 3.3,
   "鲁迅（唯一收到悄悄话）：\n乔布斯曾言…那么我问他：改变世界之前，\n你改变过多少人替你抬轿子？\n\n"
   "乔布斯（被点名，不知道内情）：\n你说得对，我不是一个人做成的。\n但沃兹尼亚克也不是我雇来的——\n"
   "他是因为看见我在做一件值得做的事才留下来的。\n\n"
   "若他们改回互相附和，主持人还会出面收尾：\n「刚才这一轮等于什么都没谈成。」\n\n"
   "→ 要么当面对质，要么被当面拆穿",
   13, False, INK, line=1.5)

# ============ 7 架构 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "06 · 技术架构", "分层架构与 v2 新增点")
# 按高度适配（架构图 1280x1080 偏方，按宽度铺会溢出页面）
pic(s, "diagrams/架构图.png", 0.72, 1.72, h=5.32)
tb(s, 7.35, 1.78, 5.3, 0.4, "这一层是作品的原创技术核心", 14, True, RED)
tb(s, 7.35, 2.3, 5.3, 4.6,
   "核心业务层 = 圆桌调度器\n把「议题 + 人格 + 可见性规则」\n编排成一轮轮交锋的 AI 发言\n\n"
   "① 议题输入 → ② 轮次控制器\n（发言顺序、点名拉人对峙）\n"
   "→ ③ 发言者 prompt 组装\n← 历史上下文（按可见性过滤后注入）\n"
   "→ ④ 模型调用 → ⑤ 输出装配\n\n"
   "蓝色描边为 v2 新增：\n· 可见性过滤器\n· 悄悄话存储器\n\n"
   "底部四格是对「数据安全意识」\n这一评审要点的正面回应。", 12.5, False, INK_SOFT, line=1.5)

# ============ 8 流程 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "07 · 交互流程", "一次悄悄话的完整链路")
pic(s, "diagrams/交互流程图.png", 0.62, 1.78, h=5.28)
tb(s, 8.15, 1.85, 4.5, 0.4, "一次悄悄话的六步", 14, True, RED)
tb(s, 8.15, 2.38, 4.5, 4.5,
   "T1　用户公开提问\nT2　A、B 公开发言，互相可见\nT3　用户私下对 A 说：\n　　「B 不赞同你的观点」\n"
   "T4　A 主动公开点名 B\nT5　系统把 B 提前拉入下一轮\nT6　B 回应，讨论继续\n\n"
   "阴影框标出的是 B 的可见范围——\n从头到尾，他都不知道\n用户私下跟 A 说了什么。\n\n"
   "这就是「信息不对称」\n在时序上的具体形状。", 12.5, False, INK_SOFT, line=1.52)

# ============ 9 数据安全 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "08 · 数据安全与隐私", "信息层本身就是一套隐私设计")
items = [
    ("最小权限", "悄悄话只进当事人 prompt；\n服务端按可见集合裁剪，\n不是前端隐藏，不落公共上下文"),
    ("不写日志", "悄悄话原文不写入 /api/log，\n日志只留标记；\n不用于任何训练或分析"),
    ("检索隔离", "查梗检索只由公开消息触发，\n悄悄话内容不会被搜成\n「场外情报」注入给所有人"),
    ("密钥与部署", "默认 Key 仅服务端；\nBYOK 密钥不落库、不写日志；\nHTTPS + 非特权容器"),
]
for i, (t, d) in enumerate(items):
    x = 0.7 + (i % 2) * 6.15
    y = 1.8 + (i // 2) * 2.3
    bar(s, x, y, 5.95, 2.05, CARD)
    bar(s, x, y, 0.06, 2.05, RED)
    tb(s, x + 0.35, y + 0.22, 5.3, 0.4, t, 16, True, INK)
    tb(s, x + 0.35, y + 0.72, 5.3, 1.2, d, 13, False, INK_SOFT, line=1.5)

# ============ 10 验证 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "09 · 完成度与验证", "全部结论来自实际运行")
rows = [
    ("tsc --noEmit", "退出码 0"),
    ("next build", "Compiled successfully，8 个路由正常生成"),
    ("T1 悄悄话定向发言", "who 事件仅 1 个（当事人），其余在座者不发言"),
    ("T3 摊牌机制", "修复前泛泛而谈 → 修复后「乔布斯曾言…我却问你」"),
    ("T4 抗伪共识", "修复前「我同意鲁迅的观点」→ 修复后正面辩解"),
    ("T5 新颖度判据", "原文重放的历史 → value: 0, stagnant: true"),
    ("R1 单人对谈回归", "who 事件 1 个、novelty 事件 0 个，单人逻辑未受影响"),
    ("R2 英文模式回归", "两人发言，回复汉字数量 0"),
    ("R4 12 人布局回归", "自动收缩为头像方片，每张卡片仍带「私」按钮"),
]
y = 1.7
for k, v in rows:
    tb(s, 0.85, y, 4.3, 0.35, k, 13.5, True, INK)
    tb(s, 5.4, y, 7.1, 0.35, v, 13.5, False, INK_SOFT)
    y += 0.5
tb(s, 0.85, y + 0.15, 11.6, 0.9,
   "已知边界如实说明：悄悄话当前只做单目标入口；摊牌效果依赖模型配合，偶有波动；\n"
   "新颖度阈值 0.34 为实测经验值；线上仍为 v1，提交前如需在线验证须先部署。",
   12, False, INK_SOFT, line=1.4)

# ============ 11 原创贡献 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "10 · 原创贡献", "一个人，非科班，借助 AI 工具")
tb(s, 0.85, 1.8, 5.6, 4.6,
   "作者：冯思涵\n哈尔滨金融学院 · 商务英语专业 · 单人参赛\n\n"
   "非计算机科班出身，独立完成：\n· 产品定位与选题论证\n· 信息层机制的构思与设计\n"
   "· 前后端开发、调试与云端部署\n· 界面与视觉语言设计\n· 上线与多平台推广运营\n\n"
   "AI 承担的是实现工作；\n构思、判断、审美与验收标准由作者负责。", 15, False, INK_SOFT, line=1.65)
bar(s, 6.9, 1.8, 5.75, 4.6, CARD)
tb(s, 7.2, 2.05, 5.2, 4.1,
   "AI 工具使用（如实申报）\n\n· 开发：DeepSeek Harness 等 AI 编程助手\n"
   "· 运行时：智谱 GLM-4-Flash（默认）+ BYOK\n· 宣传视频配音：Fish Audio TTS\n\n"
   "AI 不参与的部分\n\n· 问题发现：为什么 AI 圆桌总是趋同\n"
   "· 机制设计：可见性 / 悄悄话 / 点名对质 / 新颖度\n· 一切取舍与验收标准\n\n"
   "详见《人工智能工具使用情况说明》", 13.5, False, INK, line=1.55)

# ============ 12 价值与迭代 ============
s = prs.slides.add_slide(BLANK); bg(s)
head(s, "11 · 应用价值与迭代", "从「看热闹」到「帮你想清楚」")
bar(s, 0.7, 1.8, 5.95, 4.5, CARD)
tb(s, 1.0, 2.05, 5.4, 0.45, "应用价值", 17, True, RED)
tb(s, 1.0, 2.7, 5.4, 3.3,
   "· 思辨训练：让用户看到「同一件事，\n　不同立场的人会怎么拆」\n\n"
   "· 决策辅助：把「我的智囊团」\n　从比喻变成一个能用的东西\n\n"
   "· 反信息茧房：用信息不对称\n　强制保留立场差异\n\n"
   "· 开放：人格以 SKILL.md 组织，\n　任何人都能导入新角色", 14, False, INK, line=1.6)
bar(s, 6.85, 1.8, 5.8, 4.5, CARD)
tb(s, 7.15, 2.05, 5.2, 0.45, "迭代计划", 17, True, RED)
tb(s, 7.15, 2.7, 5.2, 3.3,
   "· 悄悄话支持同时告知多人，\n　形成临时的「小圈子」\n\n"
   "· 讨论停滞时引入 supervisor 收尾总结\n　（当前只做了强制反对）\n\n"
   "· 新颖度曲线可视化\n\n"
   "· 多人公开房间：每个用户\n　拥有自己的一份可见性视图", 14, False, INK, line=1.6)
bar(s, 0.7, 6.6, 11.95, 0.05, LINE)
tb(s, 0.7, 6.78, 11.95, 0.4,
   "outgate.chat　·　《门外谈——基于信息不对称机制的多智能体圆桌辩论系统》",
   13, True, INK_SOFT, align=PP_ALIGN.CENTER)

out = os.path.join(HERE, "答辩PPT.pptx")
prs.save(out)
print("已生成:", out, "| 页数:", len(prs.slides._sldIdLst))
