import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace dependencies from the monorepo root so that workspace packages
  // (and their deps like drizzle-orm, postgres, lucia) are included in
  // the standalone output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: [
    "@foundation/db",
    "@foundation/domain",
    "@foundation/validators",
  ],
};

export default nextConfig;
