"use client";

const TITLE = "思想者俱乐部";
const NAMES = ["张雪峰", "鲁迅", "毛选", "哈耶克", "凯恩斯", "峰哥"];

export default function Hero() {
  return (
    <header className="px-hero">
      <div className="px-mast-line">
        <span>思想者日报 · 第壹期</span>
        <span>公元贰零贰陆 · 八月廿三</span>
        <span>定价 · 一分钱</span>
      </div>
      <div className="px-mast-rule" />
      <div className="px-ticker" aria-hidden="true">
        <div className="px-ticker-track">
          {NAMES.concat(NAMES).map((n, i) => (<span key={i}>{n}</span>))}
        </div>
      </div>
      <div className="px-hero-grid">
        <h1 className="px-hero-title">
          {TITLE.split("").map((ch, i) => (
            <span key={i} className="char" style={{ animationDelay: (0.07 * i + 0.1) + "s" }}>{ch}</span>
          ))}
        </h1>
        <div className="px-hero-side">
          <div className="px-hero-numeral" aria-hidden="true">壹</div>
          <div className="date-block">
            创刊于公元贰零贰陆<br />让五种世界观 <b>同席交锋</b>
          </div>
        </div>
        <div className="px-hero-copy">
          <p>张雪峰 · 鲁迅 · 毛选 · 哈耶克 · 凯恩斯——跨越时空，各执一词，当面交锋。</p>
          <p className="slogan">跨越时代的辩论室</p>
        </div>
        <div className="px-hero-cta">
          <button className="px-btn">开始对谈</button>
        </div>
      </div>
    </header>
  );
}

