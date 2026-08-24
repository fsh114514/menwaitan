"use client";
import { useState } from "react";

type Msg = { role: string; who?: string; color?: string; text: string };

const initial: Msg[] = [
  { role: "user", text: "AI 时代，普通人到底该学什么、做什么？你们几个吵一架给我看看。" },
  { role: "ai", who: "张雪峰", color: "#c0392b", text: "我跟你说，先别听网上吹 AI 焦虑。普通家庭出身，看就业数据：现在会用 AI 工具的人，起薪比不会的人高两三千。学什么？学「AI 用得好的专业」，不是学「AI 专业」。" },
  { role: "ai", who: "毛选", color: "#8f1f19", text: "矛盾要抓主要矛盾。对普通人而言，主要矛盾不是学不学 AI，而是「有没有根据地」。先有一技之长立足，再谈技术浪潮。星星之火，可以燎原。" },
  { role: "ai", who: "鲁迅", color: "#3a3a3a", text: "学什么其实不打紧。怕的是学了 AI，却还是只会人云亦云。愿中国青年都摆脱冷气，只是向上走，不必听自暴自弃者流的话。" },
];

export default function ChatPanel() {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const send = () => {
    const v = input.trim();
    if (v === "") return;
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [
        ...m,
        { role: "user", text: v },
        { role: "ai", who: "哈耶克", color: "#2e5d8a", text: "（样板模式：真实对谈将在角色系统接入后启用。）" },
      ]);
    }, 900);
  };
  return (
    <section className="px-reveal">
      <div className="px-chat-grid">
        <div className="px-chat-label">
          <span className="rot">辩论室 · 逐字稿</span>
          <p className="meta">第壹期<br />跨越时代的辩论室<br />样板 · 静态演示</p>
        </div>
        <div className="px-chat-col">
          <div className="px-chat">
            <div className="px-chat-head"><span>DEBATE LOG</span><span>样板 · 静态演示</span></div>
            <div className="px-chat-body">
              {msgs.map((m, i) => (
                <div key={i} className={"px-msg " + (m.role === "user" ? "user" : "ai")} style={{ animationDelay: (0.06 * i) + "s" }}>
                  {m.who && <div className="px-msg-who" style={{ color: m.color }}>■ {m.who}</div>}
                  <div>{m.text}</div>
                </div>
              ))}
              {typing && (
                <div className="px-msg ai px-typing"><span></span><span></span><span></span></div>
              )}
            </div>
            <div className="px-chat-input">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="抛出一个议题，让思想家们交锋…" />
              <button className="px-btn" onClick={send}>发言</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

