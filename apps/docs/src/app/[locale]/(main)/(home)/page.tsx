import type { Metadata } from 'next';

import { buttonVariants } from '@vitnode/core/components/ui/button';
import { cn } from '@vitnode/core/lib/utils';
import Link from 'fumadocs-core/link';

import { AnimatedBeamHome } from '../../../../components/animated-beam/animated-beam-home';
import { AdminSection } from './sections/admin/admin';
import { CallToActionSection } from './sections/call-to-action';
import { PoweringBySection } from './sections/powering-by/powering-by';

export const metadata: Metadata = {
  title: 'VitNode: Extendable Framework for Building Apps',
  description:
    'Build with Next.js and Hono.js. It provides a structured, plugin-based architecture with Admin Control Panel that makes development faster and less complex.',
};

export default function HomePage() {
  return (
    <div className="container">
      <section className="my-20 flex flex-col justify-between gap-20 lg:flex-row">
        <div className="flex max-w-2xl flex-col">
          <span className="group relative mx-0 mb-6 flex max-w-fit flex-row items-center justify-center rounded-2xl bg-white/40 px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#8fdfff1f] backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%] hover:shadow-[inset_0_-5px_10px_#8fdfff3f] dark:bg-black/40">
            <div
              className={`animate-gradient absolute inset-0 block h-full w-full bg-gradient-to-r from-[#ffaa40]/50 via-[#9c40ff]/50 to-[#ffaa40]/50 bg-[length:var(--bg-size)_100%] p-[1px] [border-radius:inherit] ![mask-composite:subtract] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]`}
            />
            🎉{` `}
            VitNode 2.0 in progress...
            {/* <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" /> */}
          </span>

          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Extendable <span className="text-primary">Framework</span> for
            Building <span className="text-primary">Apps</span>
          </h1>

          <p className="text-muted-foreground mt-6 text-balance leading-relaxed md:text-lg">
            Simplifies development with a powerful Plugin System, Admin Control
            Panel and extensible architecture.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              className={cn(
                buttonVariants({
                  size: 'lg',
                }),
              )}
              href="/docs/dev"
            >
              Get Started
            </Link>

            <Link
              className={cn(
                buttonVariants({
                  size: 'lg',
                  variant: 'ghost',
                }),
              )}
              href="https://github.com/VitNode/vitnode"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                className="mr-2 size-4"
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  fill="currentColor"
                />
              </svg>
              View on GitHub
            </Link>
          </div>
        </div>

        <AnimatedBeamHome />
      </section>

      <PoweringBySection />
      <AdminSection />

      <CallToActionSection />
    </div>
  );
}
