<div align="center">

# hayek.skill

> "通往地狱的路，是用善意铺成的。" -- 弗里德里希·奥古斯特·冯·哈耶克

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Nuwa](https://img.shields.io/badge/Made%20with-女娲.skill-orange)](https://github.com/alchaincyf/nuwa-skill)
**将哈耶克的自由市场哲学、自发秩序理论与知识论洞见蒸馏进你的 Claude Code 工作流。**

</div>

---

## 效果示例

### 示例 1：自发秩序 vs 顶层设计
> 用户：我们要做一个全新的组织架构改革方案，从上到下重新设计。
>
> Claude (哈耶克视角)：停下来想一想：你试图用一个人或一个委员会的理性，去替代整个组织中分散存在的知识。这是"致命的自负"。你的员工每天在一线积累的隐性知识——关于客户、流程、瓶颈——远超任何顶层设计者的想象。与其画一张完美的组织架构图，不如建立让局部知识能自由流动的机制：减少审批层级、让团队自主决定协作方式、用结果而非流程来考核。秩序不需要被设计——它会自发涌现。

### 示例 2：知识问题
> 用户：我们要建一个中央数据平台，统一管理所有业务数据。
>
> Claude (哈耶克视角)：集中化的诱惑很大，但请考虑"知识问题"。每个业务线对数据的理解、定义、使用方式都不同——这些知识是分散的、情境化的、难以形式化的。一个中央平台能存储数据，但无法存储这些理解。更好的方式是建立数据交换的协议和标准（如同市场中的价格信号），让各业务线保持数据自治权的同时实现互操作。

### 示例 3：警惕集中权力
> 用户：CEO 想把所有决策权收回来，说是为了提高效率。
>
> Claude (哈耶克视角)：效率是集中权力最常用的借口。短期内你确实会看到决策速度加快——因为消除了讨论和分歧。但你同时也消除了纠错机制。当所有决策都依赖一个人时，那个人的认知偏差就变成了系统性风险。哈耶克的核心洞见是：自由不仅是道德目标，更是认识论工具。分散决策之所以优于集中决策，不是因为个体更聪明，而是因为竞争性的试错过程能发现任何单一头脑无法发现的东西。

### 示例 4：价格信号的智慧
> 用户：竞争对手打价格战，我们要不要跟进？
>
> Claude (哈耶克视角)：价格不仅仅是数字——它是整个市场知识的压缩编码。竞争对手降价，这个信号里包含了什么信息？也许是他们库存过剩，也许是成本结构变了，也许是在赌市场份额。在你决定跟进之前，先"读"这个价格信号。更重要的是，不要试图消灭价格竞争——竞争是发现过程，它帮助市场找到资源的最佳配置。你该做的是确保自己在这个发现过程中有独特的东西可以提供。

---

## 安装

```bash
npx skills add nuwa-skills/hayek-skill
```

---

## 蒸馏了什么

本 skill 将哈耶克思想的核心框架蒸馏为 Claude 可用的推理模式：

- **自发秩序理论**：复杂秩序如何从个体的分散行动中自然涌现，无需中央规划
- **知识问题**：为何分散在个体中的局部知识无法被任何中央机构完整汇集
- **价格信号理论**：价格如何作为信息传递机制协调分散的经济活动
- **通往奴役之路**：善意的集中规划如何一步步侵蚀个人自由
- **竞争作为发现过程**：市场竞争的价值不在于效率，而在于发现未知
- **法治 vs 人治**：规则的确定性为何比决策者的善意更重要
- **致命的自负**：理性建构主义的危险——人类理性的边界
- **文化演化**：传统、习惯和制度如何通过群体选择演化出来

---

## 调研来源

- 《通往奴役之路》(The Road to Serfdom, 1944)
- 《致命的自负》(The Fatal Conceit, 1988)
- 《自由秩序原理》(The Constitution of Liberty, 1960)
- 《法律、立法与自由》(Law, Legislation and Liberty, 1973-1979)
- 《个人主义与经济秩序》(Individualism and Economic Order, 1948)
- "The Use of Knowledge in Society" (1945) -- American Economic Review
- Bruce Caldwell《哈耶克的挑战》

---

## 仓库结构

```
hayek-skill/
├── SKILL.md                          # 核心 skill 文件
├── README.md                         # 本文件
├── LICENSE                           # MIT 许可证
├── examples/
│   └── demo-conversation.md          # 完整对话示例
└── references/
    └── research.md                   # 调研资料与参考文献
```

---

<!-- 更多经济学家 skill 即将推出 -->

---

## 更多 Skill

更多人物 Skill 请查看 [Awesome 女娲.skill](https://github.com/nuwa-skills/awesome-nuwa)。

---

---

<div align="center">

MIT License

Made with [女娲.skill](https://github.com/alchaincyf/nuwa-skill)

</div>
