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
  { id: "zhangxuefeng", zhName: "张雪峰", name: "Zhang Xuefeng", initial: "张", school: "教育 · 职业规划", tag: "普通家庭路线", color: "#c0392b", skillDir: "zhangxuefeng" },
  { id: "fengge", zhName: "峰哥", name: "Feng Ge", initial: "峰", school: "江湖现实主义", tag: "亡命天涯", color: "#2e8a5e", skillDir: "fengge" },
  { id: "maoxuan", zhName: "毛选", name: "Mao Xuan", initial: "毛", school: "矛盾分析 · 战略", tag: "实践论", color: "#8f1f19", skillDir: "maoxuan" },
  { id: "luxun", zhName: "鲁迅", name: "Lu Xun", initial: "鲁", school: "批判 · 国民性", tag: "铁屋中的呐喊", color: "#3a3a3a", skillDir: "luxun" },
  { id: "hayek", zhName: "哈耶克", name: "Hayek", initial: "哈", school: "自发秩序", tag: "通往奴役之路", color: "#2e5d8a", skillDir: "hayek" },
  { id: "keynes", zhName: "凯恩斯", name: "Keynes", initial: "凯", school: "有效需求", tag: "动物精神", color: "#8a6a2e", skillDir: "keynes" },
];

export const characterMetaById: Record<string, CharacterMeta> = Object.fromEntries(
  characterMeta.map((c) => [c.id, c])
);

