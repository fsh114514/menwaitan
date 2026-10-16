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

// 当某人确实收到过悄悄话时，追加更强的行动指令
const WHISPER_NUDGE_ZH =
  "\n\n【你刚掌握了一条别人不知道的信息】用户私下跟你说了些事。这一轮请基于它行动——最直接的做法是当场点名相关的人，把他们之前的说法摆出来对质。但不要说「私下」「悄悄」这类字眼，也不要复述用户原话。";
const WHISPER_NUDGE_EN =
  "\n\n[You now hold something the others do not] The user told you something privately. Act on it this turn — the most direct move is to name the relevant person and put their earlier remark on the table. Do not use the words \"privately\" or \"whisper\", and do not quote the user verbatim.";
// ===== v2 · 信息层 END =====

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

    const infoLayer = intl ? INFO_LAYER_EN : INFO_LAYER_ZH;
    const whisperNudge = intl ? WHISPER_NUDGE_EN : WHISPER_NUDGE_ZH;
    // 兼容旧引用：默认为第一位发言者视角
    const history = visibleHistory(selected[0]?.id || "");

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
        };
        // 触发式查梗：命中才搜，失败静默跳过
        let memeBlock = "";
        const lastMsg = [...messages].reverse().find((m: any) => m.role !== "assistant");
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
        const streamOnce = async (prompt: any[], guard: boolean): Promise<{ text: string; cjk: boolean }> => {
          const res = await call(prompt);
          let text = "";
          let cjk = false;
          for await (const chunk of res) {
            const delta = chunk.choices?.[0]?.delta?.content || "";
            if (!delta) continue;
            text += delta;
            if (CJK_RE.test(delta)) cjk = true;
            if (guard && cjk) return { text, cjk: true };
            send({ type: "delta", text: delta });
          }
          return { text, cjk };
        };

        const ask = async (speaker: { id: string; zhName: string; name: string; color: string }, prompt: any[]) => {
          send({ type: "who", who: speaker.id, name: intl ? speaker.name : speaker.zhName, color: speaker.color });
          if (intl) pinEnglish(prompt);
          let out = await streamOnce(prompt, intl);
          // 英文模式防中文：模型偶尔会跟着中文提问走回中文（客户端收到 reset 会清屏）
          // 兜底顺序：原样重答 → 把自己的回答翻译成英文（翻译请求最不容易再吐出汉字）
          if (intl && out.cjk) {
            send({ type: "reset" });
            const again = await streamOnce([...prompt, { role: "user", content: EN_RETRY }], true);
            out = again;
            if (again.cjk) {
              send({ type: "reset" });
              out = await streamOnce(
                [...prompt, { role: "assistant", content: again.text }, { role: "user", content: EN_TRANSLATE }],
                false,
              );
            }
          }
          send({ type: "done", who: speaker.id });
          return out.text;
        };

        const replies: { who: string; text: string }[] = [];
        try {
        // ---- v2：悄悄话定向发言（桌上仍是多人，只是这一轮只叫一个人回应）----
        const whisperSpeakers = whisperOnly
          ? selected.filter((s) => s.id === whisperOnly)
          : [];
        if (whisperSpeakers.length > 0) {
          const sp = whisperSpeakers[0];
          const prompt = [
            {
              role: "system" as const,
              content:
                getSkillSystem(sp.id, intl) + memeBlock +
                (intl ? roundRules(true, sp) : roundRules(false, sp)) +
                infoLayer +
                (whispersFor(sp.id) > 0 ? whisperNudge : "") +
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
                  (intl ? ANTI_OUT_EN : ANTI_OUT) +
                  (intl ? (SCENE_RULES_EN[scene] || SCENE_RULES_EN.casual) : (SCENE_RULES[scene] || SCENE_RULES.casual)) +
                  (intl ? EN_ONLY : LANG_FOLLOW),
              },
              ...debateContext,
              {
                role: "user" as const,
                content: intl
                  ? (turns.length === 0
                      ? "It’s your turn, " + speaker.name + ". Give the table your own take on the question just put to it — in your own voice."
                      : "Your turn, " + speaker.name + ". Respond to the discussion above.")
                  : (turns.length === 0
                      ? "请你以" + speaker.zhName + "的身份，就刚才的话题发表你的观点。"
                      : "轮到你发言了，" + speaker.zhName + "。请回应前面的讨论。"),
              },
            ];
            const text = await ask(speaker, prompt);
            turns.push({ who: speaker.id, text });
            // v2：发言公开进入桌上记录，并且带上发言人
            //（v1 这里没有 who，导致同一轮里后面的人不知道前面是谁说的）
            utts.push({ role: "assistant", who: intl ? speaker.name : speaker.zhName, content: text, vis: "public" });
            // v2：拉人对峙——被点到名的人提到队首，紧接着发言
            const nIdx = queue.findIndex((s) => text.includes(s.zhName) || (!!s.name && text.includes(s.name)));
            if (nIdx > 0) {
              const picked = queue.splice(nIdx, 1)[0];
              queue.unshift(picked);
            }
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
