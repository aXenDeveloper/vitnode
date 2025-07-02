import type { NextConfig } from 'next';
import { createMDX } from 'fumadocs-mdx/next';
import { vitNodeNextConfig } from '@vitnode/core/config/next.config';

const withMDX = createMDX();

const nextConfig: NextConfig = {
  experimental: {
    inlineCss: true,
    reactCompiler: true,
  },
};

export default withMDX(vitNodeNextConfig(nextConfig));
