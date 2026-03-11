import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@foundation/db",
    "@foundation/domain",
    "@foundation/validators",
  ],
};

export default nextConfig;
