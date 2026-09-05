import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { AUTHOR_NAME, AUTHOR_URL, LICENSE_URL, REPOSITORY_URL } from './links'
import { CanaryPill, GitHubIcon } from './shared'

const COLUMNS = [
  {
    links: [
      { href: '/', label: 'Overview' },
      { href: '/pricing', label: 'Pricing (free, really)' },
      { href: '/docs/dev/content-engine', label: 'Content Engine' },
      { href: '/docs/dev/plugins/create', label: 'Plugin system' },
      { href: '/docs/dev/plugins/admin', label: 'Admin Control Panel' },
    ],
    title: 'Product',
  },
  {
    links: [
      { href: '/docs/dev/setup', label: 'Get started' },
      { href: '/docs/dev', label: 'Documentation' },
      { href: '/docs/guides/first-plugin', label: 'Build your first plugin' },
      {
        href: '/docs/dev/deployments/cloud/vercel',
        label: 'Deploy to the cloud',
      },
      { href: '/docs/dev/deployments/self-hosted', label: 'Self-host' },
    ],
    title: 'Build',
  },
  {
    links: [
      { href: '/discover', label: 'Discover' },
      { href: '/search', label: 'Search' },
      { href: '/docs/dev/contribution', label: 'Contribute' },
      { href: '/llms-full.txt', label: 'Docs for AI agents' },
    ],
    title: 'Community',
  },
]

export const SiteFooter = () => (
  <footer className="border-t">
    <div className="container mx-auto flex flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <RouterLink aria-label="VitNode home" className="w-fit" href="/">
            <LogoVitNodeBrand />
          </RouterLink>
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed text-pretty">
            A home for your community. A head start for your next idea. Free and
            open source, with the boring parts already done.
          </p>
          <CanaryPill />
          <a
            className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm font-medium transition-colors"
            href={REPOSITORY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon /> VitNode on GitHub
          </a>
        </div>

        {COLUMNS.map(({ links, title }) => (
          <nav aria-label={title} className="flex flex-col gap-3" key={title}>
            <h2 className="text-sm font-semibold">{title}</h2>
            <ul className="flex flex-col gap-2">
              {links.map(({ href, label }) => (
                <li key={href}>
                  <RouterLink
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    href={href}
                  >
                    {label}
                  </RouterLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="text-muted-foreground flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p>
          Made with care by{' '}
          <a
            className="hover:text-foreground font-medium underline-offset-4 hover:underline"
            href={AUTHOR_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            {AUTHOR_NAME}
          </a>{' '}
          and contributors.
        </p>
        <a
          className="hover:text-foreground font-medium underline-offset-4 hover:underline"
          href={LICENSE_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open source · MIT licence
        </a>
        <p>All the ambition. None of the licence fees.</p>
      </div>
    </div>
  </footer>
)
