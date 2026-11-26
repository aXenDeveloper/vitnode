import { Link, type RegisteredRouter } from '@tanstack/react-router'
import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { Heart } from 'lucide-react'

import {
  AUTHOR_NAME,
  AUTHOR_URL,
  LICENSE_URL,
  REPOSITORY_URL,
  SPONSOR_URL,
} from './links'
import { CanaryPill, GitHubIcon } from './shared'

interface FooterLink {
  href: string
  label: string
  target?: React.HTMLAttributeAnchorTarget
}

const COLUMNS: { links: FooterLink[]; title: string }[] = [
  {
    links: [
      { href: '/', label: 'Overview' },
      { href: '/solutions', label: 'Solutions' },
      { href: '/plugins', label: 'Plugins' },
      { href: '/docs/content-engine', label: 'Content Engine' },
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
      { href: '/forum', label: 'Forum' },
      { href: '/blog', label: 'Blog' },
      { href: '/discover', label: 'Discover' },
      { href: '/docs/dev/contribution', label: 'Contribute' },
      { href: '/llms-full.txt', label: 'Docs for AI agents', target: '_blank' },
    ],
    title: 'Community',
  },
]

const LINK =
  'text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 transition-colors hover:underline'

const META_LINK = `${LINK} inline-flex items-center gap-2 font-medium`

const Hairline = () => (
  <span
    aria-hidden
    className="via-border h-px bg-linear-to-r from-transparent to-transparent"
  />
)

export const SiteFooter = () => (
  <footer className="mk-footer">
    <div className="container mx-auto flex flex-col gap-10 px-4 pb-12 sm:px-6 sm:pb-16">
      <span className="mk-footer-rule flex flex-col pb-2 sm:pb-6">
        <Hairline />
      </span>
      <div className="grid gap-10 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Link aria-label="VitNode home" className="w-fit" to="/">
            <LogoVitNodeBrand />
          </Link>
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed text-pretty">
            A home for your community. A head start for your next idea. Free and
            open source, with the boring parts already done.
          </p>
          <CanaryPill />
          <a
            className={META_LINK}
            href={LICENSE_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Pricing: $0, forever
          </a>
          <a
            className={META_LINK}
            href={REPOSITORY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon /> VitNode on GitHub
          </a>
          <a
            className={META_LINK}
            href={SPONSOR_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Heart aria-hidden className="size-4" /> Sponsor the project
          </a>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
          {COLUMNS.map(({ links, title }) => (
            <nav aria-label={title} className="flex flex-col gap-3" key={title}>
              <h2 className="text-sm font-semibold">{title}</h2>
              <ul className="flex flex-col gap-2">
                {links.map(({ href, label, target }) => (
                  <li key={href}>
                    <Link<RegisteredRouter, string, string>
                      className={LINK}
                      href={href}
                      rel={
                        target === '_blank' ? 'noopener noreferrer' : undefined
                      }
                      target={target}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <Hairline />

      <div className="text-muted-foreground flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
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
