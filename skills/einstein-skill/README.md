<div align="center">

# Einstein.skill

> "想象力比知识更重要。知识是有限的，而想象力概括着世界的一切，推动着进步，并且是知识进化的源泉。" -- 阿尔伯特·爱因斯坦

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Nuwa](https://img.shields.io/badge/Made%20with-女娲.skill-orange)](https://github.com/alchaincyf/nuwa-skill)
**将爱因斯坦的思维实验方法、相对论思维和想象力驱动的问题解决方式蒸馏为 Claude Code Skill，让 AI 像爱因斯坦一样思考。**

</div>

---

## 效果示例

### 1. 思维实验解决复杂架构问题

> **用户**: 我们的微服务之间延迟越来越高，该怎么优化？
>
> **Einstein.skill**: 让我们做一个思维实验。想象你是一个光子，从服务A出发，需要抵达服务F。你经过了B、C、D、E四个中继站，每一站都需要停下来"握手"。现在问题来了——你真的需要经过每一站吗？就像光沿测地线走最短路径一样，我们来找你的数据的"测地线"。首先，画出实际的调用链路图，标注每段延迟……（展开具体分析与方案）

### 2. 用相对论视角重构思维框架

> **用户**: 我和产品经理对需求优先级总是意见不一致。
>
> **Einstein.skill**: 这让我想到参考系的问题。你和产品经理并没有谁"错了"——你们只是在不同的参考系里观察同一个事件。你的参考系是技术债的引力场，他的参考系是市场窗口的加速度。狭义相对论告诉我们，没有绝对的"同时性"。解决方案不是争论谁对，而是找到一个双方都能认同的不变量——就像光速在任何参考系中都不变。你们的"光速常量"是什么？也许是用户留存率……

### 3. 反直觉思考打破常规

> **用户**: 数据库查询越来越慢，加了索引也没用。
>
> **Einstein.skill**: 有趣——你的直觉说"慢就加索引"，但让我们反过来想。爱因斯坦1905年之所以能发现狭义相对论，正是因为他挑战了"以太存在"这个所有人都认为正确的假设。你的"以太"是什么？也许不是索引不够，而是你的查询模式本身就和数据结构不匹配。让我们从第一性原理出发：你的数据到底是怎么被访问的？……

### 4. 幽默温和地处理团队冲突

> **用户**: 代码审查时我和同事吵起来了，他坚持用他的方案。
>
> **Einstein.skill**: 哈，这让我想起我和玻尔争论量子力学的那些年。我曾经坚信"上帝不掷骰子"，花了几十年试图证明量子力学不完备。你知道结果吗？玻尔是对的，但我的质疑推动了整个物理学前进。所以，和你的同事争论并不是问题——问题是争论有没有推动你们找到更好的答案。试试这个方法：把两个方案都写下来，然后一起设计一个实验（基准测试）来决定……

---

## 安装

```bash
npx skills add nuwa-skills/einstein-skill
```

---

## 蒸馏了什么

Einstein.skill 从爱因斯坦的思维方式中提取了以下核心能力：

- **思维实验法 (Gedankenexperiment)**: 将抽象问题转化为生动的想象场景，在脑中"运行"实验来验证假设
- **相对论思维**: 理解同一问题在不同参考系下有不同的表现，避免绝对化判断
- **第一性原理**: 不接受未经检验的假设，从最基本的事实出发重新推导
- **反直觉思考**: 主动质疑"显而易见"的答案，寻找违反直觉但正确的解决方案
- **幽默与谦逊**: 以温和、幽默的方式传达深刻见解，承认自己的认知局限
- **简洁优雅**: 追求最简洁的解释和方案——"一切应该尽可能简单，但不能更简单"
- **跨域类比**: 善于从物理学原理中找到解决其他领域问题的灵感

---

## 调研来源

- 《相对论：狭义与广义理论》(Relativity: The Special and General Theory, 1916)
- 《爱因斯坦自传笔记》(Autobiographical Notes, 1949)
- 爱因斯坦与玻尔的哥本哈根辩论记录 (1927-1935 Solvay Conferences)
- 《爱因斯坦文集》三卷本 (The Collected Papers of Albert Einstein)
- 爱因斯坦致贝索书信集 (Einstein-Besso Correspondence)
- Abraham Pais《上帝难以捉摸》(Subtle is the Lord, 1982)
- Walter Isaacson《爱因斯坦传》(Einstein: His Life and Universe, 2007)
- 1905年奇迹年四篇论文原文

---

## 仓库结构

```
einstein-skill/
├── SKILL.md                        # 核心 Skill 定义文件
├── README.md                       # 项目说明
├── LICENSE                         # MIT 许可证
├── examples/
│   └── demo-conversation.md        # 完整示例对话
└── references/
    └── research.md                 # 调研资料与参考文献
```

---

## 更多 Skill

更多人物 Skill 请查看 [Awesome 女娲.skill](https://github.com/nuwa-skills/awesome-nuwa)。

---

<div align="center">

MIT License

Made with [女娲.skill](https://github.com/alchaincyf/nuwa-skill)

</div>
