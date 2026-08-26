import { getSkillSystem, getMeta } from "@/lib/skills";
import OpenAI from "openai";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DEF_MODEL = process.env.AI_MODEL || "glm-4-flash";

const SCENE_RULES: Record<string, string> = {
  casual: "\n\n【本回合为「随口」模式】回答务必极其简短：最多 2 句话，60 字以内。像随口搭话一样直接给出态度，不要展开论证，不要客套。",
  serious: "\n\n【本回合为「较真」模式】回答保持克制：最多 4 句话，150 字以内。直接亮出观点和关键理由，不铺垫、不重复。",
  heated: "\n\n【本回合为「上头」模式】放开辩论：可以充分展开论证，层层推进，激烈交锋，展示完整的思想。",
};

// ---- 触发式查梗（必应 RSS，免费无 key；失败静默跳过，不影响聊天）----
const MEME_TRIGGER = /(什么(意思|梗)|是啥|啥意思|什么意思|什么意思啊|什么梗|求(解释|科普)|解释一下|科普一下|现在(流行|火|刷屏)|最近(流行|火|刷屏)|网络(梗|词|热词)|不懂|没听过|没看懂)/;

function extractKeyword(q: string): string {
  const k = q.replace(/(这个|那个)?(网络)?(梗|词|热词|是什么|是啥|啥意思|什么意思|什么意思啊|是什么意思|是什么意思啊|什么梗|求(解释|科普)|解释一下|科普一下|讲讲|现在|最近|流行|刷屏|不懂|没听过|没看懂)[。！？!?\s]*/g, "").trim();
  return k || q;
}

async function fetchMemeInfo(q: string): Promise<{ brief: string; detail: string } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const url = "https://cn.bing.com/search?format=rss&q=" + encodeURIComponent(q);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map((m) => {
      const body = m[1];
      const title = (body.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const desc = (body.match(/<description>(.*?)<\/description>/) || [])[1] || "";
      const clean = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#39;/g, "'").trim();
      return { title: clean(title).slice(0, 40), desc: clean(desc).slice(0, 90) };
    }).filter((it) => it.title);
    if (!items.length) return null;
    return {
      brief: (items[0].title + "：" + items[0].desc).slice(0, 130),
      detail: items.map((it, i) => "【" + (i + 1) + "】" + it.title + "：" + it.desc).join("\n").slice(0, 360),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { characters: charIds, messages, mode, apiKey = "", baseURL = "", model = "", scene = "casual", userId = "" } = await req.json();

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
      baseURL: baseURL || process.env.AI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
      apiKey: apiKey || process.env.AI_API_KEY || "",
      timeout: 90000,
      maxRetries: 2,
    });
    const mdl = model || DEF_MODEL;

    const history = messages.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content:
        mode === "debate" && m.role === "assistant" && m.who
          ? "[" + m.who + "] " + String(m.content ?? "")
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
        if (lastText.length <= 80 && MEME_TRIGGER.test(lastText)) {
          const info = await fetchMemeInfo(extractKeyword(lastText));
          if (info) {
            memeBlock = "\n\n【场外情报（网络检索，仅供参考）】\n" + info.detail + "\n以上情报仅供理解话题背景。不要照读或引用原文，用你自己的身份和口吻自然回应；与情报冲突时，保持你自己的立场。";
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
        const ask = async (speaker: { id: string; zhName: string; color: string }, prompt: any[]) => {
          send({ type: "who", who: speaker.id, name: speaker.zhName, color: speaker.color });
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
            { role: "system", content: getSkillSystem(selected[0].id) + memeBlock + (SCENE_RULES[scene] || SCENE_RULES.casual) },
            ...history,
          ]);
          replies.push({ who: selected[0].id, text: singleText });
        } else {
          const turns: { who: string; text: string }[] = [];
          for (const speaker of selected) {
            const debateContext = history.map((m: { role: string; content: string }) => {
              const mm = /^\[([^\]]+)\]\s*/.exec(m.content);
              if (m.role === "assistant" && mm) {
                const meta = getMeta(mm[1]);
                return { ...m, content: "[" + (meta?.zhName || mm[1]) + "]: " + m.content.slice(mm[0].length) };
              }
              return m;
            });
            const prompt = [
              {
                role: "system" as const,
                content:
                  getSkillSystem(speaker.id) + memeBlock +
                  "\n\n你就是" + speaker.zhName + "本人。你是你自己，不是任何其他角色，绝不模仿、转述或引用其他发言者的口癖、自称或语气。你正在参与一场多位思想家的圆桌辩论。先用一句话直接回应上一位发言者的核心观点，再陈述你自己的主张。要用简体中文。不要客套，直接交锋。" +
                  (SCENE_RULES[scene] || SCENE_RULES.casual),
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
        try {
          const lastUser = [...messages].reverse().find((m: any) => m.role !== "assistant");
          const rec = {
            ts: new Date().toISOString(),
            userId: userId || "anon",
            mode,
            characters: selected.map((sp) => sp.zhName),
            user: lastUser ? String(lastUser.content ?? "") : "",
            replies,
          };
          const dir = join(process.cwd(), "data");
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          appendFileSync(join(dir, "chats.jsonl"), JSON.stringify(rec) + "\n");
        } catch { /* logging must never break chat */ }
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
