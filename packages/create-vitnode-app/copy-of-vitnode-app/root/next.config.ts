import { vitNodeNextConfig } from "@vitnode/core/config/next.config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    inlineCss: true,
    ppr: "incremental",
  },
};

export default vitNodeNextConfig(nextConfig);
