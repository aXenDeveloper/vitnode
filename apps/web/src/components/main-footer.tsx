import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { RouterLink } from '@vitnode/core/tanstack/layout'
import { ArrowUpRight } from 'lucide-react'

const REPOSITORY = 'https://github.com/aXenDeveloper/vitnode'

const groups = [
  {
    title: 'Start something',
    links: [
      { label: 'Getting started', href: '/docs/dev/setup' },
      { label: 'Your first plugin', href: '/docs/guides/first-plugin' },
      { label: 'Self-hosting', href: '/docs/dev/deployments/self-hosted' },
    ],
  },
  {
    title: 'Explore VitNode',
    links: [
      { label: 'Documentation', href: '/docs/dev' },
      { label: 'Admin Control Panel', href: '/docs/dev/plugins/admin' },
      { label: 'Content tools', href: '/docs/dev/content-engine' },
      { label: 'Blog plugin', href: '/docs/guides/blog' },
    ],
  },
  {
    title: 'Build it with us',
    links: [
      { label: 'GitHub', href: REPOSITORY },
      { label: 'Report an issue', href: `${REPOSITORY}/issues` },
      { label: 'Release updates', href: `${REPOSITORY}/releases` },
      { label: 'Meet Maciej', href: 'https://github.com/aXenDeveloper' },
    ],
  },
]

export const MainFooter = () => (
  <footer className="border-t bg-background text-foreground">
    <div className="home-wrap flex flex-col gap-12 py-12 md:py-16">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col items-start gap-4 lg:col-span-2">
          <RouterLink aria-label="VitNode home" className="rounded-md" href="/">
            <LogoVitNode className="w-32" idPrefix="main-footer" />
          </RouterLink>
          <p className="max-w-xs leading-relaxed text-pretty text-muted-foreground">
            A home for your community.
            <br />A head start for your team.
          </p>
          <span className="home-pill">2.0 Canary · Very early build</span>
        </div>
        {groups.map(({ title, links }) => (
          <nav aria-label={title} className="flex flex-col gap-4" key={title}>
            <h2 className="text-sm font-semibold">{title}</h2>
            <ul className="flex flex-col gap-3 text-sm">
              {links.map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith('/') ? (
                    <RouterLink className="home-footer-link" href={href}>
                      {label}
                    </RouterLink>
                  ) : (
                    <a className="home-footer-link" href={href}>
                      {label}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="flex flex-col justify-between gap-4 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
        <p>Built by Maciej and the VitNode contributors.</p>
        <a
          className="home-footer-link"
          href={`${REPOSITORY}/blob/canary/LICENSE.md`}
        >
          Open source · MIT License
        </a>
      </div>
    </div>
  </footer>
)
