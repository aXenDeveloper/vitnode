import nextAnalyzer from "@next/bundle-analyzer";
import { vitNodeNextConfig } from "@vitnode/core/config/next.config";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const withBundleAnalyzer = nextAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  // cacheComponents: true,
  // partialPrefetching: true,
};

export default withBundleAnalyzer(withMDX(vitNodeNextConfig(nextConfig)));
