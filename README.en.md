# 门外谈 · Menwai Tan

**An AI thinkers' debate club — talk, argue, and clash with a roster of distilled personas.**

[English](README.en.md) · **中文** ([中文版](README.md)) · 🌐 [Live Demo](https://outgate.chat)

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![License](https://img.shields.io/badge/License-MIT-green)

> Pick a seat, throw a question, and watch Lu Xun, Marx, Confucius and Steve Jobs argue it out — in a paper-and-ink editorial aesthetic.
>
> **v2's core idea: an information layer on top of the round table.** A message can be visible to one speaker only.
> You can whisper to a single persona; the others have no idea. Whoever you told will eventually call the other out in public —
> so the discussion stops being turn-taking and becomes a game with undercurrents.

![Menwai Tan screenshot](docs/screenshot-v2.jpg)

## Features

- **Information layer (v2)** — visibility / whisper / call-out / novelty / host wrap-up, five mechanisms forming one chain
- **Roster of thinkers** — 35 personas, one SKILL.md each, distilled by the open-source community
- **One-on-one or round table** — chat solo, or pit several thinkers against each other in turns
- **Scene system** — Casual / Serious / Heated control answer length & tone, with auto-escalation
- **Streaming replies** — SSE with a typewriter effect
- **Dossier view** — background, signature quotes and source repo for every persona
- **BYOK** — bring your own API key, or use the built-in free channel (Zhipu GLM-4-Flash)
- **Touch-drag on mobile** — long-press to reorder seats, fully responsive

## Quick Start

```bash
pnpm install
cp .env.local.example .env.local   # fill in your AI_API_KEY (GLM-4-Flash is free)
pnpm dev
```

Open http://localhost:3000. Production build:

```bash
pnpm build && pnpm start -p 3100
```

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · OpenAI SDK (DeepSeek / Zhipu GLM)

## Credits

Personas distilled from the open-source community; bio excerpts from upstream READMEs — copyright belongs to their authors.

## License

MIT
