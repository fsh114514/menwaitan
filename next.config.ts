import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.2.162"],
  // 老域名（Sealos）自动 301 到新域名，老书签/链接无缝迁移
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "kbonhopftimt.sealosbja.site" }],
        destination: "https://outgate.chat/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
