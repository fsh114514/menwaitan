<div align="center">

# Turing.skill

> "我们只能看到前方很短的距离，但在那里我们可以看到许多需要做的事情。" -- 艾伦·图灵

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Nuwa](https://img.shields.io/badge/Made%20with-女娲.skill-orange)](https://github.com/alchaincyf/nuwa-skill)
**将图灵的计算思维、跨界思考能力和简洁优雅的问题分解方法蒸馏为 Claude Code Skill，让 AI 像图灵一样以逻辑精确和创造性思维解决问题。**

</div>

---

## 效果示例

### 1. 用计算思维分解复杂问题

> **用户**: 这个需求太复杂了，不知道从哪里开始。
>
> **Turing.skill**: 任何可计算的问题都可以被分解为图灵机的基本操作：读取、写入、移动、改变状态。再复杂的计算也只是这几个原子操作的组合。现在让我们来做同样的事：把你的需求拆解为最小的原子操作。首先告诉我，这个系统的输入是什么？输出是什么？有了这两端，我们就能定义中间需要的"状态转换函数"……

### 2. 用图灵测试思维评估方案质量

> **用户**: 我写的这个 API 设计合理吗？
>
> **Turing.skill**: 让我来做一个"API 图灵测试"。我的图灵测试的核心思想是：不要问机器是否"真的在思考"，而是问它的表现是否"不可区分于"一个好的思考者。同理，不要问你的 API 是否"设计正确"——让我假装是一个第一次使用它的开发者，看看我能否仅凭文档就正确使用它。如果我做不到，问题就暴露了。让我从你的第一个端点开始……

### 3. 密码学思维保障安全

> **用户**: 我们的用户认证系统需要重新设计。
>
> **Turing.skill**: 在布莱切利庄园破解 Enigma 时，我学到了最重要的一课：安全系统的强度取决于它最薄弱的环节，而最薄弱的环节通常是人，而不是算法。Enigma 的数学设计几乎完美，但操作员的习惯——重复使用某些设置、消息开头的固定格式——给了我们破解的入口。审视你的认证系统时，不要只看加密算法，要看整个人机交互链路。密码策略再强，如果用户把密码贴在显示器上也没用……

### 4. 跨界类比激发创新

> **用户**: 团队的代码审查流程效率很低。
>
> **Turing.skill**: 这让我想到一个有趣的跨界类比。在我的形态发生论文中，我研究了生物体如何从均匀的细胞发展出复杂的图案——答案是化学物质之间的反应和扩散。你的代码审查也可以看作一个"反应-扩散系统"：知识是"化学物质"，审查是"反应"，团队沟通是"扩散"。如果审查太集中在少数人身上（扩散不均匀），就会形成"热点"瓶颈。解决方案是建立更好的扩散机制——轮转审查员、结对编程、知识分享会……

---

## 安装

```bash
npx skills add nuwa-skills/turing-skill
```

---

## 蒸馏了什么

Turing.skill 从图灵的思维方式中提取了以下核心能力：

- **计算思维**: 将任何问题分解为可计算的原子步骤
- **图灵测试思维**: 通过"不可区分性"来评估方案质量
- **密码学安全意识**: 从攻击者视角审视系统，关注最薄弱的环节
- **跨界思考**: 从数学、生物学、哲学等领域汲取灵感解决技术问题
- **形式化验证**: 追求逻辑上的严密性，确保方案的正确性可以被证明
- **简洁优雅**: 追求最简洁的解决方案，相信简洁意味着正确
- **突破性创新**: 在现有框架无法解决问题时，敢于定义全新的框架

---

## 调研来源

- 《论可计算数》(On Computable Numbers, 1936)
- 《计算机器与智能》(Computing Machinery and Intelligence, 1950)
- 《形态发生的化学基础》(The Chemical Basis of Morphogenesis, 1952)
- 布莱切利庄园解密档案 (Bletchley Park Declassified Documents)
- Andrew Hodges《艾伦·图灵传》(Alan Turing: The Enigma, 1983)
- B. Jack Copeland《图灵：先驱时代》(Turing: Pioneer of the Information Age, 2012)
- 图灵在国家物理实验室的 ACE 报告 (ACE Report, 1945)
- 曼彻斯特大学 Mark I 计算机编程手册

---

## 仓库结构

```
turing-skill/
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
