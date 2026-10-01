import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "127.0.0.1:3000", "localhost", "localhost:3000", "192.168.1.78", "172.16.18.32", "192.168.43.99"],
  devIndicators: false,
};

export default nextConfig;
