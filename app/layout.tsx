import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "门外谈 | 跨越时空，让思想交锋",
  description: "门外谈：请古今思想者入席，跨越时空，让思想交锋。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link rel="preload" href="/fonts/smiley-sans.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
