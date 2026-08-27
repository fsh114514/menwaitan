import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const ADMIN_KEY = "menwaitan2026";

// 日志时间戳是 UTC，后台统一显示为东八区（北京时间）
function fmtCST(iso: string): string {
  if (!iso) return iso;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

const S = {
  font: "system-ui",
  bg: "#f5f2ec",
  card: "#fff",
  border: "#ddd",
  ink: "#17120d",
  red: "#c8102e",
  gray: "#888",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const authed = sp.key === ADMIN_KEY;
  const q = (sp.q || "").toLowerCase();
  const uidFilter = sp.uid || "";
  const logPath = join(process.cwd(), "data", "chats.jsonl");
  let entries: any[] = [];
  if (authed && existsSync(logPath)) {
    entries = readFileSync(logPath, "utf-8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
  const fbPath = join(process.cwd(), "data", "feedback.jsonl");
  let feedback: any[] = [];
  if (authed && existsSync(fbPath)) {
    feedback = readFileSync(fbPath, "utf-8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    feedback.sort((a: any, b: any) => (a.ts < b.ts ? 1 : -1));
  }
  if (!authed) {
    return (
      <div style={{ fontFamily: S.font, background: S.bg, minHeight: "100vh", padding: 24 }}>
        <div style={{ maxWidth: 360, margin: "80px auto", background: S.card, border: "1px solid " + S.border, borderRadius: 8, padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 16px" }}>门外谈 · 后台</h1>
          <form method="get">
            <input name="key" type="password" placeholder="访问密码" style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #ccc", borderRadius: 6 }} />
            <button style={{ width: "100%", marginTop: 12, padding: 10, background: S.ink, color: "#fff", border: 0, borderRadius: 6, fontSize: 14, cursor: "pointer" }}>进入</button>
          </form>
        </div>
      </div>
    );
  }
  // normalize entries (new incremental + old full-history fallback)
  const norm = entries.map((e) => ({
    ts: e.ts || "",
    userId: e.userId || "anon",
    mode: e.mode || "",
    characters: e.characters || [],
    userText: e.user ?? (e.messages && e.messages.find((m: any) => m.role !== "assistant") ? e.messages.find((m: any) => m.role !== "assistant").content : ""),
    replies: e.replies || (e.messages && e.messages.filter((m: any) => m.role === "assistant").map((m: any) => ({ who: m.who || "AI", text: m.content })) || []),
  }));
  const filtered = q ? norm.filter((e) => (e.userText + " " + e.replies.map((r: any) => r.who + " " + r.text).join(" ")).toLowerCase().includes(q)) : norm;
  const byUser: Record<string, any[]> = {};
  filtered.forEach((e) => { (byUser[e.userId] = byUser[e.userId] || []).push(e); });
  const users = Object.entries(byUser).map(([id, items]) => ({ id, count: items.length, last: items[items.length - 1].ts })).sort((a, b) => (a.last < b.last ? 1 : -1));
  const selected = uidFilter ? byUser[uidFilter] || [] : null;
  const base = "/admin?key=" + ADMIN_KEY + "&q=" + encodeURIComponent(q);
  return (
    <div style={{ fontFamily: S.font, background: S.bg, minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>门外谈 · 后台</h1>
        <form method="get" style={{ marginBottom: 20, display: "flex", gap: 8 }}>
          <input name="key" type="hidden" value={ADMIN_KEY} />
          <input name="q" placeholder="搜索内容 / 角色 / 用户 ID" defaultValue={sp.q || ""} style={{ flex: 1, padding: 10, fontSize: 14, border: "1px solid #ccc", borderRadius: 6 }} />
          <button style={{ padding: "10px 20px", background: S.ink, color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" }}>搜索</button>
          {q && <a href={"/admin?key=" + ADMIN_KEY} style={{ padding: "10px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: S.ink }}>清空</a>}
        </form>
        {selected ? (
          <div>
            <a href={base} style={{ color: S.red, fontSize: 14 }}>← 返回用户列表</a>
            <h2 style={{ fontSize: 18, margin: "12px 0" }}>用户 {uidFilter} · {selected.length} 轮{q ? " · 匹配 " + q : ""}</h2>
            {selected.map((e, i) => (
              <details key={i} style={{ background: S.card, border: "1px solid " + S.border, borderRadius: 8, padding: "12px 16px", marginBottom: 10, fontSize: 14 }}>
                <summary style={{ cursor: "pointer", color: S.ink }}>
                  <span style={{ color: S.gray, fontSize: 12, marginRight: 8 }}>{fmtCST(e.ts)}</span>
                  {e.mode} · {(e.characters || []).join(" / ")} · <span style={{ color: S.red }}>{String(e.userText || "").slice(0, 40)}</span>
                </summary>
                <div style={{ marginTop: 10, lineHeight: 1.7 }}>
                  <div style={{ background: "#f0ece4", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}><b style={{ color: S.red }}>访客：</b>{e.userText}</div>
                  {(e.replies || []).map((r: any, j: number) => (
                    <div key={j} style={{ borderBottom: "1px solid #eee", padding: "6px 0" }}>
                      <b style={{ color: S.ink }}>[{r.who}]</b> {String(r.text || "")}
                    </div>
                  ))}
                </div>
              </details>
            ))}{selected.length === 0 && <p style={{ color: S.gray }}>无记录</p>}
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>访客反馈（{feedback.length} 条）</h2>
            {feedback.length === 0 ? <p style={{ color: S.gray }}>暂无反馈</p> : feedback.slice(0, 20).map((f: any, i: number) => (
              <div key={i} style={{ background: S.card, border: "1px solid " + S.border, borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 14 }}>
                <div style={{ color: S.gray, fontSize: 12, marginBottom: 6 }}>{fmtCST(f.ts)}{f.contact ? " · 联系：" + f.contact : ""}</div>
                <div style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{f.text}</div>
              </div>
            ))}
            <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>用户列表（{users.length} 个访客 · 共 {filtered.length} 轮 · 北京时间）</h2>
            {users.length === 0 ? <p style={{ color: S.gray }}>暂无记录</p> : users.map((u) => (
              <div key={u.id} style={{ background: S.card, border: "1px solid " + S.border, borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <b>{u.id}</b>
                  <span style={{ color: S.gray, fontSize: 12, marginLeft: 12 }}>{u.count} 轮 · 最后 {fmtCST(u.last)}</span>
                </div>
                <a href={base + "&uid=" + encodeURIComponent(u.id)} style={{ color: S.red, textDecoration: "none", fontSize: 14 }}>查看 →</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
