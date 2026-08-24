import { getAllCharacters } from "@/lib/skills";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

function clean(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/当前展示[：:][^\n]*/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*|~-]{1,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function skillDesc(dir: string): string {
  const sk = readFileSync(join(dir, "SKILL.md"), "utf-8");
  const fm = sk.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return "";
  const d = fm[1].match(/description:\s*[|>]?\s*([\s\S]*?)(?=\n\w+:|$)/);
  if (!d) return "";
  return d[1].split("\n").map((l) => l.replace(/^\s+/, "")).join(" ").replace(/\s+/g, " ").trim();
}

function bioFor(c: { id: string; skillDir: string }): string {
  const dir = join(process.cwd(), "skills", c.skillDir);
  const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf-8") : "");
  const techCut = /(安装|使用方法|使用说明|快速开始|Usage|Installation|Quick Start|命令行|npm |npx )/i;
  let parts: string[] = [];
  let md = clean(read(join(dir, "README.md")));
  const c1 = techCut.exec(md);
  if (c1 && c1.index > 60) md = md.slice(0, c1.index);
  parts.push(md);
  const total = () => parts.join("\n\n").length;
  if (total() < 400) {
    const refDir = join(dir, "references");
    if (existsSync(refDir)) {
      for (const f of readdirSync(refDir)) {
        if (!f.endsWith(".md")) continue;
        let ref = clean(read(join(refDir, f)));
        const c2 = techCut.exec(ref);
        if (c2 && c2.index > 60) ref = ref.slice(0, c2.index);
        parts.push(ref);
        if (total() > 700) break;
      }
    }
  }
  if (total() < 450) {
    const desc = skillDesc(dir);
    if (desc.length > 30) parts.push(desc);
  }
  let bio = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return bio.length > 900 ? bio.slice(0, 900) + "…" : bio;
}

function repoFor(c: { skillDir: string }): string {
  const p = join(process.cwd(), "skills", c.skillDir, ".git", "config");
  if (!existsSync(p)) return "";
  const cfg = readFileSync(p, "utf-8");
  const m = cfg.match(/url\s*=\s*(\S+)/);
  return m ? m[1] : "";
}

export async function GET() {
  const characters = getAllCharacters().map((c) => ({ ...c, bio: bioFor(c), repo: repoFor(c) }));
  return Response.json({ characters });
}
