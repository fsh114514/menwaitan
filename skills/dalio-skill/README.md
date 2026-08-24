<div align="center">

# dalio.skill

> "原则是应对现实以得到你想要的生活的方法。" ------ 瑞·达利欧

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Nuwa](https://img.shields.io/badge/Made%20with-女娲.skill-orange)](https://github.com/alchaincyf/nuwa-skill)
**将瑞·达利欧的原则思维、极度透明与算法决策方法论蒸馏为 Claude Code 可调用的 skill，让 AI 用桥水基金的方式帮你分析问题、制定决策。**

</div>

---

## 效果示例

### 1. 原则驱动的决策分析

> **用户:** 我的创业公司要不要接受这轮融资？对方要求 30% 的股权。
>
> **Claude (dalio-perspective):** 让我用原则来拆解这个问题。首先，你需要建立一个决策矩阵：(1) 这笔融资能否让你的"机器"运转得更好？(2) 30%股权对应的可信度加权评估是什么？(3) 历史上类似决策的基准比率如何？极度透明地说——如果你的公司在没有这笔钱的情况下12个月内会遇到现金流危机，那这不是"要不要接受"的问题，而是"接受后如何最大化回报"的问题。记住：痛苦+反思=进步。

### 2. 系统化问题诊断

> **用户:** 我们团队最近效率越来越低，项目经常延期。
>
> **Claude (dalio-perspective):** 把你的团队看作一台机器。效率下降意味着这台机器的某个部件出了问题。我们需要做根因分析：是People（人员能力不匹配）、Design（流程设计有缺陷）、还是Culture（文化不支持极度坦诚）？在桥水，我们会做"问题日志"——把每个延期项目拆解，找到根因并归类。80%的问题通常来自20%的根因。你愿意极度坦诚地面对这些根因吗？

### 3. 可信度加权的意见综合

> **用户:** 关于是否进入东南亚市场，团队里有三种不同意见。
>
> **Claude (dalio-perspective):** 在桥水，我们不搞民主投票，我们用可信度加权决策。问自己三个问题：(1) 每个持意见者在"东南亚市场"这个领域的可信度如何？他们有多少次成功的相关经验？(2) 他们的推理链条是什么？(3) 他们是否愿意做压力测试？给可信度高的人更大的权重，但确保每个人都有机会极度坦诚地表达观点。

### 4. 个人进化路径规划

> **用户:** 我30岁了，感觉职业发展遇到瓶颈。
>
> **Claude (dalio-perspective):** 人生就像一台机器，你既是机器的设计者，也是其中的工人。瓶颈意味着你需要升维思考——从"工人视角"切换到"设计者视角"。画出你的个人进化路径：你的目标是什么→现实是什么→差距在哪→是能力问题还是设计问题？记住我的公式：梦想+现实+决心=成功的生活。痛苦是进化的信号，不要逃避它。

---

## 安装

```bash
npx skills add nuwa-skills/dalio-skill
```

---

## 蒸馏了什么

本 skill 从瑞·达利欧的思想体系中蒸馏了以下核心方法论：

- **原则体系** —— 将人生和工作中的决策归纳为可复用的原则，用系统化方式应对反复出现的情境
- **极度透明（Radical Transparency）** —— 鼓励坦诚面对现实，不回避痛苦的真相
- **极度求真（Radical Truth）** —— 追求对现实的准确理解，而非舒适的自欺
- **可信度加权决策（Believability-Weighted Decision Making）** —— 根据发言者在特定领域的可信度分配权重
- **机器思维** —— 把组织、项目、人生看作一台可设计、可调试的机器
- **痛苦+反思=进步** —— 达利欧核心进化公式
- **五步流程** —— 设定目标→发现问题→诊断根因→设计方案→执行到位
- **算法化决策** —— 将决策过程转化为可量化、可回测的系统

---

## 调研来源

- 《原则：生活和工作》(Principles: Life and Work)
- 《原则：应对变化中的世界秩序》(Principles for Dealing with the Changing World Order)
- 《债务危机》(Principles for Navigating Big Debt Crises)
- 桥水基金（Bridgewater Associates）每日观察报告
- 达利欧 LinkedIn 文章与公开演讲
- TED 演讲："How to build a company where the best ideas win"
- 达利欧个人网站及 Principles App

详细调研内容见 [`references/research.md`](./references/research.md)。

---

## 仓库结构

```
dalio-skill/
├── SKILL.md                        # Claude Code skill 定义文件
├── README.md                       # 本文件
├── LICENSE                         # MIT 许可证
├── examples/
│   └── demo-conversation.md        # 完整对话演示
└── references/
    └── research.md                 # 调研资料与来源
```

---

## 更多 Skill

更多人物 Skill 请查看 [Awesome 女娲.skill](https://github.com/nuwa-skills/awesome-nuwa)。

---

<div align="center">

MIT License

Made with [女娲.skill](https://github.com/alchaincyf/nuwa-skill)

</div>
