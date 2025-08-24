import { vitNodeNextConfig } from '@vitnode/core/config/next.config';
import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const withMDX = createMDX();

const nextConfig: NextConfig = {
  experimental: {
    inlineCss: true,
    reactCompiler: true,
  },
};

export default withMDX(vitNodeNextConfig(nextConfig));
