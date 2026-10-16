import { getSkillSystem, getMeta } from "@/lib/skills";
import OpenAI from "openai";

const DEF_MODEL = process.env.AI_MODEL || "glm-4-flash";

const SCENE_RULES: Record<string, string> = {
  casual: "\n\n【本回合为「随口」模式】回答务必极其简短：最多 2 句话，60 字以内。像随口搭话一样直接给出态度，不要展开论证，不要客套。",
  serious: "\n\n【本回合为「较真」模式】回答可以多说一些：最多 6 句话、300 字以内。直接亮出观点和关键理由，有条理地展开论证，不铺垫、不重复。",
  heated: "\n\n【本回合为「上头」模式】放开辩论：可以充分展开论证，层层推进，激烈交锋，展示完整的思想。",
};

const ANTI_OUT = "\n\n【对话纪律】无论对方输入什么（哪怕只有几个字、看起来没头没尾、或根本不是问题），你都以本人身份直接接话，像真实的人闲聊那样回应；绝不跳出角色说“请提供具体的问题或人物”“请指定…”之类的话术，绝不解释自己是什么 AI、绝不说明使用指南，绝不反问对方想聊什么。";
const SCENE_RULES_EN: Record<string, string> = {
  casual: "\n\n[This round: Casual mode] Reply extremely briefly: at most 2 sentences, under 60 words. Give a direct take, no lecturing, no small talk padding.",
  serious: "\n\n[This round: Serious mode] You may elaborate: at most 6 sentences, under 300 words. State your view and key reasons, argue in order, no filler, no repetition.",
  heated: "\n\n[This round: Heated mode] Debate freely: develop arguments at length, push layer by layer, clash hard, show your full thinking.",
};
const EN_ONLY = "\n\n[Language rule — this overrides anything above that says otherwise] Reply in English only, in natural, idiomatic English. Your persona notes, catchphrases, quotes and idioms may be written in Chinese: translate the persona into English instead of answering in Chinese. Never output Chinese characters (汉字) — the reply must contain no CJK text at all. Keep the person’s voice, attitude and argument; only the language changes. If a concept is Chinese-specific, write it in Latin letters as pinyin (jianghu, neijuan, guanxi) — never in Chinese characters. The other speakers at the table are speaking English too.";
const LANG_FOLLOW = "\n\n【语言跟随】用与对方相同的语言回答：对方用中文提问，你就用中文；对方用英文提问，你就用英文。保留你的性格、语气和说话方式，只跟随语言。不要主动切换成其他语言。";
// 英文模式兜底：system 里说过了，但模型仍可能跟着中文提问走 —— 把这条贴到最后一轮用户消息上
const CJK_RE = /[\u4e00-\u9fff]/;
const EN_TRANSLATE = "[Notice] Your previous answer came back in Chinese and was rejected. Rewrite that answer in English: same meaning, same voice and attitude, but no Chinese characters anywhere. Chinese-specific words must be written in Latin letters (jianghu, neijuan) or spelled out in English. Output the English version only.";
const EN_RETRY = "[Notice] Your previous answer was rejected: it was written in Chinese. Give the whole answer again, in English only. Do not use any Chinese character anywhere in the reply — if a concept is Chinese-specific (jianghu, neijuan, kaoyan and the like), write it in Latin letters or spell it out in English words. Everything must be English.";
const EN_TAIL = "\n\n[Reply in English only — no Chinese characters, no pinyin in Chinese script. Chinese-specific ideas (jianghu, neijuan, guanxi) must be written in Latin letters or explained in English words. The whole answer must be English.]";
function pinEnglish(prompt: { role: string; content: string }[]): void {
  for (let i = prompt.length - 1; i >= 0; i--) {
    if (prompt[i].role === "user") {
      prompt[i] = { role: prompt[i].role, content: String(prompt[i].content || "") + EN_TAIL };
      return;
    }
  }
}
const ANTI_OUT_EN = "\n\n[Speech discipline] Whatever the other person types (even a few characters, something unfinished, or not a question at all), answer in character, like a real person chatting. Never break character to say \"please provide a specific question or person\" or \"please specify\" — never explain that you are an AI, never give usage instructions, never ask the user what they want to talk about.";
function roundRules(intl: boolean, speaker: { name: string; zhName: string }): string {
  return intl
    ? "\n\nYou are " + speaker.name + " yourself. You are you — never mimic, quote or adopt other speakers’ catchphrases or tone. You are in a round-table debate with several thinkers. When responding to the previous speaker, first state your stance (agree or disagree), then give independent reasons; do not repeat or echo their views. Hold your position and the topic; if others drift, pull the debate back. Do not be polite for politeness’ sake — clash directly. Speak in your own words; never prefix replies with \"X said:\" or quote historical formatting."
    : "\n\n你就是" + speaker.zhName + "本人。你是你自己，不是任何其他角色，绝不模仿、转述或引用其他发言者的口瘾、自称或语气。你正在参与一场多位思想家的圆桌辩论。回应上一位发言者时，先明确你的立场（赞同还是反对），再给独立的理由；不要复述或附和对方的观点。始终守住你自己的立场和当前话题，别人跑题时把话题拉回来，而不是跟着跑。要用简体中文。不要客套，直接交锋。发言时直接开口说话，不要用「某某说：」这样的前缀，不要复述或引用历史记录里的格式。";
}
// ROUND_FN_END

// ===== v2 · 信息层（Information Layer）=====
// 核心：桌上每个人掌握的上下文不再相同。发言可标为 public 或「仅某某可见」；
// 生成某人的回复时，只喂它看得见的历史。用户可私下对某人说话 → 制造真实的信息不对称。
// 详见 competition/docs/作品介绍文档.md
type Vis = "public" | string[];
type Utt = { role: "user" | "assistant"; who?: string; content: string; vis: Vis };

const isPublic = (u: Utt): boolean => u.vis === "public";
const seesUtt = (u: Utt, id: string): boolean => u.vis === "public" || (u.vis as string[]).includes(id);

const WHISPER_TAG_ZH = "【有人私下对你说，桌上其他人听不到】";
const WHISPER_TAG_EN = "[Whispered to you privately — the rest of the table cannot hear this]";

// 让模型明白：这张桌上信息不对称。即使没有被私下告知，也要意识到别人可能知道你不知道的事。
const INFO_LAYER_ZH =
  "\n\n【信息层】这张桌子上，每个人知道的东西并不完全相同：别人看不到你和用户之间的私下交流，你也可能不知道别人私下听到了什么。你可以基于自己掌握的信息行动（质问某人、把某人的说法摆到桌面上、改变态度），但不要主动宣布「我是私下知道的」，也不要复述私下交流的原话。";
const INFO_LAYER_EN =
  "\n\n[Information layer] Around this table, not everyone knows the same things: the others cannot see your private exchanges with the user, and you may not know what they were told privately. You may act on what you hold (challenge someone, put their earlier remark on the table, shift your stance) — but never announce that a whisper happened, and never quote the private channel verbatim.";

// 场景 A·悄悄话当轮（只有你和用户在说话，桌上其他人不在场）：
// 这一轮的任务是"听到"，不是"当众摊牌"——摊牌留给紧接着的公开圆桌。
const WHISPER_REPLY_ZH =
  "\n\n【这是私下交谈】用户避开旁人，单独跟你说了这些；桌上其他人此刻听不到。你现在就是面对他一个人在说话：可以表态、可以追问、也可以说清你打算怎么办。别客套，也别说「我会认真考虑」「我会谨慎行事」这类空话——要么认同、要么反驳、要么追问他什么意思。";
const WHISPER_REPLY_EN =
  "\n\n[This is a private exchange] The user has set the others aside and told you something; nobody else at the table can hear it right now. You are speaking to them alone: take a position, press for detail, or say plainly what you intend to do. No pleasantries, and no empty filler like \"I will give it serious thought\" — agree, push back, or ask what they mean.";

// 场景 B·公开圆桌轮（你手里有一条别人不知道的信息）：
// 这一轮才是"当众摊牌"——必须真的做出动作，而不是心里想想。
const WHISPER_NUDGE_ZH =
  "\n\n【你手里有一条别人不知道的信息】用户私下跟你说过一些事，桌上其他人并不知道。这一轮别再泛泛而谈：直接把相关的人点出来，把他先前的说法摆到桌面上对质。至少要做这一件事。但不要说「私下」「悄悄」「有人告诉我」这类字眼，也不要复述用户原话。";
const WHISPER_NUDGE_EN =
  "\n\n[You hold something the others do not] The user told you something privately and the rest of the table does not know it. Do not stay generic this turn: name the relevant person outright and put their earlier remark on the table for them to answer. Do at least that. But never say \"privately\", \"whisper\" or \"I was told\" — and never quote the user verbatim.";

// 场景 C·有人当众点了你的名：你被挑战了，必须正面接火，不许用「我同意」敷衍过去。
// 这是伪共识的另一半——信息不对称把人推到台前，还得让他站得住。
const CHALLENGED_ZH =
  "\n\n【有人当众点了你的名】上一位发言人直接冲你来了。绝不要用「我同意」「你说得对」「确实如此」开场——先正面回答他抛给你的质疑，把你的立场说清楚，再往下推进。";
const CHALLENGED_EN =
  "\n\n[Someone just called you out] The previous speaker came straight at you. Never open with \"I agree\" or \"you're right\" — answer the challenge head-on, restate where you stand, then move the discussion forward.";

// ===== v2 · 讨论停滞判据（信息新颖度）=====
// 思路来自一个真实的多智能体工程实践：用「信息熵新颖度」而不是「聊够了没有」来判定讨论死活。
// 这里不需要额外花 token——把发言切成字符 2-gram，和此前出现过的所有 2-gram 比一比：
// 全是旧话 → 新颖度趋近 0；全是新东西 → 趋近 1。纯本地计算，零额外模型调用。
function charNgrams(text: string, n = 2): Set<string> {
  const s = String(text || "").replace(/[\s\p{P}\p{S}]/gu, "");
  const out = new Set<string>();
  for (let i = 0; i + n <= s.length; i++) out.add(s.slice(i, i + n));
  return out;
}
function noveltyAgainst(seen: Set<string>, text: string): number {
  const cur = charNgrams(text);
  if (cur.size === 0) return 0;
  let hit = 0;
  cur.forEach((g) => { if (seen.has(g)) hit++; });
  return 1 - hit / cur.size;
}
// 低于这个值就判定「在互相附和」→ 下一轮强制提出反对意见
const STAGNANT_THRESHOLD = 0.34;
const ANTI_CONSENSUS_ZH =
  "\n\n【讨论正在趋同】刚才这一轮几乎没有产生新信息，大家都在互相附和。这一轮你必须打破它：明确提出一个反对意见，或者给出一个此前没人提过的角度。不要复述任何人的观点。";
const ANTI_CONSENSUS_EN =
  "\n\n[The discussion is converging] The last round produced almost no new information — everyone is echoing each other. Break it this turn: raise an explicit objection, or bring in an angle nobody has used yet. Do not restate anyone's point.";

// ===== v2 · 主持人收尾 =====
// 讨论被判定趋同后，由「门外谈」本人（不是任何一位思想家）出面把这场伪共识拆开。
// 对应参考实践里那句「停止的时候 supervisor 会自动总结」。
const HOST_ID = "__host__";
// 注意：这个提示词被反复调过。软提示（"请把这件事说出来"）会让模型退化成复读机——
// 实测它把几位的观点又总结了一遍，等于什么都没说。必须给数字、下禁令、明确"不是总结是拆穿"。
const hostRulesZh = (value: number) =>
  "你是「门外谈」的主持人，不是桌上的任何一位思想家，不站任何一边。\n"
  + "桌上几位刚结束一轮发言，这一轮的信息新颖度只有 " + value + "%——他们在重复自己，而且没有一个人指出来。\n"
  + "现在轮到你说话。你的任务不是总结，是拆穿。第一句就直接告诉他们：刚才这一轮等于什么都没谈成。\n"
  + "然后像一个人当面把话挑明那样说下去：他们嘴上答成了什么、那个答成为什么经不起追问、"
  + "真正的分歧被谁绕过去了、哪个问题从第一句起就没人敢碰。\n"
  + "以下做法一律禁止：复述任何人的观点、逐个点评、使用编号或分点、写小标题、写「综上所述」、"
  + "说「感谢各位发言」、说「希望大家继续思考」。\n"
  + "四句话以内。用简体中文。";
const hostRulesEn = (value: number) =>
  "You are the host of Outgate, not one of the thinkers at the table and not aligned with any of them.\n"
  + "The speakers have just finished a round whose information novelty was only " + value + "% — they are repeating themselves "
  + "and none of them has pointed it out.\n"
  + "It is your turn. Your job is not to summarise — it is to call it out. Open by telling them plainly that the round "
  + "accomplished nothing. Then keep going the way a person says it to their face: what they pretend to have agreed on, "
  + "why that agreement cannot survive a follow-up question, which real disagreement someone steered around, "
  + "and which question nobody has dared touch since the first sentence.\n"
  + "Forbidden: restating anyone's view, commenting on speakers one by one, numbering or bullets, headings, "
  + "\"in conclusion\", \"thank you all for speaking\", \"let us keep thinking about this\".\n"
  + "Four sentences or fewer. Reply in English only.";
// ===== v2 · 信息层 END =====

// v2：点名检测——只认「右边界不是汉字」的匹配。
// 否则「凯恩斯主义」会把凯恩斯提前到队首、「孔子学院」会误伤孔子。
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mentionsSpeaker(text: string, names: string[]): boolean {
  if (!text) return false;
  for (const n of names) {
    if (!n || n.length < 2) continue;
    try {
      if (new RegExp(escapeRe(n) + "(?![\\u4e00-\\u9fff])").test(text)) return true;
    } catch { /* 正则异常就跳过这个名字 */ }
  }
  return false;
}

// v2：宽松匹配——只用来扫「这条悄悄话在讲谁」，不用于决定发言顺序。
// 严格版会把「乔布斯那套追随内心」判成没提到乔布斯（右边是"那"），
// 结果悄悄话的摊牌指令根本触发不了。识别话题要松，改发言顺序要紧。
function mentionsAnywhere(text: string, names: string[]): boolean {
  if (!text) return false;
  for (const n of names) {
    if (!n || n.length < 2) continue;
    if (text.includes(n)) return true;
  }
  return false;
}

// v2：去掉模型给自己加的「某某说：」前缀（模仿历史格式）。
// 桌面发言带上发言人之后这个副作用会变常见，流里已发出的不管，只清理上下文。
function stripSelfPrefix(text: string, selfNames: string[]): string {
  if (!text) return text;
  for (const n of selfNames) {
    if (!n) continue;
    try {
      const re = new RegExp("^\\s*" + escapeRe(n) + "\\s*(说|道|認為|认为)?\\s*[：:]\\s*");
      if (re.test(text)) return text.replace(re, "").trimStart();
    } catch { /* 正则异常跳过 */ }
  }
  return text;
}

// ---- 触发式查梗（多源免费检索，失败静默跳过，不影响聊天）----
const MEME_TRIGGER = /(什么(意思|梗)|为什么|是谁|是什么|是啥|啥意思|什么意思|什么意思啊|什么梗|求(解释|科普)|解释一下|科普一下|讲讲|知道吗|了解吗|听说过吗|认识吗|你懂吗|懂吗|查(一下|查)|搜(一下|搜)|上网(查|搜)|网上(都在说|说)|都在(说|刷|传)|最近(流行|火|刷屏)|现在(流行|火|刷屏)|网络(梗|词|热词|流行语)|热梗|热词|流行语|不懂|没听过|没看懂|不知道)/;

function shouldSearch(text: string): boolean {
  if (text.length > 120) return false;
  if (MEME_TRIGGER.test(text)) return true;
  if (text.length <= 60 && /梗/.test(text)) return true;
  if (text.length <= 40 && /(谁|啥|吗|呢|呀|嘛)[。？!?\s]*$/.test(text)) return true;
  return false;
}

function extractKeyword(q: string): string {
  const k = q.replace(/(这个|那个|请问|帮我)?(网络)?(梗|词|热词|流行语|是谁|是什么|是啥|啥意思|什么意思|什么意思啊|是什么意思|是什么意思啊|什么梗|求(解释|科普)|解释一下|科普一下|讲讲|查(一下|查)|搜(一下|搜)|上网(查|搜)|现在|最近|流行|火|刷屏|知道吗|了解吗|听说过吗|认识吗|不懂|没听过|没看懂|不知道)[。！？!?\s]*/g, "").trim();
  return k || q;
}

// 每用户节流：1 分钟最多 2 次搜索（防免费源被高频请求限流）
const searchBuckets = new Map<string, number[]>();
function allowSearch(uid: string): boolean {
  const now = Date.now();
  const keep = (searchBuckets.get(uid) || []).filter((t) => now - t < 60000);
  if (keep.length >= 2) { searchBuckets.set(uid, keep); return false; }
  keep.push(now);
  searchBuckets.set(uid, keep);
  return true;
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "Accept-Language": "zh-CN,zh;q=0.9" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

const cleanHtml = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();

type SearchItem = { title: string; desc: string };

async function bingRss(q: string, host: string): Promise<SearchItem[] | null> {
  const t = await fetchText("https://" + host + "/search?format=rss&q=" + encodeURIComponent(q), 1200);
  if (!t) return null;
  const items = [...t.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map((m) => {
    const body = m[1];
    const title = (body.match(/<title>(.*?)<\/title>/) || [])[1] || "";
    const desc = (body.match(/<description>(.*?)<\/description>/) || [])[1] || "";
    return { title: cleanHtml(title).slice(0, 40), desc: cleanHtml(desc).slice(0, 90) };
  }).filter((it) => it.title);
  return items.length ? items : null;
}

async function sogouSearch(q: string): Promise<SearchItem[] | null> {
  const t = await fetchText("https://www.sogou.com/web?query=" + encodeURIComponent(q), 1200);
  if (!t || /验证码|antispider/i.test(t)) return null;
  const titles = [...t.matchAll(/<h3 class="vr-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => cleanHtml(m[1]).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 3);
  if (!titles.length) return null;
  return titles.map((title) => ({ title: title.slice(0, 40), desc: "" }));
}

async function so360Search(q: string): Promise<SearchItem[] | null> {
  const t = await fetchText("https://www.so.com/s?q=" + encodeURIComponent(q), 1200);
  if (!t || /验证码|captcha/i.test(t)) return null;
  const descs = [...t.matchAll(/<li class="res-list"[\s\S]{0,1500}?<p[^>]*>([\s\S]{0,200}?)<\/p>/g)]
    .map((m) => cleanHtml(m[1]).replace(/\s+/g, " ").trim())
    .filter((x) => x.length >= 10 && !/浏览器版本过低|暂无法获取|无法获取|当前浏览器/.test(x));
  const h3s = [...t.matchAll(/<li class="res-list"[\s\S]{0,900}?<h3[^>]*>([\s\S]*?)<\/h3>/g)]
    .map((m) => cleanHtml(m[1]).replace(/\s+/g, " ").trim())
    .filter((x) => x.length >= 4 && !/ai\.so\.com|详情/.test(x));
  const items: SearchItem[] = [];
  const n = Math.max(descs.length, h3s.length);
  for (let i = 0; i < Math.min(3, n); i++) {
    const desc = descs[i] || "";
    const title = (h3s[i] || (desc ? desc.slice(0, 22) : "")).slice(0, 40);
    if (title || desc) items.push({ title, desc: desc.slice(0, 90) });
  }
  return items.length ? items : null;
}

async function moegirlSearch(q: string): Promise<SearchItem[] | null> {
  const t = await fetchText("https://zh.moegirl.org.cn/index.php?search=" + encodeURIComponent(q), 1200);
  if (!t) return null;
  const res = [...t.matchAll(/mw-search-result-heading[\s\S]*?<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim()).filter(Boolean).slice(0, 3);
  if (res.length) return res.map((title) => ({ title: title.slice(0, 40), desc: "" }));
  const h1 = t.match(/<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/);
  if (h1) {
    const title = cleanHtml(h1[1]);
    const paras = [...t.matchAll(/<p[^>]*>([\s\S]{0,200}?)<\/p>/g)].map((m) => cleanHtml(m[1]).replace(/\s+/g, " ")).filter((x) => x.length >= 15);
    return [{ title: title.slice(0, 40), desc: (paras[0] || "").slice(0, 90) }];
  }
  return null;
}

async function fetchMemeInfo(q: string): Promise<{ brief: string; detail: string } | null> {
  const sources = [
    { fn: () => bingRss(q, "cn.bing.com") },
    { fn: () => moegirlSearch(q) },
    { fn: () => so360Search(q) },
    { fn: () => bingRss(q, "www.bing.com") },
    { fn: () => sogouSearch(q) },
  ];
  const results = await Promise.allSettled(sources.map((s) => s.fn()));
  let chosen: SearchItem[] | null = null;
  for (let i = 0; i < sources.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value && r.value.length) { chosen = r.value; break; }
  }
  if (!chosen || !chosen.length) return null;
  return {
    brief: (chosen[0].title + "：" + chosen[0].desc).slice(0, 130),
    detail: chosen.map((it, i) => "【" + (i + 1) + "】" + it.title + "：" + it.desc).join("\n").slice(0, 360),
  };
}

// ---- 英文版查梗（Urban Dictionary + Reddit）----
const INTL_MEME_TRIGGER = /(what (is|are|does|do|means?)|meaning|explain|define|meme|sauce|source|why|who|how|lmk)/i;
function intlShould(text: string): boolean {
  if (text.length > 140) return false;
  if (INTL_MEME_TRIGGER.test(text)) return true;
  return text.length <= 50 && /[?]/.test(text);
}
function extractKeywordIntl(q: string): string {
  return q.replace(/(what|is|are|does|do|means?|meaning|explain|define|the|a|an|of|for|me|about|this|that)|[?.,!]/gi, " ").replace(/s+/g, " ").trim() || q;
}
async function intlMemeSearch(q: string): Promise<{ brief: string; detail: string } | null> {
  const jobs = [
    fetchText("https://api.urbandictionary.com/v0/define?term=" + encodeURIComponent(q), 1500).then((t) => {
      if (!t) return null;
      try {
        const j = JSON.parse(t);
        const d = j.list?.[0];
        if (!d) return null;
        return [{ title: d.word, desc: String(d.definition || "").replace(/s+/g, " ").slice(0, 90) }];
      } catch { return null; }
    }),
    fetchText("https://www.reddit.com/search.json?q=" + encodeURIComponent(q) + "&sort=relevance&limit=2&t=year", 1500).then((t) => {
      if (!t) return null;
      try {
        const j = JSON.parse(t);
        return (j.data?.children || []).slice(0, 2).map((c: any) => ({ title: String(c.data?.title || "").slice(0, 40), desc: String(c.data?.selftext || c.data?.subreddit || "").replace(/s+/g, " ").slice(0, 90) })).filter((x: any) => x.title);
      } catch { return null; }
    }),
  ];
  const results = await Promise.allSettled(jobs);
  let chosen: SearchItem[] | null = null;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value && r.value.length) { chosen = r.value; break; }
  }
  if (!chosen || !chosen.length) return null;
  return {
    brief: (chosen[0].title + ": " + chosen[0].desc).slice(0, 130),
    detail: chosen.map((it, i) => "[" + (i + 1) + "] " + it.title + ": " + it.desc).join("\n").slice(0, 360),
  };
}
export async function POST(req: Request) {
  try {
    // whisperOnly（v2 新增）：本轮只让这一个人回应（悄悄话定向发言），但桌上其他人仍在席
    const { characters: charIds, messages, mode, apiKey = "", baseURL = "", model = "", scene = "casual", userId = "", lang = "zh", whisperOnly = "" } = await req.json();
    const intl = lang === "en";

    if (charIds === undefined || Array.isArray(charIds) === false || charIds.length === 0) {
      return Response.json({ error: "请选择至少一位人物" }, { status: 400 });
    }
    const selected = charIds
      .map((id: string) => getMeta(id))
      .flatMap((m) => (m === undefined ? [] : [m]));
    if (selected.length === 0) {
      return Response.json({ error: "找不到对应人物" }, { status: 400 });
    }

    const intlReady = intl && (process.env.INTL_API_KEY || "");
    const client = new OpenAI({
      baseURL: baseURL || (intlReady ? (process.env.INTL_BASE_URL || "https://openrouter.ai/api/v1") : (process.env.AI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4")),
      apiKey: apiKey || (intlReady ? (process.env.INTL_API_KEY || "") : (process.env.AI_API_KEY || "")),
      timeout: 90000,
      maxRetries: 2,
    });
    const mdl = model || (intlReady ? (process.env.INTL_MODEL || "meta-llama/llama-3.3-70b-instruct:free") : (process.env.AI_MODEL || "glm-4-flash"));

    // ---- v2：把消息升级成带可见性的发言记录 ----
    // 前端约定：user 消息可选带 whisperTo（string | string[]）→ 该条只有目标人物看得见；
    // 没有 whisperTo 的即 public。assistant 发言一律 public（别人看得到你说了什么，
    // 但看不到你为什么这么说——这正是信息不对称的味道）。
    const utts: Utt[] = (Array.isArray(messages) ? messages : []).map((m: any) => {
      const isAssistant = m.role === "assistant";
      let vis: Vis = "public";
      if (!isAssistant) {
        const w = m.whisperTo;
        if (Array.isArray(w) && w.length) vis = w.map(String);
        else if (typeof w === "string" && w) vis = [w];
      }
      return {
        role: isAssistant ? "assistant" : "user",
        who: m.who,
        content: String(m.content ?? ""),
        vis,
      } as Utt;
    });

    // ===== v2 · 讨论是否正在趋同（无状态判据，每次请求现算）=====
    // 取「最后一段连续的 assistant 发言」当作上一轮，和它之前的全部内容比新颖度。
    // 这样不需要跨请求存状态，多用户也不会串台。
    let runStart = utts.length;
    while (runStart > 0 && utts[runStart - 1].role === "assistant") runStart--;
    const lastRoundText = utts.slice(runStart).filter((u) => u.who).map((u) => u.content).join("\n");
    const priorText = utts.slice(0, runStart).map((u) => u.content).join("\n");
    const lastNovelty: number | null =
      lastRoundText && priorText ? noveltyAgainst(charNgrams(priorText), lastRoundText) : null;
    const stagnant = lastNovelty !== null && lastNovelty < STAGNANT_THRESHOLD;

    // 某人看得见的历史（含「X说：」前缀；悄悄话加标记，让模型知道这是私下信息）
    const visibleHistory = (speakerId: string) =>
      utts
        .filter((u) => seesUtt(u, speakerId))
        .map((u) => {
          if (mode === "debate" && u.role === "assistant" && u.who) {
            return { role: "assistant", content: (intl ? u.who + ": " : u.who + "说：") + u.content };
          }
          if (u.role === "user" && !isPublic(u)) {
            return { role: "user", content: (intl ? WHISPER_TAG_EN : WHISPER_TAG_ZH) + u.content };
          }
          return { role: u.role, content: u.content };
        });

    // 某人是否收到过悄悄话（决定是否追加行动指令）
    const whispersFor = (speakerId: string) =>
      utts.filter((u) => u.role === "user" && !isPublic(u) && (u.vis as string[]).includes(speakerId)).length;

    // v2：这条悄悄话里点到了桌上哪些人？→ 公开圆桌那一轮要把它变成"当众点名"。
    // 光靠 system 里的软提示，模型会滑回泛泛而谈（实测：鲁迅回去讲道理，乔布斯直接附和）。
    // 所以在最后一轮 user 消息里给出明确动作，点名对象由悄悄话原文里扫出来。
    const whisperTargetsFor = (speakerId: string): string[] => {
      const found: string[] = [];
      for (const u of utts) {
        if (u.role !== "user" || isPublic(u)) continue;
        if (!(u.vis as string[]).includes(speakerId)) continue;
        for (const s of selected) {
          if (s.id === speakerId) continue;
          const label = intl ? (s.name || s.zhName) : s.zhName;
          if (found.includes(label)) continue;
          if (mentionsAnywhere(u.content, intl ? [s.name, s.zhName] : [s.zhName])) found.push(label);
        }
      }
      return found;
    };

    const infoLayer = intl ? INFO_LAYER_EN : INFO_LAYER_ZH;
    // 两个场景两套指令：私下当轮是「听到并表态」，公开圆桌轮才是「当众摊牌」
    const whisperReply = intl ? WHISPER_REPLY_EN : WHISPER_REPLY_ZH;
    const whisperNudge = intl ? WHISPER_NUDGE_EN : WHISPER_NUDGE_ZH;
    // 注：v2 起不再有「整桌共享」的 history。每个发言者的上下文由 visibleHistory(id) 现算。

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
        };
        // 触发式查梗：命中才搜，失败静默跳过
        // v2 修复：只允许「公开的」用户消息触发检索。
        // 否则一条悄悄话会被搜成「场外情报」并拼进所有发言者的 system —— 秘密就公开了。
        let memeBlock = "";
        const lastMsg = [...messages].reverse().find((m: any) => m.role !== "assistant" && !m.whisperTo);
        const lastText = lastMsg ? String(lastMsg.content ?? "") : "";
        if ((intl ? intlShould(lastText) : shouldSearch(lastText)) && allowSearch(userId)) {
          const info = intl ? await intlMemeSearch(extractKeywordIntl(lastText)) : await fetchMemeInfo(extractKeyword(lastText));
          if (info) {
            memeBlock = intl
              ? "\n\n[Field intel (web lookup, context only)]\n" + info.detail + "\nUse it only for background. Do not read it out or quote it; answer in your own voice."
              : "\n\n【场外情报（网络检索，仅供参考）】\n" + info.detail + "\n以上情报仅供理解话题背景。不要照读或引用原文，用你自己的身份和口吻自然回应；与情报冲突时，保持你自己的立场。";
            try { send({ type: "note", text: info.brief }); } catch { /* ignore */ }
          }
        }
        // v2：把「上一轮的新颖度」发给前端做可视化（讨论趋同时前端会亮灯）
        if (lastNovelty !== null) {
          try { send({ type: "novelty", value: Math.round(lastNovelty * 100), stagnant }); } catch { /* ignore */ }
        }
        const call = async (prompt: any[]): Promise<any> => {
          let lastErr: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              return await client.chat.completions.create({
                model: mdl,
                temperature: selected.length === 1 ? 0.8 : 0.85,
                messages: prompt,
                stream: true,
              });
            } catch (e: any) {
              lastErr = e;
              if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }
          }
          throw lastErr;
        };
        // 流式取一段回复；guard=true 时一旦出现汉字就立即停手（英文模式兜底）
        // v2：桌面发言带上发言人后，模型偶尔会模仿历史里的「某某说：」给自己加前缀。
        // 但流是一边生成一边外发的——等看完整段再判断就晚了。所以先扣住开头一小段，
        // 确认没有自我前缀再吐出去；到阈值或出现句读就定稿放行，绝不长时间拖延输出。
        const HOLD_MAX = 16;
        const makeHeadGate = (selfNames: string[]) => {
          const names = selfNames.filter(Boolean).map(escapeRe).join("|");
          const prefixRe = names ? new RegExp("^\\s*(" + names + ")\\s*(说|道)?\\s*[：:]\\s*") : null;
          let buf = "";
          let open = false;
          return (delta: string, flushAll: boolean): string => {
            if (open) return delta;
            buf += delta;
            const ready = flushAll || buf.length >= HOLD_MAX || /[\n。！？!?]/.test(buf);
            if (!ready) return "";
            open = true;
            if (prefixRe) {
              const m = prefixRe.exec(buf);
              if (m && m[0].length < buf.length) buf = buf.slice(m[0].length);
            }
            return buf;
          };
        };

        const streamOnce = async (prompt: any[], guard: boolean, gateIn?: (d: string, flushAll: boolean) => string): Promise<{ text: string; cjk: boolean }> => {
          const res = await call(prompt);
          let text = "";
          let cjk = false;
          for await (const chunk of res) {
            const delta = chunk.choices?.[0]?.delta?.content || "";
            if (!delta) continue;
            text += delta;
            if (CJK_RE.test(delta)) cjk = true;
            if (guard && cjk) return { text, cjk: true };
            const outDelta = gateIn ? gateIn(delta, false) : delta;
            if (outDelta) send({ type: "delta", text: outDelta });
          }
          if (gateIn) {
            const tail = gateIn("", true);
            if (tail) send({ type: "delta", text: tail });
          }
          return { text, cjk };
        };

        const ask = async (speaker: { id: string; zhName: string; name: string; color: string }, prompt: any[]) => {
          send({ type: "who", who: speaker.id, name: intl ? speaker.name : speaker.zhName, color: speaker.color });
          if (intl) pinEnglish(prompt);
          const selfNames = [speaker.zhName, speaker.name].filter(Boolean) as string[];
          // 每次重答都要用一个全新的闸门，避免上一段的残留
          let out = await streamOnce(prompt, intl, makeHeadGate(selfNames));
          // 英文模式防中文：模型偶尔会跟着中文提问走回中文（客户端收到 reset 会清屏）
          // 兜底顺序：原样重答 → 把自己的回答翻译成英文（翻译请求最不容易再吐出汉字）
          if (intl && out.cjk) {
            send({ type: "reset" });
            const again = await streamOnce([...prompt, { role: "user", content: EN_RETRY }], true, makeHeadGate(selfNames));
            out = again;
            if (again.cjk) {
              send({ type: "reset" });
              out = await streamOnce(
                [...prompt, { role: "assistant", content: again.text }, { role: "user", content: EN_TRANSLATE }],
                false,
                makeHeadGate(selfNames),
              );
            }
          }
          send({ type: "done", who: speaker.id });
          // 显示层由 makeHeadGate 清洗；这里再洗一次，保证进入下一轮上下文的是干净的正文
          return stripSelfPrefix(out.text, selfNames);
        };

        const replies: { who: string; text: string }[] = [];
        try {
        // ---- v2：悄悄话定向发言（桌上仍是多人，只是这一轮只叫一个人回应）----
        const whisperSpeakers = whisperOnly
          ? selected.filter((s) => s.id === whisperOnly)
          : [];
        if (whisperSpeakers.length > 0) {
          const sp = whisperSpeakers[0];
          // 这一轮是私下当轮：只让当事人听到并表态，当众摊牌留给紧接着的公开圆桌
          const prompt = [
            {
              role: "system" as const,
              content:
                getSkillSystem(sp.id, intl) + memeBlock +
                (intl ? roundRules(true, sp) : roundRules(false, sp)) +
                infoLayer +
                (whispersFor(sp.id) > 0 ? whisperReply : "") +
                (intl ? ANTI_OUT_EN : ANTI_OUT) +
                (intl ? (SCENE_RULES_EN[scene] || SCENE_RULES_EN.casual) : (SCENE_RULES[scene] || SCENE_RULES.casual)) +
                (intl ? EN_ONLY : LANG_FOLLOW),
            },
            ...visibleHistory(sp.id),
            {
              role: "user" as const,
              content: intl
                ? "The user has just spoken to you privately. Answer them — and decide for yourself whether to bring it to the table."
                : "用户刚刚私下跟你说了话。回应他——并自行决定要不要把这件事摆到台面上。",
            },
          ];
          const text = await ask(sp, prompt);
          replies.push({ who: sp.id, text });
        } else if (selected.length === 1) {
          const singleText = await ask(selected[0], [
            { role: "system", content: getSkillSystem(selected[0].id, intl) + memeBlock + (intl ? ANTI_OUT_EN : ANTI_OUT) + (intl ? (SCENE_RULES_EN[scene] || SCENE_RULES_EN.casual) : (SCENE_RULES[scene] || SCENE_RULES.casual)) + (intl ? EN_ONLY : LANG_FOLLOW) },
            ...visibleHistory(selected[0].id),
          ]);
          replies.push({ who: selected[0].id, text: singleText });
        } else {
          const turns: { who: string; text: string }[] = [];
          // v2：发言队列可变——被点名的人会被提到队首，实现"拉人对峙"
          const queue: (typeof selected) = [...selected];
          while (queue.length > 0) {
            const speaker = queue.shift();
            if (!speaker) break;
            // v2：每人只喂它看得见的历史（信息层的地基）
            const debateContext = visibleHistory(speaker.id).map((m: { role: string; content: string }) => {
              const mm = /^([^\s：:]+)说[：:]/.exec(m.content);
              if (m.role === "assistant" && mm) {
                const meta = getMeta(mm[1]);
                return { ...m, content: (intl ? (meta?.name || mm[1]) + ": " : (meta?.zhName || mm[1]) + "说：") + m.content.slice(mm[0].length) };
              }
              return m;
            });
            const prompt = [
              {
                role: "system" as const,
                content:
                  getSkillSystem(speaker.id, intl) + memeBlock +
                  (intl ? roundRules(true, speaker) : roundRules(false, speaker)) +
                  infoLayer +
                  (whispersFor(speaker.id) > 0 ? whisperNudge : "") +
                  (stagnant ? (intl ? ANTI_CONSENSUS_EN : ANTI_CONSENSUS_ZH) : "") +
                  (intl ? ANTI_OUT_EN : ANTI_OUT) +
                  (intl ? (SCENE_RULES_EN[scene] || SCENE_RULES_EN.casual) : (SCENE_RULES[scene] || SCENE_RULES.casual)) +
                  (intl ? EN_ONLY : LANG_FOLLOW),
              },
              ...debateContext,
              {
                role: "user" as const,
                content: (() => {
                  const tg = whisperTargetsFor(speaker.id);
                  // v2：握有悄悄话的人，这一轮的第一动作就是当众点名——不给它"回去讲道理"的机会
                  if (tg.length > 0) {
                    return intl
                      ? "Your turn, " + speaker.name + ". You hold something the others do not. Open by naming " + tg.join(" and ") + " directly and put their earlier remark in front of them to answer. Do not open with generalities — go straight at them."
                      : "轮到你发言了，" + speaker.zhName + "。你手里有一条别人不知道的信息。第一句话就当场点名" + tg.join("、") + "，把他先前的说法摆到他面前让他回答。不要先用大道理铺陈，直接冲他去。";
                  }
                  // v2：上一位提到了你 → 你被推到台前了，正面接火，不许服软。
                  // 这里用宽松匹配：他在发言里提到你的名字（哪怕是"乔布斯曾言…"），
                  // 在圆桌上就等于点了你的名。严格匹配会漏掉绝大多数真实情况。
                  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
                  const challenged = !!lastTurn &&
                    mentionsAnywhere(lastTurn.text, intl ? [speaker.name, speaker.zhName] : [speaker.zhName]);
                  if (challenged) {
                    return intl
                      ? "Your turn, " + speaker.name + ". " + lastTurn!.who + " just called you out by name. Do not open with agreement — answer the challenge first, then say where you stand."
                      : "轮到你发言了，" + speaker.zhName + "。刚才有人当众点了你的名，直接冲你来了。不要用「我同意」开场——先正面回答他的质疑，再说清你的立场。";
                  }
                  return intl
                    ? (turns.length === 0
                        ? "It’s your turn, " + speaker.name + ". Give the table your own take on the question just put to it — in your own voice."
                        : "Your turn, " + speaker.name + ". Respond to the discussion above.")
                    : (turns.length === 0
                        ? "请你以" + speaker.zhName + "的身份，就刚才的话题发表你的观点。"
                        : "轮到你发言了，" + speaker.zhName + "。请回应前面的讨论。");
                })(),
              },
            ];
            const text = await ask(speaker, prompt);
            turns.push({ who: speaker.id, text });
            // v2：发言公开进入桌上记录，并且带上发言人
            //（v1 这里没有 who，导致同一轮里后面的人不知道前面是谁说的）
            utts.push({ role: "assistant", who: intl ? speaker.name : speaker.zhName, content: text, vis: "public" });
            // v2：拉人对峙——被点到名的人提到队首，紧接着发言
            // 用 mentionsSpeaker 做右边界校验；中文模式只认中文名，避免英文名乱命中
            const nIdx = queue.findIndex((s) =>
              mentionsSpeaker(text, intl ? [s.name, s.zhName] : [s.zhName])
            );
            if (nIdx > 0) {
              const picked = queue.splice(nIdx, 1)[0];
              queue.unshift(picked);
            }
          }
          // v2：讨论被判定趋同 → 由「门外谈」本人收尾，把这场伪共识拆开。
          // 放在所有发言者之后：先让他们自己试一轮（上面已注入强制反对指令），
          // 试完还是空转，主持人才出面说清楚「你们其实什么都没谈拢」。
          if (stagnant) {
            try {
              const transcript = turns
                .map((t) => {
                  const m = selected.find((s) => s.id === t.who);
                  return (intl ? (m?.name || t.who) + ": " : (m?.zhName || t.who) + "说：") + t.text;
                })
                .join("\n\n");
              const hostText = await ask(
                { id: HOST_ID, zhName: intl ? "Outgate" : "门外谈", name: "Outgate", color: "#c8102e" },
                [
                  { role: "system" as const, content: (intl ? hostRulesEn(lastNovelty ?? 0) : hostRulesZh(lastNovelty ?? 0)) + (intl ? EN_ONLY : LANG_FOLLOW) },
                  { role: "user" as const, content: transcript || String(messages[messages.length - 1]?.content ?? "") },
                ],
              );
              turns.push({ who: HOST_ID, text: hostText });
              // 主持人发言也进入桌上记录，但标成 public（所有人都听得到）
              utts.push({ role: "assistant", who: intl ? "Outgate" : "门外谈", content: hostText, vis: "public" });
            } catch { /* 主持人不参与评审，失败不影响主体流程 */ }
          }
          replies.push(...turns);
        }
        send({ type: "end" });
        } catch (err: any) {
          try { send({ type: "error", message: err?.message || "调用 AI 失败" }); } catch { /* ignore */ }
        }

        try { controller.close(); } catch { /* already closed */ }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("chat error:", error);
    return Response.json({ error: error.message || "调用 AI 失败" }, { status: 500 });
  }
}
