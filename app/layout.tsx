import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "门外谈 | 跨越时空，让思想交锋",
  description: "门外谈：请古今思想者入席，跨越时空，让思想交锋。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
