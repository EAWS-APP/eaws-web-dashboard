import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.78", "172.16.18.32", "localhost:3000"],
  devIndicators: false,
};

export default nextConfig;
