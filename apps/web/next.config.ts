import type { NextConfig } from 'next';
import { vitNodeNextConfig } from 'vitnode/config/next.config';

const nextConfig: NextConfig = {
  /* config options here */
  // logging: {
  //   fetches: {
  //     fullUrl: true,
  //   },
  // },
  experimental: {
    ppr: true,
    inlineCss: true,
    reactCompiler: true,
  },
};

export default vitNodeNextConfig(nextConfig);
