// 服务端：角色注册表 = 内置 6 人 + skills/manifest.json 导入
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { characterMeta, characterMetaById, type CharacterMeta } from "./characterMeta";

export interface ImportedCharacter extends CharacterMeta {
  imported: true;
}

const SKILLS_ROOT = join(process.cwd(), "skills");
const MANIFEST = join(SKILLS_ROOT, "manifest.json");

export function readImports(): ImportedCharacter[] {
  try {
    const raw = readFileSync(MANIFEST, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getAllCharacters(): (CharacterMeta | ImportedCharacter)[] {
  return [...characterMeta, ...readImports()];
}

export function getMeta(id: string): (CharacterMeta | ImportedCharacter) | undefined {
  return characterMetaById[id] || readImports().find((c) => c.id === id);
}

export function getSkillSystem(id: string, intl = false): string {
  const meta = getMeta(id);
  if (meta === undefined) throw new Error("unknown character: " + id);
  const file = join(SKILLS_ROOT, meta.skillDir, "SKILL.md");
  let content: string;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    throw new Error("skill file missing: " + file);
  }
    const anchor = intl
    ? "\n\n[Menwai Tan · Platform rule] You are " + meta.name + " yourself. Always answer in the first person, in your own voice. Never list multiple perspectives or narrate as an outsider (never output \"what X would say\" style lists)."
    : "\n\n[门外谈 · 平台规则] 你是" + meta.zhName + "本人。永远以" + meta.zhName + "本人的口吻直接回答，始终第一人称；不要转述、列举或扮演其他角色或职业的视角（不要输出\"XX 会怎么说\"式的多视角列表或旁白）。";
  return content + anchor;
}

export function addImport(entry: ImportedCharacter): void {
  const list = readImports();
  list.push(entry);
  writeFileSync(MANIFEST, JSON.stringify(list, null, 2), "utf-8");
}

export function manifestExists(): boolean {
  return existsSync(MANIFEST);
}

