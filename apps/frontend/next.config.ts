import type { NextConfig } from 'next';
import VitNodeConfig from 'vitnode-frontend/next.config';

const nextConfig: NextConfig = {
  // output: 'standalone',
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default VitNodeConfig(nextConfig);
