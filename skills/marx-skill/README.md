# 马克思.skill

当前展示：中文 | English: [README_EN.md](README_EN.md)

[![GitHub stars](https://img.shields.io/github/stars/Nhj-sz/marx-skill?style=social)](https://github.com/Nhj-sz/marx-skill)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Quality Check](https://github.com/Nhj-sz/marx-skill/actions/workflows/quality-check.yml/badge.svg)](https://github.com/Nhj-sz/marx-skill/actions/workflows/quality-check.yml)
[![skills.sh](https://img.shields.io/badge/skills.sh-compatible-brightgreen)](https://skills.sh)

卡尔·马克思人格与思维操作系统（Persona Skill）。

## 项目简介

本项目提供一个可直接调用的马克思主义分析人格，强调：

- 历史唯物主义视角
- 阶级与生产关系分析
- 辩证法推理路径
- 研究优先（先查数据，再做判断）
- 实践导向（不仅解释世界，也强调改变世界）

## 适用场景

- AI 与就业关系分析
- 平台经济与剩余价值讨论
- 意识形态与社会叙事批判
- 学术写作提纲与理论框架输出
- 结合 `docx` 进行论文草稿与修订流程

## 核心能力

1. 角色一致性：以马克思一人称视角输出，逻辑严密、立场清晰。
2. Agentic 工作流：涉及现实问题时优先调研事实与数据。
3. 心智模型体系：覆盖历史唯物主义、商品拜物教、剩余价值、辩证法、实践等关键框架。
4. 反教条机制：强调“具体问题具体分析”，避免口号化回答。
5. 质量自检：内置 `quality_check.py` 对输出进行结构与概念完整度评分。

## 快速安装

```bash
# 全局安装（推荐）
npx skills add Nhj-sz/marx-skill -g -y

# 本地开发模式
npx skills add file:///d:/马克思/marx-skill
```

## 激活示例

```text
用马克思视角分析2026年AI对就业结构的影响
```

```text
切换到马克思.skill，评估平台经济中的剩余价值提取机制
```

## 输出风格（示例）

```text
先给出关键事实与数据来源，再识别主要矛盾与次要矛盾，
随后用辩证法说明矛盾如何演化，最后给出实践方向与条件限制。
```

## 项目结构

```text
marx-skill/
|- SKILL.md
|- README.md
|- README_EN.md
|- LICENSE
|- CONTRIBUTING.md
|- quality_check.py
|- push-to-github.bat
|- examples/
|  \- modern-cases.md
|- references/
|  \- dialectical-examples.md
\- .github/
   \- workflows/
      \- quality-check.yml
```

## 质量检查

```bash
python quality_check.py "同志，当前主要矛盾是什么？请结合生产关系变化分析。"
```

评分输出用于快速判断回答是否满足：

- 核心概念覆盖
- 辩证分析强度
- 角色风格一致性
- 局限说明完整性

## 发布与推送

仓库地址：<https://github.com/Nhj-sz/marx-skill>

```bash
git push -u origin main
```

如需一键流程，可运行：

```bash
./push-to-github.bat
```

## 贡献

欢迎提交 Issue / PR，建议优先补充：

- 新的当代案例（AI、生态、平台劳动等）
- 更高质量的数据来源模板
- 更细的辩证推理示例

详细规范见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目采用 [MIT License](LICENSE)。

---

Philosophers have only interpreted the world, in various ways; the point, however, is to change it.