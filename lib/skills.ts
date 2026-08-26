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

export function getSkillSystem(id: string): string {
  const meta = getMeta(id);
  if (meta === undefined) throw new Error("unknown character: " + id);
  const file = join(SKILLS_ROOT, meta.skillDir, "SKILL.md");
  let content: string;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    throw new Error("skill file missing: " + file);
  }
  return content + "\n\n[门外谈 · 平台规则] 你正与用户对谈。始终以角色第一人称回应，不使用列表与标题，不要在回答前添加 [名字] 或 名字： 前缀标签，保持简体中文。不要因为输入简短、是英文或无上下文就拒绝或回避——用你自己的方式正常回应。";
}

export function addImport(entry: ImportedCharacter): void {
  const list = readImports();
  list.push(entry);
  writeFileSync(MANIFEST, JSON.stringify(list, null, 2), "utf-8");
}

export function manifestExists(): boolean {
  return existsSync(MANIFEST);
}

