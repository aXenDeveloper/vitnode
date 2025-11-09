import { vitNodeNextConfig } from "@vitnode/core/config/next.config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default vitNodeNextConfig(nextConfig);
