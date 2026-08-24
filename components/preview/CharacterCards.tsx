"use client";
import { useState } from "react";
import { previewCharacters } from "@/lib/previewCharacters";

export default function CharacterCards() {
  const [selected, setSelected] = useState<string[]>(["zhangxuefeng"]);
  const [flipped, setFlipped] = useState<string | null>(null);
  const toggle = (id: string) => {
    setFlipped((f) => (f === id ? null : id));
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  return (
    <section className="px-personas">
      <div className="px-ghost" aria-hidden="true">辩</div>
      <div className="px-section-head"><span>人物志</span><i>六位思想家 · 可多选入席</i></div>
      <div className="px-cards">
        {previewCharacters.map((c, i) => {
          const active = selected.includes(c.id);
          const isFlipped = flipped === c.id;
          const no = "NO." + String(i + 1).padStart(2, "0");
          return (
            <div key={c.id} className={"px-card-wrap" + (i === 0 ? " featured" : "")} style={{ animationDelay: (0.08 * i + 0.15) + "s" }}>
              <button
                className={"px-card" + (isFlipped ? " flipped" : "") + (active ? " active" : "")}
                onClick={() => toggle(c.id)}
              >
                <div className="face front">
                  <span className="px-card-index">{no}</span>
                  <span className="px-card-badge" style={{ background: c.color }}>{c.initial}</span>
                  <span className="px-card-name">{c.zhName}</span>
                  <span className="px-card-school">{c.school}</span>
                </div>
                <div className="face back">
                  <span className="px-card-back-name">{c.zhName} · {c.tag}</span>
                  <span className="px-card-tag">{c.school}。{c.tag}。</span>
                  <span className="px-card-enter">{active ? "已入席" : "点击入席"} →</span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

