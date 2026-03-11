import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@foundation/db",
    "@foundation/domain",
    "@foundation/validators",
  ],
};

export default nextConfig;
