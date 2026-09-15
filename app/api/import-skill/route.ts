import { execFileSync } from "child_process";
import { readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { addImport, readImports, type ImportedCharacter } from "@/lib/skills";
import { enName } from "@/lib/characterMeta";

const PALETTE = ["#c0392b", "#2e8a5e", "#2e5d8a", "#8a6a2e", "#6b4f8a", "#a0582e"];

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (typeof url !== "string" || url.includes("github.com") === false) {
      return Response.json({ error: "请输入 GitHub 仓库地址，例如 https://github.com/owner/repo" }, { status: 400 });
    }
    const m = url.match(/github\.com\/([^\/]+)\/([^\/#\?]+)/);
    if (m === null) {
      return Response.json({ error: "无法解析仓库地址" }, { status: 400 });
    }
    const owner = m[1].replace(/[^a-zA-Z0-9-]/g, "");
    const repo = m[2].toLowerCase().replace(/[^a-z0-9-_]/g, "");
    const cloneUrl = "https://github.com/" + owner + "/" + repo + ".git";
    const target = join(process.cwd(), "skills", repo);
    if (existsSync(target)) {
      return Response.json({ error: "该角色已存在（skills/" + repo + "）" }, { status: 409 });
    }
    execFileSync("git", ["clone", "--depth", "1", cloneUrl, target], { timeout: 90000, stdio: "pipe" });
    const sk = join(target, "SKILL.md");
    if (existsSync(sk) === false) {
      rmSync(target, { recursive: true, force: true });
      return Response.json({ error: "仓库中没有 SKILL.md，不是 dot-skill 格式角色" }, { status: 400 });
    }
    const content = readFileSync(sk, "utf-8");
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const h1 = content.match(/^#\s+(.+)$/m);
    const zhName = h1 ? h1[1].replace(/·.*/, "").trim() : (nameMatch ? nameMatch[1].trim() : repo);
    const color = PALETTE[readImports().length % PALETTE.length];
    const entry: ImportedCharacter = {
      id: repo,
      zhName,
      // frontmatter 里常是仓库 slug（plato-perspective）→ 清洗成英文界面能直接显示的本名
      name: enName({ id: repo, name: nameMatch ? nameMatch[1].trim() : repo, zhName }),
      initial: zhName.slice(0, 1),
      school: "导入角色",
      tag: "skill",
      color,
      skillDir: repo,
      imported: true,
    };
    addImport(entry);
    return Response.json({ ok: true, character: entry });
  } catch (error: any) {
    console.error("import error:", error);
    return Response.json({ error: "导入失败：" + (error.message || "未知错误") }, { status: 500 });
  }
}

