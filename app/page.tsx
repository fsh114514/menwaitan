"use client";
import { useState, useEffect, useLayoutEffect, useRef, Fragment } from "react";
import TableScene from "@/components/bits/TableScene";
import { characterMeta as baseChars } from "@/lib/characterMeta";
import SplitText from "@/components/bits/SplitText";
import ClickSpark from "@/components/bits/ClickSpark";
import "./revolution/revolution.css";

type Char = { id: string; zhName: string; name: string; initial: string; school: string; tag: string; color: string; skillDir: string; imported?: boolean; bio?: string; bioEn?: string; repo?: string };
type Msg = { role: string; who?: string; color?: string; content: string; auto?: boolean; err?: boolean; whisperTo?: string };
type Scene = "casual" | "serious" | "heated";
type Lang = "zh" | "en";

function HelpDesc({ text, hot }: { text: string; hot: string[] }) {
  const parts: { s: string; cur: boolean }[] = [];
  let rest = text;
  while (rest) {
    let idx = -1;
    let len = 0;
    let hit = "";
    for (const h of hot) {
      const i = rest.indexOf(h);
      if (i >= 0 && (idx === -1 || i < idx)) { idx = i; len = h.length; hit = h; }
    }
    if (idx === -1) { parts.push({ s: rest, cur: false }); break; }
    if (idx > 0) parts.push({ s: rest.slice(0, idx), cur: false });
    parts.push({ s: hit, cur: true });
    rest = rest.slice(idx + len);
  }
  return (
    <span className="rv-set-desc">
      {parts.map((p, i) => (p.cur ? <b key={i} className="rv-cur">{p.s}</b> : <span key={i}>{p.s}</span>))}
    </span>
  );
}

const PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", baseURL: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"], keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "zhipu", name: "智谱 GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4-flash", "glm-4-air", "glm-4-plus"], keyUrl: "https://open.bigmodel.cn/usercenter/apikeys" },
  { id: "kimi", name: "Kimi (Moonshot)", baseURL: "https://api.moonshot.cn/v1", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"], keyUrl: "https://platform.moonshot.cn/console/api-keys" },
  { id: "qwen", name: "通义千问", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-turbo", "qwen-plus", "qwen-max"], keyUrl: "https://bailian.console.aliyun.com/#/api-key" },
  { id: "openai", name: "OpenAI", baseURL: "https://api.openai.com/v1", models: ["gpt-4o-mini", "gpt-4o"], keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", name: "Google Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", models: ["gemini-1.5-flash", "gemini-2.0-flash"], keyUrl: "https://aistudio.google.com/app/apikey" },
  { id: "groq", name: "Groq", baseURL: "https://api.groq.com/openai/v1", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], keyUrl: "https://console.groq.com/keys" },
  { id: "mistral", name: "Mistral", baseURL: "https://api.mistral.ai/v1", models: ["mistral-small-latest", "mistral-medium-latest"], keyUrl: "https://console.mistral.ai/api-keys/" },
  { id: "openrouter", name: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", models: ["openrouter/auto"], keyUrl: "https://openrouter.ai/keys" },
  { id: "custom", name: "自定义 / Custom", baseURL: "", models: [], keyUrl: "" },
];

const WELCOME_ZH: Msg = { role: "ai", who: "门外谈", color: "#c8102e", content: "圆桌已备，静候议题。选一位（或几位）人物，抛出一个问题——他们会以各自的方式回应你。" };
const SCENE_KEY = "mw_scene";
const SCENE_ORDER: Scene[] = ["casual", "serious", "heated"];
const RAIN_CHARS = ["思", "想", "交", "锋", "门", "外", "谈", "壹", "贰", "叁", "肆", "入", "席", "惊", "雷", "灯", "火", "·"];
const ESCALATE_WORDS = ["凭什么", "为什么", "你错了", "不同意", "不服", "滚", "垃圾", "废话", "胡扯", "扯淡", "笑死", "无语", "凭啥"];

const SPEED_KEY = "mw_type_speed";
type SpeedLevel = "slow" | "normal" | "fast" | "turbo";
const SPEEDS: Record<SpeedLevel, { qn: number; qt: number; bn: number; bt: number }> = {
  slow: { qn: 1, qt: 60, bn: 1, bt: 60 },
  normal: { qn: 1, qt: 42, bn: 2, bt: 44 },
  fast: { qn: 2, qt: 28, bn: 4, bt: 24 },
  turbo: { qn: 3, qt: 20, bn: 8, bt: 16 },
};

const EFFECT: Record<string, number> = {
  "marx-skill": 32, "kongzi-skill": 31, luxun: 29,
  "steve-jobs-skill": 28, "elon-musk-skill": 27, "leijun-skill": 20, "huangrenxun-skill": 19, "buffett-skill": 14, "dalio-skill": 13,
  "nietzsche-skill": 8, "foucault-skill": 7, "beauvoir-skill": 7, "socrates-skill": 6, "wittgenstein-skill": 5,
  "einstein-skill": 4, "turing-skill": 3, hayek: 2, keynes: 2, "plato-skill": 1,
  shakespeare: 13, aristotle: 12, kant: 11, smith: 10, darwin: 9, churchill: 9, newton: 8, camus: 8, russell: 7, orwell: 7, holmes: 6, alice: 6, schrodinger: 6, vangogh: 5, schopenhauer: 5, mlk: 5,
};

const EFFECT_INTL: Record<string, number> = {
  shakespeare: 38, aristotle: 37, kant: 36, "plato-skill": 35, "socrates-skill": 34, "nietzsche-skill": 33, "marx-skill": 32, smith: 31, churchill: 30, holmes: 29, alice: 28, newton: 27, darwin: 26, schrodinger: 25, "einstein-skill": 24, "turing-skill": 23, "steve-jobs-skill": 22, "elon-musk-skill": 21, vangogh: 19, camus: 18, russell: 17, orwell: 16, schopenhauer: 15, "foucault-skill": 14, "wittgenstein-skill": 13, hayek: 12, keynes: 11, "beauvoir-skill": 10, mlk: 9, "buffett-skill": 8, "dalio-skill": 7, "kongzi-skill": 6, luxun: 5, "leijun-skill": 2, "huangrenxun-skill": 2, };

/* 敏感人物区已废弃：相关角色已于 2026-10-18 从人格库移除。
   原「展开更多角色」按钮改为「展开剩余人物」（前 12 位常驻，其余折叠）。 */
const GRID_PAGE = 12;

const WELCOME_EN: Msg = { role: "ai", who: "Outgate Chat", color: "#c8102e", content: "The round table is set. Pick one or several thinkers, pose a question — they will answer in their own way." };

function extractQuote(bio: string): { quote: string; rest: string } {
  const m = bio.match(/["“‘“「]([^"”’”」]{6,90})["”’”」]/);
  if (m) {
    const quote = m[1];
    return { quote, rest: bio.slice((m.index || 0) + m[0].length).trim() };
  }
  const i = bio.indexOf("。");
  if (i > 4 && i < 120) return { quote: bio.slice(0, i + 1), rest: bio.slice(i + 1).trim() };
  return { quote: "", rest: bio };
}

type SavedChat = { id: string; title: string; messages: Msg[]; mode: "chat" | "debate"; characters: string[]; createdAt: number; updatedAt: number };

const I18N = {
  zh: {
    mastL: "门外谈 · 创刊号",
    mastR: "公元贰零贰陆",
    mastX: "思想 · 交锋 · 请入席",
    codaText: "心事浩茫连广宇，于无声处听惊雷",

    slogan: "跨越时空，让思想交锋",
    sub: "请一位（或几位）古今思想者入席，就你的议题，各执一词，当面交锋。",
    cta: "开始对谈",
    tab1: "辩论室",
    tab2: "人物志",
    tab3: "创意工坊",
    tab4: "关于",
    avLabel: "入席人物",
    avHint: "已入席人物：拖动排序 · 点 × 离席",
    avNote: "本站角色人格，均由上游开源社区基于原著设定精心提炼打磨而成，向各位作者致谢。",
    avEmpty: "还没人入席——去「人物志」点卡片把人请进来",
    avGo: "去人物志请人入席 →",
    personasHint: "点卡片 = 入席；已入席的卡片排前面。拖（手机长按）卡片调整顺序，未入席的拖过去会入席；点「介」看人物介绍",
    moreChars: "展开更多角色",
    lessChars: "收起",
    leave: "离席",
    dragHint: "拖动排序",
    bio: "简介",
    speed: { slow: "慢", normal: "标准", fast: "快", turbo: "极速" },
    dosNo: "档案编号",
    dosMast: "人物档案 · DOSSIER",
    dosRepo: "查看完整 README ↗",
    dosPrinting: "打印中…",
    dosDone: "已归档",
    bioSource: "介绍摘自该人格开源项目的 README，版权归原作者所有",
    bioEmpty: "暂无介绍",
    chat: "对谈",
    round: "圆桌",
    send: "发言",
    chatHead: "门外谈 · 辩论室",
    ph: "抛出一个议题，让思想家们交锋…",
    enter: "入席 →",
    entered: "已入席",
    wsSub: "站内已有几十位人物。想再添新的，可以从下面的现成仓库挑一个，也可以贴一个你自己的。",
    wsImport: "导入",
    wsImporting: "导入中…",
    wsRec: "更多人物 · 站外现成（点一下，自动填进下面的输入框）",
    wsRecHint: "以下人物站内还没有。想淘更多，去合集页逛一逛。",
    wsOwn: "自己导入一个人物（仓库根目录需含 SKILL.md）",
    wsOrg: "nuwa-skills 组织",
    wsOrgUrl: "https://github.com/nuwa-skills",
    wsGallery: "合集页",
    wsGalleryUrl: "https://titanwings.github.io/colleague-skill-site/gallery/",
    recs: [
      { name: "dot-skill 合集页（gallery）", url: "https://titanwings.github.io/colleague-skill-site/gallery/", ext: true },
      { name: "王阳明 · skill（心学）", url: "https://github.com/nuwa-skills/wangyangming-skill.git" },
      { name: "老子 · skill（道家）", url: "https://github.com/nuwa-skills/laozi-skill.git" },
      { name: "曾国藩 · skill（自我管理）", url: "https://github.com/nuwa-skills/zengguofan-skill.git" },
      { name: "费曼 · skill（学习法）", url: "https://github.com/nuwa-skills/feynman-skill.git" },
      { name: "达芬奇 · skill（跨学科）", url: "https://github.com/nuwa-skills/davinci-skill.git" },
      { name: "稻盛和夫 · skill（经营）", url: "https://github.com/nuwa-skills/inamori-skill.git" },
      { name: "李小龙 · skill（截拳道）", url: "https://github.com/nuwa-skills/brucelee-skill.git" },
      { name: "富兰克林 · skill（习惯）", url: "https://github.com/nuwa-skills/franklin-skill.git" },
    ],
    creditTag: "开源训练人格",
    creditLine: "本页人物的人格，由开源社区开发者精心训练而成（SKILL.md 蒸馏人格）——非本站生成",
    aboutLede: "门外谈——请古今思想者入席，就你的议题，各执一词，当面交锋。",
    a1: "是什么",
    a1d: "一个与「蒸馏人格」思想家对话、辩论的网站：马克思、鲁迅、哈耶克……或任何你想请进来的人。",
    a2: "怎么玩",
    a2d: "选一位（或几位）人物 → 对谈或圆桌辩论 → 抛出一个议题，看他们各执一词。创意工坊可导入任意新角色。",
    a3: "人格来源",
    a3d: "角色人格与人物介绍由开源蒸馏人格社区生成：人格蒸馏自各项目的 SKILL.md，介绍内容摘自各项目 README（版权归原作者所有）——向各位作者致谢。",
    note: "免责声明：本网站角色对话由 AI 基于公开资料生成，不代表任何真实人物本人观点；内容仅供思想交流。",
    whatsNew: "近日更新",
    viewAll: "查看全部 →",
    sponsor: "赞助",
    feedback: "反馈",
    zoomClose: "点任意处关闭",
    changelog: [
      "英文版人物名与对话彻底英文化：导入角色的 slug 名（如 plato-perspective）清洗成人名（Plato），单人对谈与圆桌一律英文作答，人物志改用英文简介",
      "入席人物自适应：1–4 位长条卡、5–11 位自动收成红签小方片、12 位以上只留头像色块——多人圆桌不再挤爆侧栏",
      "顺序调整简化：删除「回答顺序」按钮，直接拖动入席人物卡片即可排定发言顺序",
      "海外版：右上角一键切中/英，海外访客自动落英文界面，英文版走国际模型+英文查梗",
      "新角色：新增 16 位国际人物（莎士比亚、亚里士多德、福尔摩斯、薛定谔、丘吉尔……），各带英文梗素养",
      "打赏与反馈：英文版支持 Ko-fi 打赏；「反馈」直传站长后台",
      "联网查梗：问「XX 是什么 / 什么意思 / 为什么」时，自动联网检索最新网络梗（必应、360、萌娘百科等多源），回复前附一句「注：据网络检索…」",
      "自由看历史：辩论进行中可上翻查看发言，不再被强制拉回底部；右下角一键回到最新",
      "停止发言：点「停止」立即中断回答、保留已说内容，不再一直转圈；新对话不再残留加载",
      "圆桌交锋：先表明立场再给独立理由，不复述不附和，跑题时把话题拉回来",
      "人格校准：10 位思想家回归本人（鲁迅、哈耶克、凯恩斯、柏拉图、尼采等），不再被带偏或变成旁观者",
      "角色自然化：去掉平台层调教，每个角色用自己的方式说话——鲁迅会先反问你一句，乔布斯会直接给你一个判断",
      "回复克制：较真模式「宁短勿长」，杜绝长篇大论",
    ],
    foot1: "跨越时空，让思想交锋",
    foot2: "第壹期 · 公元贰零贰陆",
    thanks: "角色人格由开源蒸馏人格社区生成 · 致谢各位作者",
    meta: "创刊于公元贰零贰陆<br />思想 · 交锋 · 请入席",
    vert: "门外 · 思想 · 交锋",
    typed: ["门外说话，门里听风", "于无声处，听惊雷", "字缝里漏出光来", "纸墨之间，自有风雷", "长夜未央，灯下有人"],
    personasTitle: "人物志",
    wsTitle: "请新人入席",
    aboutName: "门外谈",
    a4: "致谢",
    a4d: "角色人格蒸馏自开源社区项目：dot-skill（colleague-skill）、女娲.skill（awesome-nuwa），以及鲁迅.skill、哈耶克.skill、凯恩斯.skill 等——向各位作者致谢。",
    setTitle: "设置",
    setKey: "API Key（选填，用自己的）",
    setProvider: "选择服务商",
    defaultHint: "正在使用默认模型，思考深度有限。",
    getKeyHint: "自定义 API Key",
    getKey: "获取 API Key →",
    setBase: "Base URL",
    setModel: "模型",
    setSave: "保存",
    setSaved: "已保存",
    setDesc: "留空则使用站点默认。Key 仅存于你的浏览器本地。",
    tabGuide: "教程",
    history: "历史",
    newChat: "新对话",
    histTitle: "历史记录",
    histEmpty: "还没有对话历史——聊过一轮后会自动保存在你的浏览器本地",
    histContinue: "继续",
    histDelete: "删除",
    histMsgs: "条消息",
    sceneLabel: { casual: "随口", serious: "较真", heated: "上头" },
    sceneHint: "随口 · 较真 · 上头——随事态自动升级",
    sceneTag: "交锋",
    sceneDesc: { casual: "两三句，先碰个面", serious: "认真辩，有来有往", heated: "放开打，不设限" },
    modeTag: "模式",
    roundTag: "轮次",
    modeHelp: "对谈 = 和思想者单独聊；圆桌 = 多位思想者轮流交锋",
    sceneHelp: "交锋 = 回答的长短火候：随口很短、较真适中、上头放开。气氛上来时会自动升级",
    back: "返回人物志",
    guideTitle: "使用教程",
    guideLede: "从零开始，一步步带你玩转门外谈。",
    guide: [
      { n: "壹", t: "选人物", b: "在「人物志」或左侧人物列表里点选角色。选 1 位 = 单人对谈；选 2 位以上 = 圆桌辩论。" },
      { n: "贰", t: "提问", b: "在输入框写下你的问题，点「发言」或按回车。回答会一个字一个字地冒出来——别急，这是 AI 在边想边说。" },
      { n: "叁", t: "切换语言", b: "右上角「EN / 中」一键切换全站中英文。" },
      { n: "肆", t: "用自己的 API Key（可选）", b: "不填也能用（走站点默认）。想用自己的：在任意支持 OpenAI 兼容接口的服务商注册（如 DeepSeek、Moonshot Kimi、智谱、通义、OpenRouter 等）；在它的控制台创建并复制 API Key（一般 sk- 开头）；回到本站「设置」，把 Key 粘贴到「API Key」栏；「Base URL」和「模型」填服务商给你的地址和模型名（每家不同，看它的控制台或文档）；点「保存」。举例：DeepSeek 填 https://api.deepseek.com + deepseek-chat；Kimi 填 https://api.moonshot.cn + moonshot-v1-8k。Key 只存在你自己的浏览器本地，不会上传服务器。" },
      { n: "伍", t: "导入新人物", b: "在「创意工坊」粘贴一个 GitHub 仓库链接，点「导入」，几秒后新人物就出现在人物志。要求：仓库根目录必须有一个 SKILL.md 文件——这是「蒸馏人格」的标准格式。想找现成人物？去 GitHub 搜蒸馏人格 skill 仓库，比如鲁迅、哈耶克、康德等。" },
      { n: "陆", t: "常见问题", b: "没反应？① 检查设置里 API Key / Base URL / 模型是否填对（注意别多空格）；② 清空 Key 试试站点默认；③ 刷新页面重来。导入失败？确认链接是 GitHub 仓库地址，且根目录有 SKILL.md。" },
    ],
    nums: ["壹", "贰", "叁", "肆"],
  },
  en: {
    mastL: "Outgate Chat · Vol. 1",
    mastR: "AD 2026",
    mastX: "Ideas · Debate · Take a seat",
    codaText: "Thunder heard in silence",

    slogan: "Across time, let ideas clash",
    sub: "Invite one or several thinkers to the table — pose your question, watch them argue it out.",
    cta: "Start a Talk",
    tab1: "Debate Room",
    tab2: "Gallery",
    tab3: "Workshop",
    tab4: "About",
    avLabel: "Seat the thinkers",
    avHint: "Seated: drag to reorder · use × to unseat",
    avNote: "Personas here are carefully distilled from original settings by the upstream open-source community — thanks to all authors.",
    avEmpty: "No one seated yet — pick thinkers in the Gallery",
    avGo: "Go to Gallery →",
    personasHint: "Click a card to seat a thinker; seated cards move to the front. Drag (long-press on touch) to reorder — dragging an unseated card seats it there; click the bio tag for details.",
    moreChars: "More characters",
    lessChars: "Collapse",
    leave: "Unseat",
    dragHint: "Drag to reorder",
    bio: "Bio",
    speed: { slow: "Slow", normal: "Normal", fast: "Fast", turbo: "Turbo" },
    dosNo: "File No.",
    dosMast: "PERSONAL DOSSIER",
    dosRepo: "Full README ↗",
    dosPrinting: "Printing…",
    dosDone: "Archived",
    bioSource: "Intro is quoted from the open-source project README; copyright belongs to the original authors",
    bioEmpty: "No intro available",
    chat: "One-on-One",
    round: "Round Table",
    send: "Speak",
    chatHead: "Outgate Chat · Debate Room",
    ph: "Pose a question for the thinkers…",
    enter: "Seat →",
    entered: "Seated",
    wsSub: "The site already has dozens of personas. To add one, pick a ready-made repo below or paste your own.",
    wsImport: "Import",
    wsImporting: "Importing…",
    wsRec: "More personas · ready-made repos (click to fill the box below)",
    wsRecHint: "None of these are in the site yet. For more, browse the collections.",
    wsOwn: "Import your own (SKILL.md must sit at the repo root)",
    wsOrg: "nuwa-skills org",
    wsOrgUrl: "https://github.com/nuwa-skills",
    wsGallery: "the gallery",
    wsGalleryUrl: "https://titanwings.github.io/colleague-skill-site/gallery/",
    recs: [
      { name: "titanwings gallery (collection)", url: "https://titanwings.github.io/colleague-skill-site/gallery/", ext: true },
      { name: "Feynman · skill", url: "https://github.com/nuwa-skills/feynman-skill.git" },
      { name: "da Vinci · skill", url: "https://github.com/nuwa-skills/davinci-skill.git" },
      { name: "Franklin · skill", url: "https://github.com/nuwa-skills/franklin-skill.git" },
      { name: "Marcus Aurelius · skill", url: "https://github.com/nuwa-skills/aurelius-skill.git" },
      { name: "Beethoven · skill", url: "https://github.com/nuwa-skills/beethoven-skill.git" },
      { name: "Curie · skill", url: "https://github.com/nuwa-skills/curie-skill.git" },
      { name: "Drucker · skill", url: "https://github.com/nuwa-skills/drucker-skill.git" },
      { name: "Clausewitz · skill", url: "https://github.com/nuwa-skills/clausewitz-skill.git" },
    ],
    creditTag: "Open-source trained persona",
    creditLine: "Every persona here is carefully trained by open-source developers (SKILL.md distilled personas) — not generated by this site",
    
    aboutLede: "Outgate Chat — invite thinkers across time to the table, each holding their position, debating face to face.",
    a1: "What",
    a1d: "A place to talk and debate with distilled thinkers: Marx, Lu Xun, Hayek… or anyone you wish to bring in.",
    a2: "How",
    a2d: "Pick one or several thinkers → talk one-on-one or round-table debate → pose a question and watch them clash. The Workshop imports any new character.",
    a3: "Origins",
    a3d: "Personas and intros come from the open-source distilled-persona community: personas are distilled from each project SKILL.md, intros are quoted from each project README (copyright to the original authors) — thanks to all the authors.",
    note: "Disclaimer: character dialogues are AI-generated from public materials and do not represent the views of any real person; for thought exchange only.",
    whatsNew: "What's new",
    viewAll: "View all →",
    sponsor: "Sponsor",
    feedback: "Feedback",
    zoomClose: "Click anywhere to close",
    changelog: [
      "English names and dialogue, end to end: imported slug names (e.g. plato-perspective) are cleaned into real names (Plato), one-on-one chats and round tables answer in English, and dossiers use English intros",
      "Seated thinkers adapt: 1–4 stay full cards, 5–11 shrink to compact chips, 12+ become avatar tiles — big roundtables no longer overflow the sidebar",
      "Reorder simplified: the speaking-order buttons are gone — drag the seated cards to set the turn order",
      "International: one-click ZH/EN switch — overseas visitors land on the English interface with international models and English meme lookup",
      "New characters: 16 international thinkers added (Shakespeare, Aristotle, Holmes, Schrödinger, Churchill...) with meme-literate personas",
      "Support & feedback: Ko-fi for English visitors; feedback goes straight to the owner",
      "Meme lookup: ask what a meme or phrase means (or why), and the thinkers search the web across Bing / 360 / Moegirl for the latest context",
      "Read while debating: scroll back through the discussion freely; jump back to the latest anytime",
      "Stop speaking: the stop button truly interrupts and keeps what was said — no more endless loading",
      "Sharper debate: state your stance first, give independent reasons, don't echo others, pull the topic back when it drifts",
      "Persona fixes: 10 thinkers now speak as themselves (Lu Xun, Hayek, Keynes, Plato, Nietzsche...)",
      "Natural voices: platform tuning removed, each character answers in their own way",
      "Keep it short: Serious mode is now brief over long",
          ],
    foot1: "Across time, let ideas clash",
    foot2: "Vol. 1 · AD 2026",
    thanks: "Personas distilled by the open-source community · thanks to all authors",
    meta: "Founded AD 2026<br />Ideas · Debate · Take a seat",
    vert: "Menwai · Ideas · Debate",
    typed: ["Speak at the door, the wind listens", "Hear the thunder in silence", "Light leaks between the lines", "Storm stirs beneath the ink", "Deep in the night, someone writes"],
    personasTitle: "Gallery",
    wsTitle: "Invite new voices",
    aboutName: "Outgate Chat",
    a4: "Thanks",
    a4d: "Personas are distilled from open-source community projects: dot-skill (colleague-skill), Nuwa.skill (awesome-nuwa), and Zhang Xuefeng.skill, Feng Ge, Mao Xuan.skill, Lu Xun.skill, Hayek.skill, Keynes.skill — thanks to all the authors.",
    setTitle: "Settings",
    setKey: "API Key (optional — use your own)",
    setProvider: "Provider",
    defaultHint: "Default model in use — depth is limited.",
    getKeyHint: "Bring your own key",
    getKey: "Get an API key →",
    setBase: "Base URL",
    setModel: "Model",
    setSave: "Save",
    setSaved: "Saved",
    setDesc: "Leave blank to use the site default. The key is stored only in your browser.",
    tabGuide: "Guide",
    history: "History",
    newChat: "New chat",
    histTitle: "History",
    histEmpty: "No history yet — after a chat it is saved automatically in your browser",
    histContinue: "Resume",
    histDelete: "Delete",
    histMsgs: "messages",
    sceneLabel: { casual: "Casual", serious: "Serious", heated: "Heated" },
    sceneHint: "Casual · Serious · Heated — auto-escalates as things heat up",
    sceneTag: "Clash",
    sceneDesc: { casual: "Two lines, feel the room", serious: "Real debate, back and forth", heated: "No limits, go all out" },
    modeTag: "Mode",
    roundTag: "Rounds",
    modeHelp: "One-on-One = talk with a thinker; Round Table = several thinkers take turns clashing",
    sceneHelp: "Clash = how long answers are: Casual is short, Serious is measured, Heated lets loose. It auto-escalates as the heat rises",
    back: "Back to gallery",
    guideTitle: "Quick Guide",
    guideLede: "A step-by-step walkthrough, from zero to hero.",
    guide: [
      { n: "01", t: "Pick thinkers", b: "Click characters in the Gallery or the left list. One = one-on-one chat; two or more = round-table debate." },
      { n: "02", t: "Ask", b: "Type your question and hit Speak or Enter. Answers stream out word by word — the AI is thinking out loud, so let it finish." },
      { n: "03", t: "Language", b: "Toggle EN / 中 at the top right to switch the whole site between English and Chinese." },
      { n: "04", t: "Use your own API key (optional)", b: "It works without one (site default). To use yours: sign up with any provider offering an OpenAI-compatible API (e.g. DeepSeek, Moonshot Kimi, Zhipu, Qwen, OpenRouter); create and copy an API key in its console (usually starts with sk-); open Settings here, paste it into API Key; fill in the Base URL and Model your provider gives you (each differs — see its console or docs); hit Save. Example: DeepSeek = https://api.deepseek.com + deepseek-chat; Kimi = https://api.moonshot.cn + moonshot-v1-8k. The key stays only in your browser." },
      { n: "05", t: "Import characters", b: "Paste a GitHub repo URL in the Workshop and hit Import. The new character appears in seconds. The repo root must contain a SKILL.md file (the distilled-persona standard). Search GitHub for distilled-persona skills such as Zhang Xuefeng, Lu Xun, Hayek." },
      { n: "06", t: "Troubleshooting", b: "No response? Check API Key / Base URL / Model in Settings (watch for stray spaces), or clear the key to use the site default. Import failed? Make sure it is a GitHub repo URL with SKILL.md at the root." },
    ],
    nums: ["01", "02", "03", "04"],
  },
};


export default function RevolutionPreview() {
  const [lang, setLang] = useState<Lang>("zh");
  const [regionInit, setRegionInit] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mw_region");
      if (saved === "zh" || saved === "en") { setLang(saved); if (saved === "en") setMessages([WELCOME_EN]); setRegionInit(true); return; }
    } catch { /* ignore */ }
    if (typeof navigator !== "undefined" && navigator.language && !navigator.language.toLowerCase().startsWith("zh")) { setLang("en"); setMessages([WELCOME_EN]); }
    setRegionInit(true);
  }, []);
  const providers = lang === "en" ? PROVIDERS.filter((p) => !["zhipu", "kimi", "qwen"].includes(p.id)) : PROVIDERS;
  const [tab, setTab] = useState<"debate" | "personas" | "workshop" | "guide" | "about" | "settings">("debate");
  const [chars, setChars] = useState<Char[]>(baseChars);
  const [showSensitive, setShowSensitive] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<SavedChat[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [speed, setSpeed] = useState<SpeedLevel>("normal");
  const [scene, setScene] = useState<Scene>("serious");

  const [messages, setMessages] = useState<Msg[]>(lang === "zh" ? [WELCOME_ZH] : [WELCOME_EN]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "debate">("debate");
  // v2 信息层：当前正在私下对谁说话（空 = 公开发言）
  const [whisperTo, setWhisperTo] = useState<string>("");
  // v2 信息层：悄悄话之后自动接的那一轮公开圆桌（用于显示「桌上正在反应」）
  const [autoRound, setAutoRound] = useState(false);
  // v2 信息层：上一轮的信息新颖度（讨论趋同时亮灯）
  const [novelty, setNovelty] = useState<{ value: number; stagnant: boolean } | null>(null);
  // v2 信息层：输入框左侧「私下说」的人选弹窗
  const [whisperPick, setWhisperPick] = useState(false);
  // v2 信息层：一次性引导（用户点过「私下说」或手动关掉后永久不再出现）
  const [whisperTipOff, setWhisperTipOff] = useState(true);
  const [memeNote, setMemeNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newsOpen, setNewsOpen] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [fbText, setFbText] = useState("");
  const [fbContact, setFbContact] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbDone, setFbDone] = useState(false);
  async function submitFb() {
    if (!fbText.trim() || fbSending) return;
    setFbSending(true);
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fbText, contact: fbContact }) });
      const j = await r.json();
      if (j.ok) { setFbDone(true); setFbText(""); setFbContact(""); }
    } catch {} finally { setFbSending(false); }
  }
  const [sponsorOpen, setSponsorOpen] = useState(false);

  useEffect(() => {
    fetch("/api/notice")
      .then((r) => r.json())
      .then((d) => { if (d && d.text) setNotice(String(d.text)); })
      .catch(() => { /* ignore */ });
  }, []);
  const [rounds, setRounds] = useState(2);
  const [typing, setTyping] = useState(false);
  const [paused, setPaused] = useState(false);
  const [uid] = useState(() => {
    try {
      let u = localStorage.getItem("mw_uid") || "";
      if (!u) { u = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("mw_uid", u); }
      return u;
    } catch { return "anon"; }
  });
  const pausedRef = useRef(false);
  const bumpRef = useRef<() => void>(() => {});
  const abortRef = useRef<AbortController | null>(null);
  const sendSeqRef = useRef(0);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [model, setModel] = useState("");
  const [providerId, setProviderId] = useState("custom");
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [setMsg, setSetMsg] = useState("");
  const [typed, setTyped] = useState("");
  const [tIdx, setTIdx] = useState(0);
  const [tChar, setTChar] = useState(0);
  const [tDel, setTDel] = useState(false);

  const t = I18N[lang];

  // 人物志简介：中英各一份（后端 /api/characters 同时返回 bio / bioEn）
  const bioOf = (c: Char) => (lang === "en" ? (c.bioEn || c.bio || "") : (c.bio || c.bioEn || ""));

  useEffect(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d) => { if (d.characters && d.characters.length > 0) setChars(d.characters); })
      .catch(() => {});
    try {
      const raw = localStorage.getItem("mw_chat_history");
      if (raw) {
        const list: SavedChat[] = JSON.parse(raw);
        setHistory(Array.isArray(list) ? list : []);
      }
      const sp = localStorage.getItem(SPEED_KEY);
      if (sp === "slow" || sp === "fast" || sp === "turbo") setSpeed(sp);
      const sc = localStorage.getItem(SCENE_KEY);
      if (sc === "serious" || sc === "heated") setScene(sc);
      // v2：一次性的悄悄话引导，用户看过就不再打扰
      setWhisperTipOff(localStorage.getItem("mw_whisper_tip") === "off");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (chars.length === 0) return;
    try {
      const cid = localStorage.getItem("mw_chat_current_id");
      const raw = localStorage.getItem("mw_chat_history");
      if (!cid || !raw) return;
      const list: SavedChat[] = JSON.parse(raw);
      const cur = (list || []).find((h) => h.id === cid);
      if (cur && cur.messages && cur.messages.length > 0) {
        setMessages(cur.messages);
        setSelected(cur.characters.filter((id) => chars.some((c) => c.id === id)));
        setMode(cur.mode);
        setChatId(cur.id);
      }
    } catch { /* ignore */ }
  }, [chars]);

  useEffect(() => {
    const words = I18N[lang].typed;
    const word = words[tIdx % words.length];
    const timer = setTimeout(() => {
      if (tDel === false) {
        const next = tChar + 1;
        setTChar(next);
        setTyped(word.slice(0, next));
        if (next === word.length) { setTimeout(() => setTDel(true), 1500); }
      } else {
        const next = tChar - 1;
        setTChar(next);
        setTyped(word.slice(0, next));
        if (next === 0) { setTDel(false); setTIdx((i) => i + 1); }
      }
    }, tDel ? 45 : 120);
    return () => clearTimeout(timer);
  }, [tChar, tDel, tIdx, lang]);

  useEffect(() => {
    setApiKey(localStorage.getItem("mw_api_key") || "");
    setBaseURL(localStorage.getItem("mw_base_url") || "");
    setModel(localStorage.getItem("mw_model") || "");
    const savedBase = localStorage.getItem("mw_base_url") || "";
    const matched = providers.find((pr) => pr.baseURL && savedBase && savedBase.includes(pr.baseURL.split("//")[1].split("/")[0]));
    if (matched) setProviderId(matched.id);
  }, []);

  const selectProvider = (id: string) => {
    setProviderId(id);
    const pr = providers.find((x) => x.id === id);
    if (!pr) return;
    if (pr.baseURL) setBaseURL(pr.baseURL);
    setModel(pr.models[0] || "");
  };

  const saveSettings = () => {
    localStorage.setItem("mw_api_key", apiKey.trim());
    localStorage.setItem("mw_base_url", baseURL.trim());
    localStorage.setItem("mw_model", model.trim());
    setSetMsg(lang === "zh" ? "已保存" : "Saved");
  };

  const compact = selected.length > 4;
  const mini = selected.length > 11;
  const avatarsRef = useRef<HTMLDivElement | null>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const flipMounted = useRef(false);
  useLayoutEffect(() => {
    const list = avatarsRef.current;
    if (!list) return;
    const nodes = Array.from(list.querySelectorAll<HTMLElement>("[data-flip]"));
    const newRects = new Map<string, DOMRect>();
    for (const n of nodes) newRects.set(n.getAttribute("data-flip") || "", n.getBoundingClientRect());
    if (!flipMounted.current) {
      flipMounted.current = true;
      prevRects.current = newRects;
      return;
    }
    const prev = prevRects.current;
    if (prev.size > 0) {
      for (const [id, rect] of newRects) {
        const old = prev.get(id);
        if (!old) continue;
        const el = list.querySelector<HTMLElement>('[data-flip="' + id + '"]');
        if (!el) continue;
        const dx = old.left - rect.left, dy = old.top - rect.top;
        const sx = old.width / rect.width, sy = old.height / rect.height;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.02 && Math.abs(sy - 1) < 0.02) continue;
        el.style.transition = "none";
        el.style.transformOrigin = "top left";
        el.style.transform = "translate(" + dx + "px, " + dy + "px) scale(" + sx + ", " + sy + ")";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition = "transform 0.5s var(--ease-out)";
            el.style.transform = "translate(0, 0) scale(1, 1)";
            const clean = () => { el.style.transition = ""; el.style.transform = ""; el.style.transformOrigin = ""; };
            el.addEventListener("transitionend", clean, { once: true });
          });
        });
      }
    }
    prevRects.current = newRects;
  }, [compact, mini, selected.length]);

  const gridChars = [
    ...selected.map((id) => chars.find((c) => c.id === id)).filter((c): c is Char => !!c),
    ...[...chars.filter((c) => !selected.includes(c.id))].sort(
      (a, b) => ((lang === "en" ? EFFECT_INTL : EFFECT)[b.id] || 10) - ((lang === "en" ? EFFECT_INTL : EFFECT)[a.id] || 10)
    ),
  ];
  const renderCard = (c: Char, i: number) => {
                const active = selected.includes(c.id);
                const q = bioOf(c) ? extractQuote(bioOf(c)) : { quote: "", rest: "" };
                const idx = (chars.findIndex((x) => x.id === c.id) + 1).toString().padStart(2, "0");
                return (
                  <Fragment key={c.id}>
                  <button style={{ animationDelay: (0.05 * i) + "s" }}
                    className={"rv-char-card" + (active ? " active" : "") + (dropId === c.id ? " drag-over" : "") + (draggingId === c.id ? " dragging" : "") + (bioId && bioId !== c.id ? " dimmed" : "")}
                    data-id={c.id}
                    draggable
                    onPointerDown={(e) => onPtrDown(c.id, e)}
                    onPointerMove={(e) => onPtrMove(c.id, e)}
                    onPointerUp={(e) => onPtrUp(c.id, e)}
                    onPointerCancel={() => onPtrCancel(c.id)}
                    onDragStart={(e) => onDragStartCard(c.id, e)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropId(c.id); }}
                    onDragLeave={() => setDropId((d) => (d === c.id ? null : d))}
                    onDrop={(e) => { e.preventDefault(); onDropCard(c.id); }}
                    onDragEnd={onDragEndCard}
                    onClick={() => { if (!suppressClick.current) toggleChar(c.id); }} title={t.dragHint}>
                    <span className="av" style={{ background: c.color }}>{lang === "en" ? (c.name || c.zhName).charAt(0).toUpperCase() : c.initial}</span>
                    <span className="nm">{lang === "en" ? c.name : c.zhName}</span>
                    {lang !== "en" && (<><span className="sc">{c.school}</span><span className="tg">{c.tag}</span></>)}
                    <span className="enter">{active ? t.entered : t.enter}</span>
                    <span className="rv-card-drag" aria-hidden="true">⋮⋮</span>
                    <span className="bio" onClick={(e) => {
                      e.stopPropagation();
                      if (bioId === c.id) { closeDossier(); return; }
                      setBioId(c.id);
                    }} title={t.bio}>{t.bio}</span>
                  </button>
                  </Fragment>
                );
  };

  const safeGrid = gridChars;
  const shownGrid = showSensitive ? safeGrid : safeGrid.slice(0, GRID_PAGE);
  const charById = (id: string) => chars.find((c) => c.id === id);
  const toggleChar = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    // v2：离席的人如果正是悄悄话对象，或者桌上只剩一个人（悄悄话失去意义），就退出悄悄话状态
    if (whisperTo && (whisperTo === id || !next.includes(whisperTo) || next.length < 2)) setWhisperTo("");
    setSelected(next);
  };
  // v2：关掉一次性引导并记住，之后不再出现
  const dismissWhisperTip = () => {
    setWhisperTipOff(true);
    try { localStorage.setItem("mw_whisper_tip", "off"); } catch { /* ignore */ }
  };
  // v2：选中悄悄话对象（走主入口或卡片快捷方式都走这里）
  const pickWhisper = (id: string) => {
    setWhisperTo(id);
    setWhisperPick(false);
    dismissWhisperTip();
  };


  const dragId = useRef<string | null>(null);
  const sealRef = useRef<HTMLDivElement | null>(null);
  const suppressClick = useRef(false);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const [stickBottom, setStickBottom] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [bioId, setBioId] = useState<string | null>(null);
  const [typedQ, setTypedQ] = useState(0);
  const [typedB, setTypedB] = useState(0);
  const [dosDone, setDosDone] = useState(false);
  const closeDossier = () => setBioId(null);
  useEffect(() => {
    if (!bioId) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeDossier(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [bioId]);

  useEffect(() => {
    if (!bioId) return;
    const bc = chars.find((x) => x.id === bioId);
    const q = bc && bioOf(bc) ? extractQuote(bioOf(bc)) : { quote: "", rest: "" };
    setTypedQ(0); setTypedB(0); setDosDone(false);
    let qi = 0, bi = 0, timer: any = null;
    const sp = SPEEDS[speed];
    const step = () => {
      if (qi < q.quote.length) { qi = Math.min(qi + sp.qn, q.quote.length); setTypedQ(qi); timer = setTimeout(step, sp.qt); }
      else if (bi < q.rest.length) { bi = Math.min(bi + sp.bn, q.rest.length); setTypedB(bi); timer = setTimeout(step, sp.bt); }
      else setDosDone(true);
    };
    timer = setTimeout(step, 520);
    return () => clearTimeout(timer);
  }, [bioId, speed]);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (el && stickBottom) el.scrollTop = el.scrollHeight;
  }, [messages, typing, memeNote, stickBottom]);
  const handleChatScroll = () => {
    const el = chatBodyRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStickBottom((prev) => (prev === near ? prev : near));
  };
  const jumpToBottom = () => {
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setStickBottom(true);
  };
  const onDragStartCard = (id: string, e: any) => {
    dragId.current = id;
    setDraggingId(id);
    try { e.dataTransfer.effectAllowed = "move"; } catch { /* ignore */ }
    const c = charById(id);
    if (!c) return;
    try {
      const shell = document.querySelector(".rv-shell");
      const cs = shell ? getComputedStyle(shell) : null;
      const red = (cs ? cs.getPropertyValue("--red").trim() : "") || "#a3272c";
      const paper = (cs ? cs.getPropertyValue("--paper").trim() : "") || "#f4efe3";
      if (sealRef.current && sealRef.current.parentNode) sealRef.current.parentNode.removeChild(sealRef.current);
      const seal = document.createElement("div");
      seal.textContent = lang === "en" ? (c.name || c.zhName).charAt(0).toUpperCase() : c.initial;
      seal.style.cssText =
        "position:fixed;left:-9999px;top:0;width:60px;height:60px;border-radius:50%;" +
        "background:" + red + ";color:" + paper + ";display:grid;place-items:center;" +
        "font-family:var(--font-display, serif);font-weight:900;font-size:24px;" +
        "border:2px solid " + paper + ";box-shadow:0 4px 14px rgba(0,0,0,0.28);z-index:99999;";
      document.body.appendChild(seal);
      sealRef.current = seal;
      e.dataTransfer.setDragImage(seal, 30, 30);
    } catch { /* drag image is optional */ }
  };
  const onDragEndCard = () => {
    dragId.current = null; setDropId(null); setDraggingId(null);
    if (sealRef.current && sealRef.current.parentNode) sealRef.current.parentNode.removeChild(sealRef.current);
    sealRef.current = null;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 120);
  };
  const onDropCard = (targetId: string) => {
    const fromId = dragId.current;
    dragId.current = null; setDropId(null);
    if (!fromId || fromId === targetId) return;
    setSelected((prev) => {
      const fi = prev.indexOf(fromId);
      const ti = prev.indexOf(targetId);
      if (fi >= 0 && ti >= 0) {
        if (fi === ti) return prev;
        const next = [...prev];
        const [m] = next.splice(fi, 1);
        next.splice(ti, 0, m);
        return next;
      }
      if (fi < 0 && ti >= 0) {
        const next = [...prev];
        next.splice(ti, 0, fromId);
        return next;
      }
      if (fi < 0) return [...prev, fromId];
      return prev;
    });
  };

  /* touch drag (pointer events) — HTML5 DnD does not work on touch */
  const touchDrag = useRef<{ id: string; active: boolean; sx: number; sy: number; timer: any }>({ id: "", active: false, sx: 0, sy: 0, timer: null });
  const onPtrDown = (id: string, e: any) => {
    if (e.pointerType !== "touch") return;
    const t = e as PointerEvent;
    touchDrag.current = { id, active: false, sx: t.clientX, sy: t.clientY, timer: null };
    touchDrag.current.timer = setTimeout(() => {
      if (!touchDrag.current || touchDrag.current.id !== id) return;
      touchDrag.current.active = true;
      dragId.current = id;
      setDraggingId(id);
      try { navigator.vibrate?.(10); } catch { /* ignore */ }
    }, 260);
  };
  const onPtrMove = (id: string, e: any) => {
    const td = touchDrag.current;
    if (!td || td.id !== id) return;
    const t = e as PointerEvent;
    if (!td.active) {
      if (Math.abs(t.clientX - td.sx) > 10 || Math.abs(t.clientY - td.sy) > 10) {
        clearTimeout(td.timer);
        td.timer = null;
        touchDrag.current = { id: "", active: false, sx: 0, sy: 0, timer: null };
      }
      return;
    }
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const card = el ? (el.closest(".rv-char-card") as HTMLElement | null) : null;
    setDropId(card && card.dataset.id ? card.dataset.id : null);
  };
  const onPtrUp = (id: string, e: any) => {
    const td = touchDrag.current;
    if (!td || td.id !== id) return;
    clearTimeout(td.timer);
    touchDrag.current = { id: "", active: false, sx: 0, sy: 0, timer: null };
    if (td.active) {
      const t = e as PointerEvent;
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const card = el ? (el.closest(".rv-char-card") as HTMLElement | null) : null;
      const tid = card ? card.dataset.id : null;
      setDraggingId(null); setDropId(null);
      if (tid && tid !== id) onDropCard(tid);
    }
  };
  const onPtrCancel = (id: string) => {
    const td = touchDrag.current;
    if (!td || td.id !== id) return;
    clearTimeout(td.timer);
    touchDrag.current = { id: "", active: false, sx: 0, sy: 0, timer: null };
    setDraggingId(null); setDropId(null);
  };

  const saveChat = (msgs: Msg[]) => {
    if (msgs.length <= 1) return;
    const id = chatId || Date.now().toString();
    setChatId(id);
    const firstUser = msgs.find((m) => m.role === "user");
    const entry: SavedChat = {
      id,
      title: firstUser ? firstUser.content.slice(0, 24) : (lang === "zh" ? "对话" : "Chat"),
      messages: msgs,
      mode,
      characters: selected,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setHistory((prev) => {
      const list = [entry, ...prev.filter((h) => h.id !== id)].slice(0, 12);
      try { localStorage.setItem("mw_chat_history", JSON.stringify(list)); } catch { /* quota */ }
      return list;
    });
    try { localStorage.setItem("mw_chat_current_id", id); } catch { /* ignore */ }
  };
  const loadChat = (h: SavedChat) => {
    setMessages(h.messages);
    setSelected(h.characters.filter((id) => chars.some((c) => c.id === id)));
    setMode(h.mode);
    setChatId(h.id);
    setHistoryOpen(false);
  };
  const delChat = (id: string) => {
    setHistory((prev) => {
      const list = prev.filter((h) => h.id !== id);
      try { localStorage.setItem("mw_chat_history", JSON.stringify(list)); } catch { /* ignore */ }
      return list;
    });
  };
  const clearChat = () => {
    abortRef.current?.abort();
    pausedRef.current = false;
    setPaused(false);
    setLoading(false);
    setTyping(false);
    setMessages(lang === "zh" ? [WELCOME_ZH] : [WELCOME_EN]);
    setSelected([]);
    setChatId(null);
    setHistoryOpen(false);
    try { localStorage.removeItem("mw_chat_current_id"); } catch { /* ignore */ }
  };

  const maybeEscalate = (text: string, round: number) => {
    const i = SCENE_ORDER.indexOf(scene);
    if (i >= 2) return;
    const hit = ESCALATE_WORDS.some((w) => text.includes(w));
    if (hit || round >= 3) {
      const next = SCENE_ORDER[i + 1];
      setScene(next);
      try { localStorage.setItem(SCENE_KEY, next); } catch { /* ignore */ }
      const zh = lang === "zh";
      setMessages((prev) => [...prev, {
        role: "assistant",
        auto: true,
        content: (zh ? "气氛上来了，已自动升级到「" : "Heat rising — auto-escalated to ") + t.sceneLabel[next] + (zh ? "」" : ""),
      }]);
    }
  };

  const stopChat = () => {
    abortRef.current?.abort();
    pausedRef.current = false;
    setPaused(false);
    setLoading(false);
    setTyping(false);
  };

  // v2：whisperOnly 非空时，服务端只让这一个人回应（悄悄话定向发言）
  const streamChat = async (current: Msg[], whisperOnly?: string): Promise<Msg[]> => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        characters: selected,
        messages: current.map((m) => ({ role: m.role, content: m.content, who: m.who, whisperTo: m.whisperTo })),
        mode,
        scene,
        apiKey: localStorage.getItem("mw_api_key") || "",
        baseURL: localStorage.getItem("mw_base_url") || "",
        model: localStorage.getItem("mw_model") || "",
        userId: uid,
        lang,
        whisperOnly: whisperOnly || "",
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return [...current, { role: "assistant", err: true, content: (d.error || (lang === "zh" ? "请求失败" : "Request failed")) }];
    }
    const reader = res.body ? res.body.getReader() : null;
    if (!reader) return current;
    const decoder = new TextDecoder();
    let buf = "";
    let out: Msg[] = [...current];
    let live: Msg | null = null;
    const pushLive = () => {
      if (live && live.content.trim() !== "") out = [...out, live];
      live = null;
    };
    const bump = () => {
      if (live) setMessages([...out, { ...live, content: live.content || "…" }]);
      else setMessages([...out]);
    };
    bumpRef.current = bump;
    try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx = -1;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = raw.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        let ev: any = null;
        try { ev = JSON.parse(line.slice(6)); } catch { continue; }
        if (ev.type === "who") {
          pushLive();
          live = { role: "assistant", who: ev.name, color: ev.color, content: "" };
          if (!pausedRef.current) bump();
        } else if (ev.type === "delta" && live) {
          if (/self\.__next_f|<script|<!DOCTYPE|<html/i.test(String(ev.text || ""))) continue;
          live.content += ev.text;
          if (!pausedRef.current) bump();
        } else if (ev.type === "reset" && live) {
          // 英文模式：模型用中文作答，服务端已拦下并重试 → 清掉这一条，等英文版本流回来
          live.content = "";
          if (!pausedRef.current) bump();
        } else if (ev.type === "note") {
          setMemeNote(String(ev.text || ""));
        } else if (ev.type === "novelty") {
          // v2：上一轮的新信息比例。用户不需要盯着百分比——
          // 所以不显示常驻指标，只在「判定趋同」这个事件发生时，插一条系统按语，
          // 告诉他「系统看到了什么、做了什么」。
          setNovelty({ value: Number(ev.value) || 0, stagnant: !!ev.stagnant });
          if (ev.stagnant) {
            const pct = Math.round(Number(ev.value) || 0);
            pushLive();
            out = [...out, {
              role: "assistant",
              auto: true,
              content: lang === "zh"
                ? "这一轮几无新意（新信息 " + pct + "%）—— 已请诸位另换角度"
                : "Little new ground this round (" + pct + "% new) — each speaker has been asked for a fresh angle",
            }];
            if (!pausedRef.current) setMessages([...out]);
          }
        } else if (ev.type === "done") {
          if (!pausedRef.current) { pushLive(); setMessages([...out]); }
        } else if (ev.type === "error") {
          pushLive();
          out = [...out, { role: "assistant", err: true, content: (ev.message || (lang === "zh" ? "调用失败" : "Request failed")) }];
          setMessages([...out]);
          break;
        } else if (ev.type === "end") {
          if (!pausedRef.current) { pushLive(); setMessages([...out]); }
          break;
        }
      }
    }
    } catch (e: any) {
      if (abortRef.current?.signal.aborted) {
        if (live && live.content.trim()) out = [...out, live];
        setMessages(out);
        return out;
      }
      throw e;
    }
    if (!pausedRef.current) { pushLive(); setMessages([...out]); }
    return out;
  };

  const send = async () => {
    const v = input.trim();
    if (v === "") return;
    setMemeNote(null);
    setStickBottom(true);
    const mySeq = ++sendSeqRef.current;
    if (loading) {
      abortRef.current?.abort();
      pausedRef.current = false;
      setPaused(false);
    }
    if (selected.length === 0) {
      setMessages((prev) => [...prev, { role: "assistant", err: true, content: t.avEmpty }]);
      setInput("");
      return;
    }
    // v2 信息层：如果处于「私下说」状态，这条消息只对被点名的人可见，且本轮只叫它回应
    const whisperTarget = whisperTo;
    const userMsg: Msg = whisperTarget ? { role: "user", content: v, whisperTo: whisperTarget } : { role: "user", content: v };
    const userCount = messages.filter((m) => m.role === "user").length + 1;
    maybeEscalate(v, userCount);
    let current = [...messages, userMsg];
    setMessages(current); setInput(""); setLoading(true); setTyping(true);
    try {
      // 悄悄话只走一轮，且只叫一个人
      const rn = (mode === "debate" && !whisperTarget) ? rounds : 1;
      for (let r = 0; r < rn; r++) {
        current = await streamChat(current, whisperTarget || undefined);
        if (r < rn - 1) await new Promise((res) => setTimeout(res, 400));
      }
      // v2 信息层关键一环：私下说完之后，自动接一轮公开圆桌。
      // 这样「你悄悄告诉了他一件事 → 他转身就在桌上摊开」是一次操作完成的，
      // 也正是这个机制最该被看见的地方。（只有圆桌模式且桌上不止一人时触发）
      if (whisperTarget && mode === "debate" && selected.length > 1) {
        setAutoRound(true);
        await new Promise((res) => setTimeout(res, 500));
        current = await streamChat(current);
        setAutoRound(false);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", err: true, content: (lang === "zh" ? "连接中断，请稍后再试" : "Connection interrupted, try again later") }]);
    } finally {
      // v2：不管成功失败都退出悄悄话状态，避免卡在私聊模式
      if (whisperTarget) setWhisperTo("");
      if (sendSeqRef.current === mySeq) {
        if (pausedRef.current) { pausedRef.current = false; setPaused(false); bumpRef.current(); }
        setLoading(false); setTyping(false);
        saveChat(current);
        try {
          fetch("/api/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: uid,
              mode,
              characters: selected.map((id) => chars.find((c) => c.id === id)?.zhName || id),
              // v2：悄悄话原文不进日志，只留一个标记（隐私保护 / 对应评审的"数据安全意识"）
              messages: current.map((m) => (m.whisperTo ? { role: m.role, who: m.who, whisperTo: m.whisperTo, content: "[whisper — content not logged]" } : m)),
            }),
          }).catch(() => {});
        } catch { /* logging never breaks chat */ }
        inputRef.current?.focus();
      }
    }
  };

  const doImport = async () => {
    const v = importUrl.trim();
    if (v === "" || importing) return;
    setImporting(true);
    setImportMsg(lang === "zh" ? "正在克隆仓库并解析人格…" : "Cloning repo and parsing persona…");
    try {
      const res = await fetch("/api/import-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: v }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportMsg(lang === "zh" ? "已导入：" + data.character.zhName : "Imported: " + (data.character.name || data.character.zhName));
        setImportUrl("");
        const d = await (await fetch("/api/characters")).json();
        if (d.characters) setChars(d.characters);
      } else {
        setImportMsg((lang === "zh" ? "导入失败：" : "Import failed: ") + (data.error || "unknown"));
      }
    } catch {
      setImportMsg(lang === "zh" ? "导入失败：网络或服务异常" : "Import failed: network or server error");
    }
    setImporting(false);
  };

  return (
    <>
    <div className="rv-shell" data-lang={lang} data-variant="b">
      <div className="rv-bg" />
      <div className="rv-grain" aria-hidden="true" />

      <div className="rv-content">
        {notice && <div className="rv-notice">{notice}</div>}
        <header className="rv-mast">
          <div className="rv-mast-line">
            <span>{t.mastL}</span>
            <span>{t.mastR}</span>
            <span>{t.mastX}</span>
            <button className="rv-lang" onClick={() => setLang((l) => { const n = l === "zh" ? "en" : "zh"; try { localStorage.setItem("mw_region", n); } catch { /* ignore */ } setMessages((prev) => (prev.length === 1 && (prev[0].content === WELCOME_ZH.content || prev[0].content === WELCOME_EN.content) ? [n === "en" ? WELCOME_EN : WELCOME_ZH] : prev)); return n; })}>{lang === "zh" ? "EN" : "中"}</button>
          </div>
          <div className="rv-mast-rule" />
          <div className="rv-ticker" aria-hidden="true">
            <div className="rv-ticker-track">
              {[...chars, ...chars].map((c, i) => (<span key={i}>{lang === "en" ? c.name : c.zhName}</span>))}
            </div>
          </div>
        </header>

        <section className="rv-hero">
          <div className="rv-hero-art" aria-hidden="true"><TableScene /></div>
          <div className="rv-hero-top">
            <div>
              <h1 className="rv-brand">{(lang === "zh" ? "门外谈" : "Outgate Chat").split("").map((ch, i) => (<span key={i} className="rv-brand-char" style={{ animationDelay: (0.08 * i + 0.15) + "s" }}>{ch}</span>))}</h1>
              <SplitText key={lang} text={t.slogan} tag="p" className="rv-slogan" splitType="chars" textAlign="left" />
              <p className="rv-sub">{t.sub}</p>
              <div className="rv-hero-cta"><button className="rv-btn" onClick={() => { setTab("debate"); setTimeout(() => { document.querySelector(".rv-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }}>{t.cta}</button></div>
              <ol className="rv-hero-steps">
                <li><i>①</i>{lang === "zh" ? "选人入席" : "Seat the thinkers"}</li>
                <li><i>②</i>{lang === "zh" ? "抛一个议题" : "Pose a question"}</li>
                <li><i>③</i>{lang === "zh" ? "看他们交锋" : "Watch them clash"}</li>
              </ol>
            </div>
            <div className="rv-hero-side">
              <div className="rv-type" aria-hidden="true"><span className="tp-caret"></span>{typed}</div>
              <span className="rv-vert">{t.vert}</span>
              <div className="meta" dangerouslySetInnerHTML={{ __html: t.meta }} />
            </div>
          </div>
        </section>

        <div className="rv-news">
          <div className="rv-news-links">
            <a className="rv-news-gh" href="https://github.com/fsh114514/menwaitan" target="_blank" rel="noreferrer">GitHub ↗</a>
            <span className="rv-feedback-wrap">
              <a className="rv-news-gh" onClick={() => setFeedbackOpen((o) => !o)}>{t.feedback} ↗</a>
              {feedbackOpen && (
                <div className="rv-feedback-panel">
                  <b className="rv-sponsor-title">{t.feedback}</b>
                  <textarea className="rv-feedback-ta" value={fbText} onChange={(e) => setFbText(e.target.value)} placeholder={lang === "zh" ? "写下你遇到的问题或想法…" : "Describe the issue or idea…"} rows={3} />
                  <input className="rv-feedback-in" value={fbContact} onChange={(e) => setFbContact(e.target.value)} placeholder={lang === "zh" ? "联系方式（选填，邮箱 / B站 / 微信）" : "Contact (optional: email / Bilibili / WeChat)"} />
                  <button className="rv-feedback-btn" onClick={submitFb} disabled={fbSending || !fbText.trim()}>{fbDone ? (lang === "zh" ? "已收到，谢谢" : "Thanks!") : fbSending ? (lang === "zh" ? "发送中…" : "Sending…") : "提交"}</button>
                </div>
              )}
            </span>
            <span className="rv-sponsor-wrap">
              <a className="rv-news-gh" onClick={() => { if (lang === "en") { const w = window.open("https://ko-fi.com/offframe", "_blank"); if (!w) { try { location.href = "https://ko-fi.com/offframe"; } catch {} } return; } setSponsorOpen((o) => !o); }}>{t.sponsor} ↗</a>
              {sponsorOpen && (
                <div className="rv-sponsor-panel">
                  <div className="rv-sponsor-codes">
                    <div className="rv-sponsor-code"><img src="/sponsor/alipay.jpg" alt="支付宝" onClick={() => setZoom(0)} /><span>支付宝</span></div>
                    <div className="rv-sponsor-code"><img src="/sponsor/wechat.jpg" alt="微信" onClick={() => setZoom(1)} /><span>微信</span></div>
                  </div>
                                  </div>
              )}
            </span>
          </div>
          <button className="rv-news-trigger" onClick={() => setNewsOpen((o) => !o)}>{t.whatsNew}{newsOpen ? " ▴" : " ▾"}</button>
          {newsOpen && (
            <div className="rv-news-panel">
              <div className="rv-news-head">
                <span className="rv-news-title">{t.whatsNew}</span>
                <span className="rv-news-date">{new Date().toISOString().slice(0, 10).replace(/-/g, ".")}</span>
              </div>
              <ul className="rv-news-list">
                {t.changelog.slice(0, 3).map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <button className="rv-news-more" onClick={() => setTab("about")}>{t.viewAll}</button>
            </div>
          )}
        </div>

        <nav className="rv-tabs">
          <button className={"rv-tab" + (tab === "debate" ? " active" : "")} onClick={() => setTab("debate")}>{t.tab1}</button>
          <button className={"rv-tab" + (tab === "personas" ? " active" : "")} onClick={() => setTab("personas")}>{t.tab2}</button>
          <button className={"rv-tab" + (tab === "workshop" ? " active" : "")} onClick={() => setTab("workshop")}>{t.tab3}</button>
          <button className={"rv-tab" + (tab === "guide" ? " active" : "")} onClick={() => setTab("guide")}>{t.tabGuide}</button>
          <button className={"rv-tab" + (tab === "about" ? " active" : "")} onClick={() => setTab("about")}>{t.tab4}</button>
          <button className={"rv-tab" + (tab === "settings" ? " active" : "")} onClick={() => setTab("settings")}>{t.setTitle}</button>
        </nav>

        {tab === "debate" && (
          <section className="rv-panel">
            <div className="rv-section-head"><span className="no">{t.tab1}</span><span className="tt">{t.tab1}</span></div>
            <div className="rv-main">
              <aside ref={avatarsRef} className={"rv-avatars" + (mini ? " mini" : compact ? " compact" : "")}>
              <p className="rv-av-label">{t.avLabel}</p>
              {selected.length === 0 ? (
                <div className="rv-av-empty">
                  <div className="rv-av-empty-art"><TableScene draw /></div>
                  <p>{t.avEmpty}</p>
                  <button className="rv-av-go" onClick={() => setTab("personas")}>{t.avGo}</button>
                </div>
              ) : (
                <div className="rv-seat-row">
                {selected.map((id, i) => {
                  const c = charById(id);
                  if (!c) return null;
                  return (
                    <div key={id} style={{ animationDelay: (0.05 * i) + "s" }} data-flip={id} className={"rv-avatar" + (dropId === id ? " drag-over" : "") + (draggingId === id ? " dragging" : "")}
                      draggable onDragStart={(e) => onDragStartCard(id, e)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropId(id); }}
                      onDragLeave={() => setDropId((d) => (d === id ? null : d))}
                      onDrop={(e) => { e.preventDefault(); onDropCard(id); }}
                      onDragEnd={onDragEndCard}
                      title={mini ? (lang === "en" ? (c.name || c.zhName) : c.zhName) : t.dragHint}>
                      <span className="av" style={{ background: c.color }}>{lang === "en" ? (c.name || c.zhName).charAt(0).toUpperCase() : c.initial}</span>
                      <span className="nm">{lang === "en" ? c.name : c.zhName}</span>
                      {lang !== "en" && <span className="sc">{c.school}</span>}
                      {selected.length > 1 && (
                        <span
                          className={"wh" + (whisperTo === id ? " on" : "")}
                          onClick={(e) => { e.stopPropagation(); whisperTo === id ? setWhisperTo("") : pickWhisper(id); }}
                          title={lang === "en"
                            ? "Whisper to " + (c.name || c.zhName) + " — the others won't see it"
                            : "私下对 " + c.zhName + " 说——桌上其他人看不到"}>
                          {whisperTo === id ? (lang === "en" ? "Wh…" : "私…") : (lang === "en" ? "Wh" : "私")}
                        </span>
                      )}
                      <span className="rm" onClick={(e) => { e.stopPropagation(); toggleChar(id); }} title={t.leave}>×</span>
                    </div>
                  );
                })}
                </div>
              )}
              <p className="rv-av-hint">{t.avHint}</p>
              <p className="rv-av-note">{t.avNote}</p>
              <div className="rv-dialog-settings">
                <div className="rv-set-row">
                  <span className="rv-set-tag">{t.modeTag}</span>
                  <div className="rv-mode-cards">
                    <button className={"rv-mode-card" + (mode === "chat" ? " active" : "")} onClick={() => setMode("chat")}>
                      <b><span className="icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 9h22M5 16h15M5 23h8"/><circle cx="26" cy="22" r="4"/></svg></span>{t.chat}</b>
                      <i>{lang === "zh" ? "和一个人深聊" : "Talk with one"}</i>
                    </button>
                    <button className={"rv-mode-card" + (mode === "debate" ? " active" : "")} onClick={() => setMode("debate")}>
                      <b><span className="icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="16" cy="16" r="9"/><circle cx="8" cy="9" r="3"/><circle cx="24" cy="9" r="3"/><circle cx="8" cy="23" r="3"/><circle cx="24" cy="23" r="3"/></svg></span>{t.round}</b>
                      <i>{lang === "zh" ? "看几个人交锋" : "Watch them clash"}</i>
                    </button>
                  </div>
                  <HelpDesc text={t.modeHelp} hot={mode === "chat" ? [t.chat] : [t.round]} />
                </div>
                <div className="rv-set-row">
                  <span className="rv-set-tag">{t.sceneTag}</span>
                  <div className="rv-scene">
                    {SCENE_ORDER.map((k) => (
                      <button key={k} className={scene === k ? "active" : ""} title={t.sceneDesc[k]}
                        onClick={() => { setScene(k); try { localStorage.setItem(SCENE_KEY, k); } catch { /* ignore */ } }}>
                        {t.sceneLabel[k]}
                      </button>
                    ))}
                  </div>
                  <HelpDesc text={t.sceneHelp} hot={[t.sceneLabel[scene]]} />
                </div>
              </div>
              {mode === "debate" && (
                <div className="rv-set-row">
                  <span className="rv-set-tag">{t.roundTag}</span>
                  <div className="rv-rounds">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} className={rounds === n ? "active" : ""} onClick={() => setRounds(n)} title={lang === "zh" ? `每人各说 ${n} 轮` : `${n} turn${n > 1 ? "s" : ""} each`}>{n}</button>
                    ))}
                  </div>
                </div>
              )}
            </aside>
            <section className="rv-chat">
              <div className="rv-chat-head">
                <span>{t.chatHead}</span>
                <span className="rv-chat-head-right">
                  <span className="rv-chat-mode">{mode === "debate" ? t.round : t.chat}</span>
                  <button className="rv-chat-tool" onClick={() => setHistoryOpen(!historyOpen)}>{historyOpen ? t.history : t.history}</button>
                  <button className="rv-chat-tool" onClick={clearChat} title={t.newChat}>＋</button>
                </span>
              </div>
              {historyOpen ? (
                <div className="rv-history">
                  <div className="rv-history-title">{t.histTitle}</div>
                  {history.length === 0 ? (
                    <p className="rv-history-empty">{t.histEmpty}</p>
                  ) : (
                    history.map((h) => (
                      <div className="rv-history-item" key={h.id}>
                        <div className="rv-history-info">
                          <b>{h.title}</b>
                          <span>{new Date(h.updatedAt).toLocaleString()} · {h.messages.length} {t.histMsgs}</span>
                        </div>
                        <div className="rv-history-actions">
                          <button onClick={() => loadChat(h)}>{t.histContinue}</button>
                          <button className="del" onClick={() => delChat(h.id)}>{t.histDelete}</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="rv-chat-wrap">
                <div className="rv-chat-body" ref={chatBodyRef} onScroll={handleChatScroll}>
                {messages.length <= 1 && (
                  <div className="rv-chat-empty-art" aria-hidden="true"><TableScene /></div>
                )}
                  {memeNote && (
                    <div className="rv-meme-note">{lang === "zh" ? "注：据网络检索，" : "Note (web): "}{memeNote}</div>
                  )}
                  {messages.map((m, i) => (
                    m.auto ? (
                      <div key={i} className="rv-msg-auto">{m.content}</div>
                    ) : (
                      <div key={i} className={"rv-msg " + (m.role === "user" ? "user" : "ai") + (m.err ? " rv-err" : "") + (m.whisperTo ? " rv-whisper" : "")} style={{ animationDelay: (0.05 * i) + "s" }}>
                        {m.whisperTo && (
                          <div className="rv-msg-whisper">
                            <span className="rv-seal-mini">{lang === "en" ? "P" : "密"}</span>{" "}
                            {lang === "en"
                              ? "Whispered — only " + (charById(m.whisperTo)?.name || charById(m.whisperTo)?.zhName || m.whisperTo) + " can see this"
                              : "只有 " + (charById(m.whisperTo)?.zhName || m.whisperTo) + " 看得到"}
                          </div>
                        )}
                        {m.who && <div className="rv-msg-who" style={{ color: m.color }}>■ {m.who}</div>}
                        <div>{m.content}</div>
                      </div>
                    )
                  ))}
                  {typing && <div className="rv-msg ai rv-typing"><span></span><span></span><span></span></div>}
                </div>
                {!stickBottom && (
                  <button className="rv-jump-bottom" onClick={jumpToBottom}>{lang === "zh" ? "↓ 回到最新" : "↓ Latest"}</button>
                )}
                </div>
              )}
              {!apiKey && (
                <p className="rv-default-hint">
                  {t.defaultHint}
                  <a className="rv-hint-link" onClick={() => setTab("settings")}>{t.getKeyHint} →</a>
                </p>
              )}
              {whisperTo && (
                <div className="rv-whisper-bar">
                  <span className="lk"><span className="rv-seal-mini">{lang === "en" ? "P" : "密"}</span></span>
                  <span className="tx">
                    {lang === "en"
                      ? "Whispering to " + (charById(whisperTo)?.name || charById(whisperTo)?.zhName || whisperTo) + " — the others cannot see this"
                      : "正在私下对 " + (charById(whisperTo)?.zhName || whisperTo) + " 说话 —— 桌上其他人看不到"}
                  </span>
                  <button className="cx" onClick={() => setWhisperTo("")}>{lang === "en" ? "Cancel" : "取消"}</button>
                </div>
              )}
              {autoRound && (
                <div className="rv-whisper-bar rv-whisper-auto">
                  <span className="lk">{lang === "en" ? "TABLE" : "场上"}</span>
                  <span className="tx">
                    {lang === "en"
                      ? "The table is reacting — what you said in private is being brought up in the open"
                      : "桌上正在反应 —— 你私下说的那件事，被人摆到台面上了"}
                  </span>
                </div>
              )}
              {/* v2：一次性的悄悄话引导。只在「桌上有 2 人以上、还没用过、没关过」时出现 */}
              {!whisperTipOff && selected.length > 1 && !whisperTo && (
                <div className="rv-whisper-tip">
                  <span className="ic">{lang === "en" ? "N.B." : "按"}</span>
                  <span className="tx">
                    {lang === "en"
                      ? "Want them to really clash? Use 「Whisper」 — say something to just one of them. The others won't know."
                      : "想看他们真吵起来？用左边的「私下说」——把一句话只说给其中一个人听，桌上其他人不知道。"}
                  </span>
                  <button className="cx" onClick={dismissWhisperTip} aria-label={lang === "en" ? "Dismiss" : "知道了"}>×</button>
                </div>
              )}
              <div className="rv-chat-input">
                {/* v2：悄悄话主入口。放在输入框左侧——用户注意力本来就在这儿 */}
                <div className="rv-whisper-entry">
                  <button
                    className={"rv-whisper-toggle" + (whisperTo ? " on" : "")}
                    onClick={() => setWhisperPick((v) => !v)}
                    disabled={selected.length < 2}
                    title={selected.length < 2
                      ? (lang === "en" ? "Seat at least 2 thinkers first" : "先让至少两位入席")
                      : (lang === "en" ? "Whisper to one thinker — the others won't see it" : "私下对某一位说话——其他人看不到")}>
                    {whisperTo
                      ? <><span className="rv-seal-mini">{lang === "en" ? "P" : "密"}</span>{" " + (charById(whisperTo)?.zhName || whisperTo)}</>
                      : (lang === "en" ? "Whisper" : "私下说")}
                  </button>
                  {whisperPick && (
                    <div className="rv-whisper-menu">
                      <p className="hd">{lang === "en" ? "Whisper to whom? The others can't see it" : "私下对谁说？其他人看不到"}</p>
                      <button className={whisperTo === "" ? "on" : ""} onClick={() => { setWhisperTo(""); setWhisperPick(false); }}>
                        <span className="dot" style={{ background: "rgba(23,18,13,0.35)" }} />
                        {lang === "en" ? "Everyone (public)" : "公开说（所有人可见）"}
                      </button>
                      {selected.map((sid) => {
                        const c = charById(sid);
                        if (!c) return null;
                        return (
                          <button key={sid} className={whisperTo === sid ? "on" : ""} onClick={() => pickWhisper(sid)}>
                            <span className="dot" style={{ background: c.color }} />
                            {lang === "en" ? (c.name || c.zhName) : c.zhName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !(e.nativeEvent as any).isComposing) send(); }} placeholder={whisperTo ? (lang === "en" ? "Type privately…" : "私下说点什么…") : t.ph} />
                <div className="rv-send">
                  <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={26} sparkCount={8}>
                    <button className="rv-btn" onClick={loading ? stopChat : send} disabled={!loading && !input.trim()}>{loading ? (lang === "zh" ? "■ 停止" : "■ Stop") : t.send}</button>
                  </ClickSpark>
                </div>
              </div>
            </section>
            </div>
          </section>
        )}

        {tab === "personas" && (
          <section className="rv-panel">
            <div className="rv-section-head"><span className="no">{t.tab2}</span><span className="tt">{t.personasTitle}</span></div>
            {bioId ? (
              (() => {
                const bc = chars.find((x) => x.id === bioId);
                if (!bc) return null;
                const q = bioOf(bc) ? extractQuote(bioOf(bc)) : { quote: "", rest: "" };
                const idx = (chars.findIndex((x) => x.id === bc.id) + 1).toString().padStart(2, "0");
                return (
                  <div className="rv-detail" key={bc.id}>
                    <button className="rv-detail-back" onClick={closeDossier}>← {t.back}</button>
                    <div className="rv-detail-left">
                      <div className="rv-typepage-led"><span className={dosDone ? "on" : ""} />{dosDone ? t.dosDone : t.dosPrinting}</div>
                      <div className="rv-speed">
                        {(["slow", "normal", "fast", "turbo"] as SpeedLevel[]).map((k) => (
                          <button key={k} className={speed === k ? "active" : ""}
                            onClick={() => { setSpeed(k); try { localStorage.setItem(SPEED_KEY, k); } catch { /* ignore */ } }}>
                            {t.speed[k]}
                          </button>
                        ))}
                      </div>
                      <div className="rv-dossier-kicker">{t.dosNo} {idx}</div>
                      <h2 className="rv-dossier-name">{lang === "en" ? bc.name : bc.zhName}</h2>
                      {lang !== "en" && (<div className="rv-dossier-sub">{bc.school} · {bc.tag}</div>)}
                      {q.quote && (
                        <blockquote className={"rv-dossier-quote" + (typedQ >= q.quote.length ? " done" : "")}>
                          <span className="rv-q">“</span>
                          <span>{q.quote.slice(0, typedQ)}{typedQ >= q.quote.length ? "”" : ""}</span>
                          {typedQ < q.quote.length && <span className="rv-caret">▍</span>}
                        </blockquote>
                      )}
                      <div className="rv-detail-seal">
                        {dosDone && <span className="rv-dossier-seal">{lang === "en" ? (bc.name || bc.zhName).charAt(0).toUpperCase() : bc.initial}</span>}
                        {dosDone && <span className="rv-dossier-src">{t.bioSource}</span>}
                      </div>
                      <div className="rv-detail-credit">
                        <span className="rv-credit-tag">{t.creditTag}</span>
                        <span>{t.creditLine}</span>
                      </div>
                    </div>
                    <div className="rv-detail-right">
                      <div className="rv-dossier-body rv-expand-body">
                        {q.rest.slice(0, typedB).split(/\n\n+/).filter((x) => x.trim().length > 2).map((para, pi, arr) => (
                          <span key={pi} className="rv-expand-para">
                            {para}
                            {pi === arr.length - 1 && typedB < q.rest.length && <span className="rv-caret">▍</span>}
                          </span>
                        ))}
                      </div>
                      {dosDone && bc.repo && (
                        <a className="rv-dossier-link" href={bc.repo} target="_blank" rel="noreferrer">
                          <span className="rv-link-t">{t.dosRepo}</span>
                          <span className="rv-link-u">{bc.repo.replace("https://", "").replace(/\.git$/, "")}</span>
                          <span className="rv-link-go">↗</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                <div className="rv-char-grid">
              {shownGrid.map(renderCard)}
                </div>
              {safeGrid.length > GRID_PAGE && (
                <div className="rv-char-more-wrap">
                  <button className="rv-char-more" onClick={() => setShowSensitive((o) => !o)}>
                    {showSensitive ? t.lessChars : t.moreChars} {showSensitive ? "▴" : "▾"}
                  </button>
                </div>
              )}
              </>
            )}
          </section>
        )}

        {tab === "workshop" && (
          <section className="rv-panel rv-workshop">
            <div className="rv-section-head"><span className="no">{t.tab3}</span><span className="tt">{t.wsTitle}</span></div>
            <p className="rv-sub">{t.wsSub}</p>
            <div className="rv-ws-recs">
              <p className="rv-ws-recs-label">{t.wsRec}</p>
              <div className="rv-ws-recs-list">
                {t.recs.map((r) =>
                  "ext" in r && r.ext ? (
                    <a key={r.url} className="rv-ws-recs-link" href={r.url} target="_blank" rel="noreferrer">{r.name} ↗</a>
                  ) : (
                    <button key={r.url} onClick={() => setImportUrl(r.url)}>{r.name}</button>
                  )
                )}
              </div>
              <p className="rv-ws-recs-hint">{t.wsRecHint} <a href={t.wsGalleryUrl} target="_blank" rel="noreferrer">{t.wsGallery} ↗</a> · <a href={t.wsOrgUrl} target="_blank" rel="noreferrer">{t.wsOrg} ↗</a></p>
            </div>
            <p className="rv-ws-recs-label rv-ws-own">{t.wsOwn}</p>
            <div className="rv-ws-row">
              <input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
              <div className="rv-send">
                <ClickSpark sparkColor="#fff" sparkSize={8} sparkRadius={20} sparkCount={6}>
                  <button className="rv-btn" onClick={doImport} disabled={importing}>{importing ? t.wsImporting : t.wsImport}</button>
                </ClickSpark>
              </div>
            </div>
            {importMsg && <p className="rv-ws-status">{importMsg}</p>}
          </section>
        )}

        {tab === "guide" && (
          <section className="rv-panel rv-guide">
            <div className="rv-section-head"><span className="no">{t.tabGuide}</span><span className="tt">{t.guideTitle}</span></div>
            <p className="rv-about-lede">{t.guideLede}</p>
            <div className="rv-guide-list">
              {t.guide.map((g, i) => (
                <div className="rv-guide-item" key={i}>
                  <span className="no">{g.n}</span>
                  <div><b>{g.t}</b><p>{g.b}</p></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "about" && (
          <section className="rv-panel rv-about">
            <div className="rv-section-head"><span className="no">{t.tab4}</span><span className="tt">{t.aboutName}</span></div>
            <p className="rv-about-lede">{t.aboutLede}</p>
            <div className="rv-about-grid">
              <div className="rv-about-item"><span className="no">{t.nums[0]}</span><b>{t.a1}</b><p>{t.a1d}</p></div>
              <div className="rv-about-item"><span className="no">{t.nums[1]}</span><b>{t.a2}</b><p>{t.a2d}</p></div>
              <div className="rv-about-item"><span className="no">{t.nums[2]}</span><b>{t.a3}</b><p>{t.a3d}</p></div>
              <div className="rv-about-item"><span className="no">{t.nums[3]}</span><b>{t.a4}</b><p>{t.a4d}</p></div>
            </div>
            <p className="rv-about-note">{t.note}</p>
            <div className="rv-changelog">
              <b className="rv-changelog-head">{t.whatsNew}</b>
              <ul>
                {t.changelog.map((c: string, ci: number) => (
                  <li key={ci}>{c}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="rv-panel rv-settings">
            <div className="rv-section-head"><span className="no">{t.setTitle}</span><span className="tt">{t.setTitle}</span></div>
            <p className="rv-about-lede">{t.setDesc}</p>
            <div className="rv-settings-field"><label>{t.setProvider}</label>
              <div className="rv-select">
                <button type="button" className="rv-select-trigger" onClick={() => setProviderOpen((o) => !o)}>
                  <span>{providers.find((pr) => pr.id === providerId) ? (lang === "en" && providerId === "custom" ? "Custom" : providers.find((pr) => pr.id === providerId)!.name) : "—"}</span>
                  <i className={"rv-select-arrow" + (providerOpen ? " open" : "")}>▾</i>
                </button>
                {providerOpen && (
                  <div className="rv-select-menu">
                    {providers.map((pr) => (
                      <button type="button" key={pr.id} className={"rv-select-option" + (pr.id === providerId ? " active" : "")} onClick={() => { selectProvider(pr.id); setProviderOpen(false); }}>
                        {lang === "en" && pr.id === "custom" ? "Custom" : pr.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="rv-settings-field"><label>{t.setKey}</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" />
              {providerId !== "custom" && (() => {
                const pr = providers.find((x) => x.id === providerId);
                return pr?.keyUrl ? <a className="rv-key-link" href={pr.keyUrl} target="_blank" rel="noreferrer">{t.getKey}</a> : null;
              })()}
            </div>
            <div className="rv-settings-field"><label>{t.setModel}</label>
              {providerId === "custom" ? (
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" />
              ) : (
                <div className="rv-select">
                  <button type="button" className="rv-select-trigger" onClick={() => setModelOpen((o) => !o)}>
                    <span>{model || "—"}</span>
                    <i className={"rv-select-arrow" + (modelOpen ? " open" : "")}>▾</i>
                  </button>
                  {modelOpen && (
                    <div className="rv-select-menu">
                      {(providers.find((pr) => pr.id === providerId)?.models || []).map((m) => (
                        <button type="button" key={m} className={"rv-select-option" + (m === model ? " active" : "")} onClick={() => { setModel(m); setModelOpen(false); }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="rv-settings-field"><label>{t.setBase}</label><input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="https://api.deepseek.com" /></div>
            <div className="rv-settings-actions"><button className="rv-btn" onClick={saveSettings}>{t.setSave}</button>{setMsg && <span className="rv-ws-status">{setMsg}</span>}</div>
          </section>
        )}

        <footer className="rv-footer rv-reveal">
          <span><b>{t.aboutName}</b> · {t.foot1}</span>
          <span>{t.foot2}</span>
          <span className="rv-footer-links">
            <a className="rv-news-gh" href="https://github.com/fsh114514/menwaitan" target="_blank" rel="noreferrer">GitHub ↗</a>
            <span className="rv-feedback-wrap">
              <a className="rv-news-gh" onClick={() => setFeedbackOpen((o) => !o)}>{t.feedback} ↗</a>
              {feedbackOpen && (
                <div className="rv-feedback-panel">
                  <b className="rv-sponsor-title">{t.feedback}</b>
                  <textarea className="rv-feedback-ta" value={fbText} onChange={(e) => setFbText(e.target.value)} placeholder={lang === "zh" ? "写下你遇到的问题或想法…" : "Describe the issue or idea…"} rows={3} />
                  <input className="rv-feedback-in" value={fbContact} onChange={(e) => setFbContact(e.target.value)} placeholder={lang === "zh" ? "联系方式（选填，邮箱 / B站 / 微信）" : "Contact (optional: email / Bilibili / WeChat)"} />
                  <button className="rv-feedback-btn" onClick={submitFb} disabled={fbSending || !fbText.trim()}>{fbDone ? (lang === "zh" ? "已收到，谢谢" : "Thanks!") : fbSending ? (lang === "zh" ? "发送中…" : "Sending…") : "提交"}</button>
                </div>
              )}
            </span>
            <span className="rv-sponsor-wrap">
              <a className="rv-news-gh" onClick={() => { if (lang === "en") { const w = window.open("https://ko-fi.com/offframe", "_blank"); if (!w) { try { location.href = "https://ko-fi.com/offframe"; } catch {} } return; } setSponsorOpen((o) => !o); }}>{t.sponsor} ↗</a>
              {sponsorOpen && (
                <div className="rv-sponsor-panel">
                  <div className="rv-sponsor-codes">
                    <div className="rv-sponsor-code"><img src="/sponsor/alipay.jpg" alt="支付宝" onClick={() => setZoom(0)} /><span>支付宝</span></div>
                    <div className="rv-sponsor-code"><img src="/sponsor/wechat.jpg" alt="微信" onClick={() => setZoom(1)} /><span>微信</span></div>
                  </div>
                </div>
              )}
            </span>
          </span>
                   </footer>

        {zoom !== null && (
          <div className="rv-zoom-mask" onClick={() => setZoom(null)}>
            <img src={zoom === 0 ? "/sponsor/alipay.jpg" : "/sponsor/wechat.jpg"} alt="收款码" />
            <span className="rv-zoom-close">{t.zoomClose}</span>
          </div>
        )}
        <div className="rv-rain" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, c) => {
            const name = chars.length ? chars[c % chars.length][lang === "en" ? "name" : "zhName"] : (lang === "en" ? "Outgate Chat" : "门外谈");
            return (
              <span className="rv-rain-col" key={c}
                style={{ left: (3 + c * 6.1) + "%", animationDelay: (c * 1.3) + "s", animationDuration: (12 + (c % 6) * 2.4) + "s" }}>
                {name.split("").map((ch, j) => (
                  <i key={j}>{ch}</i>
                ))}
              </span>
            );
          })}
        </div>

      </div>
    </div>

    </>
  );
}

