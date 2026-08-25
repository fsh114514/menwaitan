import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const ADMIN_KEY = "menwaitan2026";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const authed = sp.key === ADMIN_KEY;
  const logPath = join(process.cwd(), "data", "chats.jsonl");
  let entries: any[] = [];
  if (authed && existsSync(logPath)) {
    entries = readFileSync(logPath, "utf-8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
  return (
    <div style={{ fontFamily: "system-ui", background: "#f5f2ec", minHeight: "100vh", padding: 24 }}>
      {!authed ? (
        <div style={{ maxWidth: 360, margin: "80px auto", background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 16px" }}>门外谈 · 后台</h1>
          <form method="get">
            <input name="key" type="password" placeholder="访问密码" style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #ccc", borderRadius: 6 }} />
            <button style={{ width: "100%", marginTop: 12, padding: 10, background: "#17120d", color: "#fff", border: 0, borderRadius: 6, fontSize: 14, cursor: "pointer" }}>进入</button>
          </form>
        </div>
      ) : (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ fontSize: 20 }}>门外谈 · 聊天记录（{entries.length} 条）</h1>
          {entries.length === 0 ? <p style={{ color: "#888" }}>暂无记录</p> : entries.slice().reverse().map((e, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>{e.ts} · {e.mode} · {(e.characters || []).join(" / ")}</div>
              {(e.messages || []).map((m: any, j: number) => (
                <div key={j} style={{ marginTop: 5, fontSize: 14, lineHeight: 1.6 }}>
                  <b style={{ color: "#c8102e" }}>[{m.who || m.role}]</b> {String(m.content || "").slice(0, 300)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
