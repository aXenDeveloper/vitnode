import { Link } from '@vitnode/core/lib/navigation';

import { InfiniteSlider } from '@/components/infinite-slider';

import { DrizzleORMLogo } from './logos/drizzleorm';
import { HonoJSLogo } from './logos/honojs';
import { NextIntlLogo } from './logos/next-intl';
import { NextJSLogo } from './logos/nextjs';
import { PostgreSQLLogo } from './logos/postgresql';
import { TailwindCSSLogo } from './logos/tailwindcss';

export const PoweringBySection = () => {
  return (
    <section className="bg-background overflow-hidden py-16">
      <div className="group relative m-auto max-w-7xl px-6">
        <div className="flex flex-col items-center md:flex-row">
          <div className="md:max-w-44 md:border-r md:pr-6">
            <p className="text-end text-sm">Powering by the best tools</p>
          </div>
          <div className="relative py-6 md:w-[calc(100%-11rem)]">
            <InfiniteSlider gap={100} speed={40} speedOnHover={20}>
              <Link
                className="flex items-center justify-center"
                href="https://tailwindcss.com/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <TailwindCSSLogo />
              </Link>
              <Link
                className="flex items-center justify-center"
                href="https://nextjs.org/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <NextJSLogo />
              </Link>
              <Link
                className="flex items-center justify-center gap-2"
                href="https://hono.dev/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <HonoJSLogo />
              </Link>
              <Link
                className="flex items-center justify-center"
                href="https://orm.drizzle.team/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <DrizzleORMLogo />
              </Link>

              <Link
                className="flex items-center justify-center gap-2"
                href="https://www.postgresql.org/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <PostgreSQLLogo />
              </Link>
              <Link
                className="flex items-center justify-center"
                href="https://next-intl.dev/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <NextIntlLogo />
              </Link>
            </InfiniteSlider>

            <div className="from-background bg-linear-to-r absolute inset-y-0 left-0 w-20"></div>
            <div className="from-background bg-linear-to-l absolute inset-y-0 right-0 w-20"></div>
          </div>
        </div>
      </div>
    </section>
  );
};
