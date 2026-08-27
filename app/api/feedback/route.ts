import { NextRequest, NextResponse } from "next/server";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = String(body?.text || "").trim().slice(0, 2000);
    if (!text) {
      return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    }
    const contact = String(body?.contact || "").trim().slice(0, 200);
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), text, contact }) + "\n";
    appendFileSync(join(dir, "feedback.jsonl"), line, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
