import { getSkillSystem, getMeta } from "@/lib/skills";
import OpenAI from "openai";

const DEF_MODEL = process.env.AI_MODEL || "glm-4-flash";

const SCENE_RULES: Record<string, string> = {
  casual: "\n\n【本回合为「随口」模式】回答务必极其简短：最多 2 句话，60 字以内。像随口搭话一样直接给出态度，不要展开论证，不要客套。",
  serious: "\n\n【本回合为「较真」模式】回答可以多说一些：最多 6 句话、300 字以内。直接亮出观点和关键理由，有条理地展开论证，不铺垫、不重复。",
  heated: "\n\n【本回合为「上头」模式】放开辩论：可以充分展开论证，层层推进，激烈交锋，展示完整的思想。",
};

const ANTI_OUT = "\n\n【对话纪律】无论对方输入什么（哪怕只有几个字、看起来没头没尾、或根本不是问题），你都以本人身份直接接话，像真实的人闲聊那样回应；绝不跳出角色说“请提供具体的问题或人物”“请指定…”之类的话术，绝不解释自己是什么 AI、绝不说明使用指南，绝不反问对方想聊什么。";

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
    const { characters: charIds, messages, mode, apiKey = "", baseURL = "", model = "", scene = "casual", userId = "", lang = "zh" } = await req.json();
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

    const client = new OpenAI({
      baseURL: baseURL || (intl ? (process.env.INTL_BASE_URL || "https://openrouter.ai/api/v1") : (process.env.AI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4")),
      apiKey: apiKey || (intl ? (process.env.INTL_API_KEY || "") : (process.env.AI_API_KEY || "")),
      timeout: 90000,
      maxRetries: 2,
    });
    const mdl = model || (intl ? (process.env.INTL_MODEL || "meta-llama/llama-3.3-70b-instruct:free") : (process.env.AI_MODEL || "glm-4-flash"));

    const history = messages.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content:
        mode === "debate" && m.role === "assistant" && m.who
          ? m.who + "说：" + String(m.content ?? "")
          : String(m.content ?? ""),
    }));

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
        const ask = async (speaker: { id: string; zhName: string; name: string; color: string }, prompt: any[]) => {
          send({ type: "who", who: speaker.id, name: intl ? speaker.name : speaker.zhName, color: speaker.color });
          const res = await call(prompt);
          let text = "";
          for await (const chunk of res) {
            const delta = chunk.choices?.[0]?.delta?.content || "";
            if (delta) {
              text += delta;
              send({ type: "delta", text: delta });
            }
          }
          send({ type: "done", who: speaker.id });
          return text;
        };

        const replies: { who: string; text: string }[] = [];
        try {
        if (selected.length === 1) {
          const singleText = await ask(selected[0], [
            { role: "system", content: getSkillSystem(selected[0].id) + memeBlock + ANTI_OUT + (SCENE_RULES[scene] || SCENE_RULES.casual) },
            ...history,
          ]);
          replies.push({ who: selected[0].id, text: singleText });
        } else {
          const turns: { who: string; text: string }[] = [];
          for (const speaker of selected) {
            const debateContext = history.map((m: { role: string; content: string }) => {
              const mm = /^([^\s：:]+)说[：:]\s*/.exec(m.content);
              if (m.role === "assistant" && mm) {
                const meta = getMeta(mm[1]);
                return { ...m, content: (meta?.zhName || mm[1]) + "说：" + m.content.slice(mm[0].length) };
              }
              return m;
            });
            const prompt = [
              {
                role: "system" as const,
                content:
                  getSkillSystem(speaker.id) + memeBlock +
                  "\n\n你就是" + speaker.zhName + "本人。你是你自己，不是任何其他角色，绝不模仿、转述或引用其他发言者的口癖、自称或语气。你正在参与一场多位思想家的圆桌辩论。回应上一位发言者时，先明确你的立场（赞同还是反对），再给独立的理由；不要复述或附和对方的观点。始终守住你自己的立场和当前话题，别人跑题时把话题拉回来，而不是跟着跑。要用简体中文。不要客套，直接交锋。发言时直接开口说话，不要用「某某说：」这样的前缀，不要复述或引用历史记录里的格式。" +
                  ANTI_OUT + (SCENE_RULES[scene] || SCENE_RULES.casual),
              },
              ...debateContext,
              {
                role: "user" as const,
                content:
                  turns.length === 0
                    ? "请你以" + speaker.zhName + "的身份，就刚才的话题发表你的观点。"
                    : "轮到你发言了，" + speaker.zhName + "。请回应前面的讨论。",
              },
            ];
            const text = await ask(speaker, prompt);
            turns.push({ who: speaker.id, text });
            history.push({ role: "assistant", content: text });
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
