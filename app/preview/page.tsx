"use client";
import { useEffect } from "react";
import BackgroundFX from "@/components/preview/BackgroundFX";
import Hero from "@/components/preview/Hero";
import CharacterCards from "@/components/preview/CharacterCards";
import ChatPanel from "@/components/preview/ChatPanel";
import "@designcodeio/threeui/style.css";
import "./preview.css";

export default function PreviewPage() {
  useEffect(() => {
    const els = document.querySelectorAll(".px-reveal");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="px-shell">
      <div className="px-bg"><BackgroundFX /></div>
      <div className="px-content">
        <Hero />
        <CharacterCards />
        <ChatPanel />
        <footer className="px-footer">
          <span><b>思想者俱乐部</b> · 跨越时代的辩论室</span>
          <span>第壹期 · 公元贰零贰陆 · 一分钱</span>
        </footer>
      </div>
    </div>
  );
}

