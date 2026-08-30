import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from '@vitnode/core/lib/utils'
import { ChevronRight } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

/**
 * GitHub's mark, decorative.
 *
 * `aria-hidden` and no `<title>`: the link it sits in already says "View on
 * GitHub" in text, and the Next.js version's `role="img"` plus title made a
 * screen reader announce "GitHub View on GitHub".
 */
const GitHubIcon = () => (
  <svg
    aria-hidden
    className="mr-2 size-4"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      fill="currentColor"
    />
  </svg>
)

/**
 * The front page's opening screen: the product's one sentence, and the two
 * things a reader can do about it.
 *
 * The headline, the sub-line and both buttons are the Next.js page's, word for
 * word. Neither names a framework, so this migration left the positioning alone
 * - only the description in `metadata.ts` had a factual claim to correct.
 *
 * ## The two links are two different kinds of link, deliberately
 *
 * **Get Started** goes to `/docs/dev`, which the Next.js application still
 * serves until Stage 16. It uses the injected {@link SiteLinkComponent}, which
 * asks the route tree whether *this* application can render the destination, and
 * for `/docs/dev` the answer is no - so it becomes a full-document navigation to
 * the legacy origin, with the locale prefix applied exactly once. When Stage 16
 * puts `/docs` in this route tree, the same component starts client-navigating
 * to it and this file does not change. There is no `startsWith('/docs')` here,
 * and there must not be: which application owns a path is one decision, made in
 * `#/migration/navigation`, not a special case a page gets to hold an opinion
 * about.
 *
 * **View on GitHub** is a plain `<a>`, because it leaves VitNode altogether.
 * The migration link answers "which of our two applications serves this", and
 * for `github.com` the answer is neither - handing it an absolute URL would ask
 * a question that has no true answer. `rel="noopener noreferrer"` with
 * `target="_blank"`.
 *
 * `visual` is a slot rather than an import so that the hero does not decide how
 * the beam is loaded; see `home-content.tsx`, which puts a lazy boundary there.
 * The Next.js page had `<div>something</div>` in this position - a placeholder
 * that was never filled in - and rendered the beam full-width further down the
 * page, where its own `sm:max-w-md` left it stranded in the middle of a wide
 * container. Filling the slot it was clearly waiting for is the one layout
 * decision this migration made.
 */
export const HeroSection = ({
  LinkComponent,
  visual,
}: {
  LinkComponent: SiteLinkComponent
  visual: React.ReactNode
}) => (
  <section className="border-border/50 mt-6 flex flex-col justify-between gap-20 border-r bg-[linear-gradient(to_right,color-mix(in_oklab,var(--border)_75%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_75%,transparent)_1px,transparent_1px)] bg-[size:63px_63px] px-6 py-10 sm:mt-10 sm:px-10 sm:py-20 lg:flex-row dark:bg-[linear-gradient(to_right,color-mix(in_oklab,var(--border)_50%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_50%,transparent)_1px,transparent_1px)]">
    <div className="flex max-w-2xl flex-col">
      <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
        Community <span className="text-primary">Framework</span> for Building{' '}
        <span className="text-primary">Apps</span>
      </h1>

      <p className="text-muted-foreground mt-6 leading-relaxed text-balance md:text-lg">
        Simplifies development with a powerful Plugin System, Admin Control
        Panel and extensible architecture.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <LinkComponent
          className={cn(buttonVariants({ size: 'lg' }))}
          href="/docs/dev"
        >
          <ChevronRight aria-hidden /> Get Started
        </LinkComponent>

        <a
          className={cn(
            buttonVariants({ size: 'lg', variant: 'link' }),
            'text-foreground',
          )}
          href="https://github.com/VitNode/vitnode"
          rel="noopener noreferrer"
          target="_blank"
        >
          <GitHubIcon />
          View on GitHub
        </a>
      </div>
    </div>

    {visual}
  </section>
)
