"use client";
import { useState, useEffect, useRef, Fragment } from "react";
import { characterMeta as baseChars } from "@/lib/characterMeta";
import SplitText from "@/components/bits/SplitText";
import ClickSpark from "@/components/bits/ClickSpark";
import "./revolution/revolution.css";

type Char = { id: string; zhName: string; name: string; initial: string; school: string; tag: string; color: string; skillDir: string; imported?: boolean; bio?: string; repo?: string };
type Msg = { role: string; who?: string; color?: string; content: string; auto?: boolean; err?: boolean };
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
  zhangxuefeng: 35, fengge: 34, "luo-xiang-skill": 33, "marx-skill": 32, "kongzi-skill": 31, maoxuan: 30, luxun: 29,
  "steve-jobs-skill": 28, "elon-musk-skill": 27, "trump-skill": 26,
  "huchenfeng-skill": 24, "leijun-skill": 20, "huangrenxun-skill": 19, "ace-taffy-skill": 16,
  "buffett-skill": 14, "dalio-skill": 13,
  "nietzsche-skill": 8, "foucault-skill": 7, "beauvoir-skill": 7, "socrates-skill": 6, "wittgenstein-skill": 5,
  "einstein-skill": 4, "turing-skill": 3, hayek: 2, keynes: 2, "plato-skill": 1,
};

const WELCOME_EN: Msg = { role: "ai", who: "Menwai Tan", color: "#c8102e", content: "The round table is set. Pick one or several thinkers, pose a question — they will answer in their own way." };

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
    avEmpty: "还没人入席——去「人物志」点卡片把人请进来",
    avGo: "去人物志请人入席 →",
    personasHint: "点卡片 = 入席；已入席的卡片排前面。拖（手机长按）卡片调整顺序，未入席的拖过去会入席；点「介」看人物介绍",
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
    wsSub: "粘贴一个蒸馏人格格式的 GitHub 仓库地址（仓库根目录含 SKILL.md），即可导入为可对话角色。",
    wsImport: "导入",
    wsImporting: "导入中…",
    wsRec: "更多人物 · 站外现成（点一下填入链接，再点导入）：",
    wsRecHint: "以下人物站内还没有，点按钮填入链接即可导入。想淘更多，去合集页逛一逛。",
    wsOrg: "nuwa-skills 组织",
    wsOrgUrl: "https://github.com/nuwa-skills",
    wsGallery: "合集页",
    wsGalleryUrl: "https://titanwings.github.io/colleague-skill-site/gallery/",
    recs: [
      { name: "titanwings gallery (collection)", url: "https://titanwings.github.io/colleague-skill-site/gallery/", ext: true },
      { name: "Zhuangzi · skill", url: "https://github.com/nuwa-skills/zhuangzi-skill.git" },
      { name: "Hannah Arendt · skill", url: "https://github.com/nuwa-skills/arendt-skill.git" },
      { name: "Ren Zhengfei · skill", url: "https://github.com/nuwa-skills/renzhengfei-skill.git" },
      { name: "Huang Zheng · skill", url: "https://github.com/nuwa-skills/huangzheng-skill.git" },
      { name: "Ding Lei · skill", url: "https://github.com/nuwa-skills/dinglei-skill.git" },
      { name: "65 historical advisors", url: "https://github.com/77cinc/ai-decision-council.git" },
      { name: "Chinese sages · Li Bai/Confucius/Zhuangzi", url: "https://github.com/Yinuo-Guo/dialogues-with-chinese-sages.git" },
      { name: "Sage · guided thinking", url: "https://github.com/Dreamfutura-Stephen/Sage-skill.git" },
      { name: "Confucius 11 classics library", url: "https://github.com/tree3355961795-ops/kongzi-classics.git" },
      { name: "awesome-nuwa picks (collection)", url: "https://github.com/nuwa-skills/awesome-nuwa", ext: true },
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
    changelog: [
      "联网查梗：问「XX 是什么 / 什么意思 / 为什么」时，自动联网检索最新网络梗（必应、360、萌娘百科等多源），回复前附一句「注：据网络检索…」",
      "自由看历史：辩论进行中可上翻查看发言，不再被强制拉回底部；右下角一键回到最新",
      "停止发言：点「⏸ 停止」立即中断回答、保留已说内容，不再一直转圈；新对话不再残留加载",
      "圆桌交锋：先表明立场再给独立理由，不复述不附和，跑题时把话题拉回来",
      "人格校准：10 位思想家回归本人（鲁迅、哈耶克、凯恩斯、柏拉图、尼采等），不再被带偏或变成旁观者",
      "角色自然化：去掉平台层调教，每个角色用自己的方式说话——峰哥会用峰哥的腔调接你的问候",
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
    a4d: "角色人格蒸馏自开源社区项目：dot-skill（colleague-skill）、女娲.skill（awesome-nuwa），以及张雪峰.skill、峰哥、毛选.skill、鲁迅.skill、哈耶克.skill、凯恩斯.skill——向各位作者致谢。",
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
    order: "回答顺序",
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
    modeHelp: "对谈 = 和思想者单独聊；圆桌 = 多位思想者轮流交锋",
    sceneHelp: "交锋 = 回答的长短火候：随口很短、较真适中、上头放开。气氛上来时会自动升级",
    back: "返回人物志",
    guideTitle: "使用教程",
    guideLede: "从零开始，一步步带你玩转门外谈。",
    guide: [
      { n: "壹", t: "选人物", b: "在「人物志」或左侧人物列表里点选角色。选 1 位 = 单人对谈；选 2 位以上 = 圆桌辩论。圆桌时可在辩论室左侧「回答顺序」里调整谁先开口（上移 / 下移）。" },
      { n: "贰", t: "提问", b: "在输入框写下你的问题，点「发言」或按回车。回答会一个字一个字地冒出来——别急，这是 AI 在边想边说。" },
      { n: "叁", t: "切换语言", b: "右上角「EN / 中」一键切换全站中英文。" },
      { n: "肆", t: "用自己的 API Key（可选）", b: "不填也能用（走站点默认）。想用自己的：在任意支持 OpenAI 兼容接口的服务商注册（如 DeepSeek、Moonshot Kimi、智谱、通义、OpenRouter 等）；在它的控制台创建并复制 API Key（一般 sk- 开头）；回到本站「设置」，把 Key 粘贴到「API Key」栏；「Base URL」和「模型」填服务商给你的地址和模型名（每家不同，看它的控制台或文档）；点「保存」。举例：DeepSeek 填 https://api.deepseek.com + deepseek-chat；Kimi 填 https://api.moonshot.cn + moonshot-v1-8k。Key 只存在你自己的浏览器本地，不会上传服务器。" },
      { n: "伍", t: "导入新人物", b: "在「创意工坊」粘贴一个 GitHub 仓库链接，点「导入」，几秒后新人物就出现在人物志。要求：仓库根目录必须有一个 SKILL.md 文件——这是「蒸馏人格」的标准格式。想找现成人物？去 GitHub 搜蒸馏人格 skill 仓库，比如张雪峰、鲁迅、哈耶克等。" },
      { n: "陆", t: "常见问题", b: "没反应？① 检查设置里 API Key / Base URL / 模型是否填对（注意别多空格）；② 清空 Key 试试站点默认；③ 刷新页面重来。导入失败？确认链接是 GitHub 仓库地址，且根目录有 SKILL.md。" },
    ],
    nums: ["壹", "贰", "叁", "肆"],
  },
  en: {
    mastL: "Menwai Tan · Vol. 1",
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
    avEmpty: "No one seated yet — pick thinkers in the Gallery",
    avGo: "Go to Gallery →",
    personasHint: "Click a card to seat a thinker; seated cards move to the front. Drag (long-press on touch) to reorder — dragging an unseated card seats it there; click the bio tag for details.",
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
    chatHead: "Menwai Tan · Debate Room",
    ph: "Pose a question for the thinkers…",
    enter: "Seat →",
    entered: "Seated",
    wsSub: "Paste a distilled-persona GitHub repo URL (SKILL.md at root) to import a new character.",
    wsImport: "Import",
    wsImporting: "Importing…",
    wsRec: "More personas · ready-made repos (click to fill, then Import):",
    wsRecHint: "None of these are in the site yet — click a button to fill the link and import. For more, browse the collections.",
    wsOrg: "nuwa-skills org",
    wsOrgUrl: "https://github.com/nuwa-skills",
    wsGallery: "the gallery",
    wsGalleryUrl: "https://titanwings.github.io/colleague-skill-site/gallery/",
    recs: [
      { name: "titanwings gallery (collection)", url: "https://titanwings.github.io/colleague-skill-site/gallery/", ext: true },
      { name: "Zhang Xuefeng · skill", url: "https://github.com/alchaincyf/zhangxuefeng-skill.git" },
      { name: "Feng Ge · perspective", url: "https://github.com/rottenpen/fengge-wangmingtianya-perspective.git" },
      { name: "Mao Xuan · skill", url: "https://github.com/leezythu/maoxuan-skill.git" },
      { name: "Lu Xun · skill", url: "https://github.com/nuwa-skills/luxun-skill.git" },
      { name: "Hayek · skill", url: "https://github.com/nuwa-skills/hayek-skill.git" },
      { name: "Keynes · skill", url: "https://github.com/nuwa-skills/keynes-skill.git" },
      { name: "Plato · skill", url: "https://github.com/nuwa-skills/plato-skill.git" },
      { name: "Confucius · kongzi-skill", url: "https://github.com/nuwa-skills/kongzi-skill.git" },
      { name: "Marx · marx-skill", url: "https://github.com/Nhj-sz/marx-skill.git" },
      { name: "Confucius · Analects", url: "https://github.com/Wudiyi-bigyi/kongzi-skill.git" },
      { name: "Confucius · teaching", url: "https://github.com/snake-aabb-wtf/confucius.git" },
      { name: "Marx · Capital view", url: "https://github.com/Slzx1/marx-perspective.git" },
      { name: "Marxist classics", url: "https://github.com/TianWai0823/marxist-leninist-skill.git" },
      { name: "65 historical advisors", url: "https://github.com/77cinc/ai-decision-council.git" },
      { name: "Sages: Li Bai, Confucius…", url: "https://github.com/Yinuo-Guo/dialogues-with-chinese-sages.git" },
      { name: "Sage · guided thinking", url: "https://github.com/Dreamfutura-Stephen/Sage-skill.git" },
    ],
    creditTag: "Open-source trained persona",
    creditLine: "Every persona here is carefully trained by open-source developers (SKILL.md distilled personas) — not generated by this site",
    
    aboutLede: "Menwai Tan — invite thinkers across time to the table, each holding their position, debating face to face.",
    a1: "What",
    a1d: "A place to talk and debate with distilled thinkers: Marx, Lu Xun, Hayek… or anyone you wish to bring in.",
    a2: "How",
    a2d: "Pick one or several thinkers → talk one-on-one or round-table debate → pose a question and watch them clash. The Workshop imports any new character.",
    a3: "Origins",
    a3d: "Personas and intros come from the open-source distilled-persona community: personas are distilled from each project SKILL.md, intros are quoted from each project README (copyright to the original authors) — thanks to all the authors.",
    note: "Disclaimer: character dialogues are AI-generated from public materials and do not represent the views of any real person; for thought exchange only.",
    whatsNew: "What's new",
    viewAll: "View all →",
    sponsor: "Support",
    changelog: [
      "Meme lookup: ask what a meme or phrase means (or why), and the thinkers search the web across Bing / 360 / Moegirl for the latest context",
      "Read while debating: scroll back through the discussion freely; jump back to the latest anytime",
      "Stop speaking: the ⏸ stop button truly interrupts and keeps what was said — no more endless loading",
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
    aboutName: "Menwai Tan",
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
    order: "Speaking order",
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
    modeHelp: "One-on-One = talk with a thinker; Round Table = several thinkers take turns clashing",
    sceneHelp: "Clash = how long answers are: Casual is short, Serious is measured, Heated lets loose. It auto-escalates as the heat rises",
    back: "Back to gallery",
    guideTitle: "Quick Guide",
    guideLede: "A step-by-step walkthrough, from zero to hero.",
    guide: [
      { n: "01", t: "Pick thinkers", b: "Click characters in the Gallery or the left list. One = one-on-one chat; two or more = round-table debate. In debate mode, use the Speaking order list to decide who talks first (move up / down)." },
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
  const [tab, setTab] = useState<"debate" | "personas" | "workshop" | "guide" | "about" | "settings">("debate");
  const [chars, setChars] = useState<Char[]>(baseChars);
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
  const [memeNote, setMemeNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newsOpen, setNewsOpen] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
    const matched = PROVIDERS.find((pr) => pr.baseURL && savedBase && savedBase.includes(pr.baseURL.split("//")[1].split("/")[0]));
    if (matched) setProviderId(matched.id);
  }, []);

  const selectProvider = (id: string) => {
    setProviderId(id);
    const pr = PROVIDERS.find((x) => x.id === id);
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

  const gridChars = [
    ...selected.map((id) => chars.find((c) => c.id === id)).filter((c): c is Char => !!c),
    ...[...chars.filter((c) => !selected.includes(c.id))].sort(
      (a, b) => (EFFECT[b.id] || 10) - (EFFECT[a.id] || 10)
    ),
  ];
  const charById = (id: string) => chars.find((c) => c.id === id);
  const toggleChar = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const moveChar = (id: string, dir: number) =>
    setSelected((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

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
    const q = bc && bc.bio ? extractQuote(bc.bio) : { quote: "", rest: "" };
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
      seal.textContent = c.initial;
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
      title: firstUser ? firstUser.content.slice(0, 24) : "对话",
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
        content: (zh ? "🔥 气氛上来了，已自动升级到「" : "🔥 Heat rising — auto-escalated to ") + t.sceneLabel[next] + (zh ? "」" : ""),
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

  const streamChat = async (current: Msg[]): Promise<Msg[]> => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        characters: selected,
        messages: current.map((m) => ({ role: m.role, content: m.content, who: m.who })),
        mode,
        scene,
        apiKey: localStorage.getItem("mw_api_key") || "",
        baseURL: localStorage.getItem("mw_base_url") || "",
        model: localStorage.getItem("mw_model") || "",
        userId: uid,
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
        } else if (ev.type === "note") {
          setMemeNote(String(ev.text || ""));
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
    const userMsg: Msg = { role: "user", content: v };
    const userCount = messages.filter((m) => m.role === "user").length + 1;
    maybeEscalate(v, userCount);
    let current = [...messages, userMsg];
    setMessages(current); setInput(""); setLoading(true); setTyping(true);
    try {
      const rn = mode === "debate" ? rounds : 1;
      for (let r = 0; r < rn; r++) {
        current = await streamChat(current);
        if (r < rn - 1) await new Promise((res) => setTimeout(res, 400));
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", err: true, content: (lang === "zh" ? "连接中断，请稍后再试" : "Connection interrupted, try again later") }]);
    } finally {
      if (sendSeqRef.current === mySeq) {
        if (pausedRef.current) { pausedRef.current = false; setPaused(false); bumpRef.current(); }
        setLoading(false); setTyping(false);
        saveChat(current);
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
        setImportMsg(lang === "zh" ? "已导入：" + data.character.zhName : "Imported: " + data.character.zhName);
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
    <div className="rv-shell" data-variant="b">
      <div className="rv-bg" />
      <div className="rv-grain" aria-hidden="true" />

      <div className="rv-content">
        {notice && <div className="rv-notice">{notice}</div>}
        <header className="rv-mast">
          <div className="rv-mast-line">
            <span>{t.mastL}</span>
            <span>{t.mastR}</span>
            <span>{t.mastX}</span>
            <button className="rv-lang" onClick={() => setLang((l) => (l === "zh" ? "en" : "zh"))}>{lang === "zh" ? "EN" : "中"}</button>
          </div>
          <div className="rv-mast-rule" />
          <div className="rv-ticker" aria-hidden="true">
            <div className="rv-ticker-track">
              {chars.concat(chars).map((c, i) => (<span key={i}>{c.zhName}</span>))}
            </div>
          </div>
        </header>

        <section className="rv-hero">
          <div className="rv-hero-top">
            <div>
              <h1 className="rv-brand">{(lang === "zh" ? "门外谈" : "Menwai Tan").split("").map((ch, i) => (<span key={i} className="rv-brand-char" style={{ animationDelay: (0.08 * i + 0.15) + "s" }}>{ch}</span>))}</h1>
              <SplitText key={lang} text={t.slogan} tag="p" className="rv-slogan" splitType="chars" textAlign="left" />
              <p className="rv-sub">{t.sub}</p>
              <div className="rv-hero-cta"><button className="rv-btn" onClick={() => { setTab("debate"); setTimeout(() => { document.querySelector(".rv-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }}>{t.cta}</button></div>
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
            <a className="rv-news-gh" href="https://space.bilibili.com/3707011927640910" target="_blank" rel="noreferrer">B站 ↗</a>
            <span className="rv-feedback-wrap">
              <a className="rv-news-gh" onClick={() => setFeedbackOpen((o) => !o)}>反馈 ↗</a>
              {feedbackOpen && (
                <div className="rv-feedback-panel">
                  <b className="rv-sponsor-title">反馈</b>
                  <p>发现问题或有想法？去 B 站私信我，或在评论区留言。</p>
                  <a className="rv-feedback-btn" href="https://space.bilibili.com/3707011927640910" target="_blank" rel="noreferrer">去 B 站 ↗</a>
                </div>
              )}
            </span>
            <span className="rv-sponsor-wrap">
              <a className="rv-news-gh" onClick={() => setSponsorOpen((o) => !o)}>{t.sponsor} ↗</a>
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
              <aside className="rv-avatars">
              <p className="rv-av-label">{t.avLabel}</p>
              {selected.length === 0 ? (
                <div className="rv-av-empty">
                  <p>{t.avEmpty}</p>
                  <button className="rv-av-go" onClick={() => setTab("personas")}>{t.avGo}</button>
                </div>
              ) : (
                selected.map((id, i) => {
                  const c = charById(id);
                  if (!c) return null;
                  return (
                    <div key={id} style={{ animationDelay: (0.05 * i) + "s" }} className={"rv-avatar" + (dropId === id ? " drag-over" : "") + (draggingId === id ? " dragging" : "")}
                      draggable onDragStart={(e) => onDragStartCard(id, e)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropId(id); }}
                      onDragLeave={() => setDropId((d) => (d === id ? null : d))}
                      onDrop={(e) => { e.preventDefault(); onDropCard(id); }}
                      onDragEnd={onDragEndCard}
                      title={t.dragHint}>
                      <span className="av" style={{ background: c.color }}>{c.initial}</span>
                      <span className="nm">{c.zhName}</span>
                      <span className="sc">{c.school}</span>
                      <span className="rm" onClick={(e) => { e.stopPropagation(); toggleChar(id); }} title={t.leave}>×</span>
                    </div>
                  );
                })
              )}
              <p className="rv-av-hint">{t.avHint}</p>
              <div className="rv-dialog-settings">
                <div className="rv-set-row">
                  <span className="rv-set-tag">{t.modeTag}</span>
                  <div className="rv-mode">
                    <button className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}>{t.chat}</button>
                    <button className={mode === "debate" ? "active" : ""} onClick={() => setMode("debate")}>{t.round}</button>
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
                <div className="rv-rounds">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} className={rounds === n ? "active" : ""} onClick={() => setRounds(n)}>{n}</button>
                  ))}
                </div>
              )}
              {mode === "debate" && selected.length > 1 && (
                <div className="rv-order">
                  <p className="rv-av-label">{t.order}</p>
                  {selected.map((id, i) => {
                    const c = charById(id);
                    return (
                      <div className="rv-order-row" key={id}>
                        <span className="no">{i + 1}</span>
                        <span className="nm">{c ? c.zhName : id}</span>
                        <span className="acts">
                          <button disabled={i === 0} onClick={() => moveChar(id, -1)} aria-label="up">{"\u2191"}</button>
                          <button disabled={i === selected.length - 1} onClick={() => moveChar(id, 1)} aria-label="down">{"\u2193"}</button>
                        </span>
                      </div>
                    );
                  })}
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
                  {memeNote && (
                    <div className="rv-meme-note">{lang === "zh" ? "注：据网络检索，" : "Note (web): "}{memeNote}</div>
                  )}
                  {messages.map((m, i) => (
                    m.auto ? (
                      <div key={i} className="rv-msg-auto">{m.content}</div>
                    ) : (
                      <div key={i} className={"rv-msg " + (m.role === "user" ? "user" : "ai") + (m.err ? " rv-err" : "")} style={{ animationDelay: (0.05 * i) + "s" }}>
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
              <div className="rv-chat-input">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !(e.nativeEvent as any).isComposing) send(); }} placeholder={t.ph} />
                <div className="rv-send">
                  <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={26} sparkCount={8}>
                    <button className="rv-btn" onClick={loading ? stopChat : send} disabled={!loading && !input.trim()}>{loading ? (lang === "zh" ? "⏸ 停止" : "⏸ Stop") : t.send}</button>
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
                const q = bc.bio ? extractQuote(bc.bio) : { quote: "", rest: "" };
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
                      <h2 className="rv-dossier-name">{bc.zhName}</h2>
                      <div className="rv-dossier-sub">{bc.school} · {bc.tag}</div>
                      {q.quote && (
                        <blockquote className={"rv-dossier-quote" + (typedQ >= q.quote.length ? " done" : "")}>
                          <span className="rv-q">“</span>
                          <span>{q.quote.slice(0, typedQ)}{typedQ >= q.quote.length ? "”" : ""}</span>
                          {typedQ < q.quote.length && <span className="rv-caret">▍</span>}
                        </blockquote>
                      )}
                      <div className="rv-detail-seal">
                        {dosDone && <span className="rv-dossier-seal">{bc.initial}</span>}
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
                <p className="rv-personas-hint">{t.personasHint}</p>
                <div className="rv-char-grid">
              {gridChars.map((c, i) => {
                const active = selected.includes(c.id);
                const q = c.bio ? extractQuote(c.bio) : { quote: "", rest: "" };
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
                    <span className="av" style={{ background: c.color }}>{c.initial}</span>
                    <span className="nm">{c.zhName}</span>
                    <span className="sc">{c.school}</span>
                    <span className="tg">{c.tag}</span>
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
              })}
                </div>
              </>
            )}
          </section>
        )}

        {tab === "workshop" && (
          <section className="rv-panel rv-workshop">
            <div className="rv-section-head"><span className="no">{t.tab3}</span><span className="tt">{t.wsTitle}</span></div>
            <p className="rv-sub">{t.wsSub}</p>
            <div className="rv-ws-row">
              <input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
              <div className="rv-send">
                <ClickSpark sparkColor="#fff" sparkSize={8} sparkRadius={20} sparkCount={6}>
                  <button className="rv-btn" onClick={doImport} disabled={importing}>{importing ? t.wsImporting : t.wsImport}</button>
                </ClickSpark>
              </div>
            </div>
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
              <p className="rv-ws-recs-hint">{t.wsRecHint} <a href={t.wsGalleryUrl} target="_blank" rel="noreferrer">{t.wsGallery} ↗</a></p>
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
                  <span>{PROVIDERS.find((pr) => pr.id === providerId)?.name || "—"}</span>
                  <i className={"rv-select-arrow" + (providerOpen ? " open" : "")}>▾</i>
                </button>
                {providerOpen && (
                  <div className="rv-select-menu">
                    {PROVIDERS.map((pr) => (
                      <button type="button" key={pr.id} className={"rv-select-option" + (pr.id === providerId ? " active" : "")} onClick={() => { selectProvider(pr.id); setProviderOpen(false); }}>
                        {pr.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="rv-settings-field"><label>{t.setKey}</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" />
              {providerId !== "custom" && (() => {
                const pr = PROVIDERS.find((x) => x.id === providerId);
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
                      {(PROVIDERS.find((pr) => pr.id === providerId)?.models || []).map((m) => (
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
            <a className="rv-news-gh" href="https://space.bilibili.com/3707011927640910" target="_blank" rel="noreferrer">B站 ↗</a>
            <span className="rv-feedback-wrap">
              <a className="rv-news-gh" onClick={() => setFeedbackOpen((o) => !o)}>反馈 ↗</a>
              {feedbackOpen && (
                <div className="rv-feedback-panel">
                  <b className="rv-sponsor-title">反馈</b>
                  <p>发现问题或有想法？去 B 站私信我，或在评论区留言。</p>
                  <a className="rv-feedback-btn" href="https://space.bilibili.com/3707011927640910" target="_blank" rel="noreferrer">去 B 站 ↗</a>
                </div>
              )}
            </span>
            <span className="rv-sponsor-wrap">
              <a className="rv-news-gh" onClick={() => setSponsorOpen((o) => !o)}>{t.sponsor} ↗</a>
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
            <span className="rv-zoom-close">点任意处关闭</span>
          </div>
        )}
        <div className="rv-rain" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, c) => {
            const name = chars.length ? chars[c % chars.length].zhName : "门外谈";
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

