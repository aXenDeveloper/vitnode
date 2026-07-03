import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/vitnode.config.ts");

export const vitNodeNextConfig = (config: NextConfig): NextConfig =>
  withNextIntl({
    ...config,
    serverExternalPackages: [
      ...(config.serverExternalPackages ?? []),
      "ioredis",
    ],
  });
