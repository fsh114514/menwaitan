import { NextRequest, NextResponse } from "next/server";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// 一轮对话（一次发送）记录一条：最后一条 user + 其后的全部 assistant 回复
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const messages: any[] = Array.isArray(body?.messages) ? body.messages : [];
    const ui = messages
      .map((m, i) => ({ m, i }))
      .filter((x) => x.m && x.m.role === "user");
    const lastU = ui[ui.length - 1];
    if (!lastU) {
      return NextResponse.json({ ok: false, error: "no-user" }, { status: 400 });
    }
    const replies = messages
      .slice(lastU.i + 1)
      .filter((m: any) => m && m.role === "assistant")
      .map((m: any) => ({ who: m.who || "AI", text: String(m.content || "") }))
      .filter((r: any) => r.text.trim() !== "");
    const rec = {
      ts: new Date().toISOString(),
      userId: String(body?.userId || "anon"),
      mode: String(body?.mode || ""),
      characters: Array.isArray(body?.characters) ? body.characters : [],
      user: String(lastU.m.content ?? ""),
      replies,
    };
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "chats.jsonl"), JSON.stringify(rec) + "\n", "utf8");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
