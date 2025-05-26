import type { NextConfig } from 'next';
import { vitNodeNextConfig } from '@vitnode/core/config/next.config';

const nextConfig: NextConfig = {
  experimental: {
    inlineCss: true,
    reactCompiler: true,
  },
};

export default vitNodeNextConfig(nextConfig);
