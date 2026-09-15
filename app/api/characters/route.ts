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

type Lang = "zh" | "en";

const CJK_CHAR = /[\u4e00-\u9fff]/g;

// 是否英文文档：给中英两条文案线分流用
function isEnglishDoc(md: string): boolean {
  const cjk = (md.match(CJK_CHAR) || []).length;
  const latin = (md.match(/[A-Za-z]/g) || []).length;
  return latin >= 300 && latin > cjk * 3;
}

// 英文文案只认“干净英文”的素材：混着中文的调研笔记不算（否则英文人物志里会掉进中文段落）
function isEnglishClean(md: string): boolean {
  const cjk = (md.match(CJK_CHAR) || []).length;
  const latin = (md.match(/[A-Za-z]/g) || []).length;
  return latin >= 300 && cjk <= 8;
}

// 没有 README.en.md 的角色（多为国际人物，SKILL.md 本身就是英文）→ 退回 SKILL.md 正文
function skillDoc(dir: string): string {
  const f = join(dir, "SKILL.md");
  if (existsSync(f) === false) return "";
  let md = readFileSync(f, "utf-8");
  md = md.replace(/^---\n[\s\S]*?\n---\n?/, "");
  md = md.replace(/^\s*#\s[^\n]*\n+/, "");
  md = md.replace(/##\s*(By-Need Resources|按需资源|Resources)[\s\S]*?(?=\n##\s|$)/i, "");
  return md;
}

function bioFor(c: { id: string; skillDir: string }, lang: Lang = "zh"): string {
  const dir = join(process.cwd(), "skills", c.skillDir);
  const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf-8") : "");
  const techCut = /(安装|使用方法|使用说明|快速开始|Usage|Installation|Quick Start|命令行|npm |npx )/i;
  const zhReadme = read(join(dir, "README.md"));
  const enReadme = read(join(dir, "README.en.md"));
  const skill = skillDoc(dir);
  // 中文界面优先中文 README；英文界面优先 README.en.md，再退到英文 SKILL.md 正文
  const primary = lang === "en"
    ? (enReadme || (isEnglishClean(skill) ? skill : zhReadme))
    : (zhReadme || enReadme);
  let parts: string[] = [];
  let md = clean(primary);
  md = md.replace(/^[^\n]*?\.skill\b[^\n]*\n?/, "");
  // README.en.md 的 H1 常是仓库 slug（如 "hayek"、"plato skill"）→ 英文文案里去掉这行标题残渣
  if (lang === "en") {
    const row = md.split("\n");
    const head = (row[0] || "").trim();
    if (head !== "" && head.length <= 40 && /^[A-Za-z0-9 ._-]+$/.test(head)) md = row.slice(1).join("\n").trim();
  }
  const c1 = techCut.exec(md);
  if (c1 && c1.index > 60) md = md.slice(0, c1.index);
  parts.push(md);
  const total = () => parts.join("\n\n").length;
  // 补料只在同语种内进行，否则英文界面会被中文参考文档填满
  const sameLang = (t: string) => (lang === "en" ? isEnglishClean(t) : isEnglishDoc(t) === false);
  if (total() < 500) {
    const refDir = join(dir, "references");
    if (existsSync(refDir)) {
      for (const f of collectMd(refDir)) {
        let ref = clean(read(f));
        if (sameLang(ref) === false) continue;
        const c2 = techCut.exec(ref);
        if (c2 && c2.index > 60) ref = ref.slice(0, c2.index);
        parts.push(ref);
        if (total() > 900) break;
      }
    }
  }
  if (total() < 650 && lang === "zh") {
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

function repoFor(c: { skillDir: string; repo?: string }): string {
  if (c.repo) return c.repo;   // 导入时记录的源仓库优先
  const enPath = join(process.cwd(), "skills", c.skillDir, "README.en.md");
  const readmePath = existsSync(enPath) ? enPath : join(process.cwd(), "skills", c.skillDir, "README.md");
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
  // 一次返回中英两版简介：切换语言无需重新拉取，英文界面也不再落到中文人物志
  const characters = getAllCharacters().map((c) => ({
    ...c,
    bio: bioFor(c, "zh"),
    bioEn: bioFor(c, "en"),
    repo: repoFor(c),
  }));
  return Response.json({ characters });
}
