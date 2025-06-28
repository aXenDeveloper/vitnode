import Link from 'next/link';
import { InfiniteSlider } from '../../../../components/infinite-slider';
import { NextJSLogo } from './logos/nextjs';
import { HonoJSLogo } from './logos/honojs';
import { TailwindCSSLogo } from './logos/tailwindcss';
import { DrizzleORMLogo } from './logos/drizzleorm';
import { PostgreSQLLogo } from './logos/postgresql';
import { NextIntlLogo } from './logos/next-intl';

export const PoweringBySection = () => {
  return (
    <section className="bg-background overflow-hidden py-16">
      <div className="group relative m-auto max-w-7xl px-6">
        <div className="flex flex-col items-center md:flex-row">
          <div className="md:max-w-44 md:border-r md:pr-6">
            <p className="text-end text-sm">Powering by the best tools</p>
          </div>
          <div className="relative py-6 md:w-[calc(100%-11rem)]">
            <InfiniteSlider speedOnHover={20} speed={40} gap={100}>
              <Link
                href="https://tailwindcss.com/"
                target="_blank"
                className="flex items-center justify-center"
                rel="noopener noreferrer"
              >
                <TailwindCSSLogo />
              </Link>
              <Link
                href="https://nextjs.org/"
                target="_blank"
                className="flex items-center justify-center"
                rel="noopener noreferrer"
              >
                <NextJSLogo />
              </Link>
              <Link
                href="https://hono.dev/"
                target="_blank"
                className="flex items-center justify-center gap-2"
                rel="noopener noreferrer"
              >
                <HonoJSLogo />
              </Link>
              <Link
                href="https://orm.drizzle.team/"
                target="_blank"
                className="flex items-center justify-center"
                rel="noopener noreferrer"
              >
                <DrizzleORMLogo />
              </Link>

              <Link
                href="https://www.postgresql.org/"
                target="_blank"
                className="flex items-center justify-center gap-2"
                rel="noopener noreferrer"
              >
                <PostgreSQLLogo />
              </Link>
              <Link
                href="https://next-intl.dev/"
                target="_blank"
                className="flex items-center justify-center"
                rel="noopener noreferrer"
              >
                <NextIntlLogo />
              </Link>
            </InfiniteSlider>

            <div className="bg-linear-to-r from-background absolute inset-y-0 left-0 w-20"></div>
            <div className="bg-linear-to-l from-background absolute inset-y-0 right-0 w-20"></div>
            {/* <ProgressiveBlur
              className="pointer-events-none absolute left-0 top-0 h-full w-20"
              direction="left"
              blurIntensity={1}
            />
            <ProgressiveBlur
              className="pointer-events-none absolute right-0 top-0 h-full w-20"
              direction="right"
              blurIntensity={1}
            /> */}
          </div>
        </div>
      </div>
    </section>
  );
};
