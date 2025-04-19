import { PlusIcon } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VitNode: Extendable Framework for Building Apps',
  description:
    'Build with Next.js and Hono.js. It provides a structured, plugin-based architecture with Admin Control Panel that makes development faster and less complex.',
};

export default function HomePage() {
  return (
    <div className="container">
      <section className="relative mt-8 border px-8 py-10 text-center sm:py-20">
        <div className="mx-auto flex max-w-xl flex-col items-center justify-center">
          <span className="group relative mx-0 mb-6 flex max-w-fit flex-row items-center justify-center rounded-2xl bg-white/40 px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#8fdfff1f] backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%] hover:shadow-[inset_0_-5px_10px_#8fdfff3f] dark:bg-black/40">
            <div
              className={`animate-gradient absolute inset-0 block h-full w-full bg-gradient-to-r from-[#ffaa40]/50 via-[#9c40ff]/50 to-[#ffaa40]/50 bg-[length:var(--bg-size)_100%] p-[1px] [border-radius:inherit] ![mask-composite:subtract] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]`}
            />
            🎉{` `}
            VitNode 2.0 in progress...
            {/* <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" /> */}
          </span>

          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Extendable <span className="text-primary">Framework</span> for
            Building <span className="text-primary">Apps</span>
          </h1>
          <p className="text-muted-foreground mt-8 text-balance text-center text-base font-medium leading-relaxed tracking-tight md:text-lg">
            Simplifies development with a powerful Plugin System, Admin Control
            Panel and extensible architecture.
          </p>
          <p className="text-muted-foreground sm:text-md mt-8 max-w-xl text-pretty text-sm">
            Powered by Next.js & Hono.js.
          </p>
        </div>

        <PlusIcon className="absolute -left-2.5 -top-2.5 size-5" />
        <PlusIcon className="absolute -bottom-2.5 -left-2.5 size-5" />
        <PlusIcon className="absolute -bottom-2.5 -right-2.5 size-5" />
        <PlusIcon className="absolute -right-2.5 -top-2.5 size-5" />
      </section>
    </div>
  );
}
