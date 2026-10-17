import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 用 127.0.0.1 打开 dev 服务时，Next 会以「跨域访问 dev 资源」为由拦掉 JS chunk，
  // 表现为页面能看但完全点不动。把本机回环地址也加进来（踩过这个坑）。
  allowedDevOrigins: ["192.168.2.162", "127.0.0.1", "localhost", "192.168.100.102"],
};

export default nextConfig;
