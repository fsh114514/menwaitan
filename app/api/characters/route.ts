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

function collectMd(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, f.name);
    if (f.isDirectory()) collectMd(full, out);
    else if (f.name.endsWith(".md")) out.push(full);
  }
  return out;
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
  if (total() < 500) {
    const refDir = join(dir, "references");
    if (existsSync(refDir)) {
      for (const f of collectMd(refDir)) {
        let ref = clean(read(f));
        const c2 = techCut.exec(ref);
        if (c2 && c2.index > 60) ref = ref.slice(0, c2.index);
        parts.push(ref);
        if (total() > 900) break;
      }
    }
  }
  if (total() < 650) {
    const desc = skillDesc(dir);
    if (desc.length > 30) parts.push(desc);
  }
  let bio = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  const MAX = 1100;
  if (bio.length <= MAX) return bio;
  const cut = bio.slice(0, MAX);
  const ends: number[] = [];
  for (let i = 0; i < cut.length; i++) {
    if (/[。！？!?；;]/.test(cut[i])) ends.push(i + 1);
  }
  const last = ends.length ? ends[ends.length - 1] : 0;
  if (last > MAX * 0.55) return bio.slice(0, last) + "…";
  return cut + "…";
}

function repoFor(c: { skillDir: string }): string {
  const readmePath = join(process.cwd(), "skills", c.skillDir, "README.md");
  try {
    const readme = readFileSync(readmePath, "utf-8");
    // 1. full owner/repo link (strip .git/trailing slash)
    const m = readme.match(/https?:\/\/(?:www\.)?github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?(?:\/|$|\s|[)"'])/);
    if (m) return "https://github.com/" + m[1].replace(/\.git$/, "");
    // 2. owner-only link -> assume repo named after skillDir
    const m2 = readme.match(/https?:\/\/(?:www\.)?github\.com\/([\w.-]+)/);
    if (m2) return "https://github.com/" + m2[1] + "/" + c.skillDir;
  } catch { /* no readme */ }
  return "";
}

export async function GET() {
  const characters = getAllCharacters().map((c) => ({ ...c, bio: bioFor(c), repo: repoFor(c) }));
  return Response.json({ characters });
}
