// 角色元数据（UI 用）+ skill 目录映射（服务端读 SKILL.md 用）
export interface CharacterMeta {
  id: string;
  zhName: string;
  name: string;
  initial: string;
  school: string;
  tag: string;
  color: string;
  skillDir: string;
}

export const characterMeta: CharacterMeta[] = [
  { id: "luxun", zhName: "鲁迅", name: "Lu Xun", initial: "鲁", school: "批判 · 国民性", tag: "铁屋中的呐喊", color: "#3a3a3a", skillDir: "luxun" },
  { id: "hayek", zhName: "哈耶克", name: "Hayek", initial: "哈", school: "自发秩序", tag: "通往奴役之路", color: "#2e5d8a", skillDir: "hayek" },
  { id: "keynes", zhName: "凯恩斯", name: "Keynes", initial: "凯", school: "有效需求", tag: "动物精神", color: "#8a6a2e", skillDir: "keynes" },
];

// ---- 英文显示名 ----
// 导入角色的 name 常直接取 SKILL.md frontmatter（如 plato-perspective、marx-skill），
// 英文界面照搬会露出 slug。这里统一清洗成可读本名：先查人工对照表，再退化到 slug 美化。
const EN_NAME_OVERRIDES: Record<string, string> = {
  "plato-skill": "Plato",
  "kongzi-skill": "Confucius",
  "marx-skill": "Karl Marx",
  "nietzsche-skill": "Friedrich Nietzsche",
  "foucault-skill": "Michel Foucault",
  "socrates-skill": "Socrates",
  "wittgenstein-skill": "Ludwig Wittgenstein",
  "einstein-skill": "Albert Einstein",
  "turing-skill": "Alan Turing",
  "steve-jobs-skill": "Steve Jobs",
  "elon-musk-skill": "Elon Musk",
  "buffett-skill": "Warren Buffett",
  "dalio-skill": "Ray Dalio",
  "leijun-skill": "Lei Jun",
  "huangrenxun-skill": "Jensen Huang",
  "beauvoir-skill": "Simone de Beauvoir",
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_TAIL = /-(?:skill|skills|perspective|persona|pov|profile|framework|thinking)$/;

export function enName(c: { id: string; name?: string; zhName?: string }): string {
  const override = EN_NAME_OVERRIDES[c.id];
  if (override !== undefined) return override;
  const raw = (c.name || "").trim();
  if (raw === "") return (c.zhName || "").trim() || c.id;
  if (SLUG.test(raw) === false) return raw;   // 已经是正常英文名（含空格或大写）
  let s = raw;
  while (SLUG_TAIL.test(s)) s = s.replace(SLUG_TAIL, "");
  if (s === "") s = raw;
  return s.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export const characterMetaById: Record<string, CharacterMeta> = Object.fromEntries(
  characterMeta.map((c) => [c.id, c])
);

