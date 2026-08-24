// 预览用角色数据（真实角色将由 skills/ 目录驱动，见项目计划）
export interface PreviewCharacter {
  id: string;
  name: string;
  zhName: string;
  initial: string;
  school: string;
  tag: string;
  color: string;
}

export const previewCharacters: PreviewCharacter[] = [
  { id: "zhangxuefeng", name: "Zhang Xuefeng", zhName: "张雪峰", initial: "张", school: "教育 · 职业规划", tag: "普通家庭路线", color: "#d3381c" },
  { id: "fengge", name: "Feng Ge", zhName: "峰哥", initial: "峰", school: "江湖现实主义", tag: "亡命天涯", color: "#2e8a5e" },
  { id: "maoxuan", name: "Mao Xuan", zhName: "毛选", initial: "毛", school: "矛盾分析 · 战略", tag: "实践论", color: "#b03a2e" },
  { id: "luxun", name: "Lu Xun", zhName: "鲁迅", initial: "鲁", school: "批判 · 国民性", tag: "铁屋中的呐喊", color: "#454545" },
  { id: "hayek", name: "Hayek", zhName: "哈耶克", initial: "哈", school: "自发秩序", tag: "通往奴役之路", color: "#2e5d8a" },
  { id: "keynes", name: "Keynes", zhName: "凯恩斯", initial: "凯", school: "有效需求", tag: "动物精神", color: "#8a6a2e" },
];

