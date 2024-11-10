import createNextIntlPlugin from 'next-intl/plugin';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({
  path: join(process.cwd(), '..', '..', '.env'),
});

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig = config => {
  const ENVS = {
    backend_url: process.env.NEXT_PUBLIC_BACKEND_URL,
    frontend_url: process.env.NEXT_PUBLIC_FRONTEND_URL,
  };

  const urls = {
    backend: new URL(ENVS.backend_url ?? 'http://localhost:8080'),
    frontend: new URL(ENVS.frontend_url ?? 'http://localhost:3000'),
  };

  return {
    ...config,
    devIndicators: {
      appIsrStatus: false,
    },
    env: {
      NEXT_PUBLIC_BACKEND_URL: ENVS.backend_url,
      NEXT_PUBLIC_FRONTEND_URL: ENVS.frontend_url,
    },
    transpilePackages: ['lucide-react', 'vitnode-frontend', 'vitnode-shared'],
    images: {
      remotePatterns: [
        {
          protocol: urls.backend.protocol === 'https:' ? 'https' : 'http',
          hostname: urls.backend.hostname,
          port: urls.backend.port,
          pathname: '/public/**',
        },
      ],
    },
  };
};

export default function NextConfigDefault(config) {
  return withNextIntl(nextConfig(config || {}));
}
