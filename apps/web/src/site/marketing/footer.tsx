import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { REPOSITORY_URL } from './shared'

const columns = [
  {
    title: 'Product',
    links: [
      ['Overview', '/'],
      ['Pricing (free, really)', '/pricing'],
      ['Content Engine', '/docs/dev/content-engine'],
      ['Plugin system', '/docs/dev/plugins/create'],
      ['AdminCP', '/docs/dev/plugins/admin'],
    ],
  },
  {
    title: 'Build something',
    links: [
      ['Get started', '/docs/dev/setup'],
      ['Documentation', '/docs/dev'],
      ['AI integration', '/docs/dev/ai'],
      ['Cloud deployment', '/docs/dev/deployments/cloud/vercel'],
      ['Self-hosting', '/docs/dev/deployments/self-hosted'],
    ],
  },
  {
    title: 'Stay curious',
    links: [
      ['Discover', '/discover'],
      ['Search', '/search'],
      ['Contribute', '/docs/dev/contribution'],
      ['Docs for AI agents', '/llms-full.txt'],
    ],
  },
]

export const SiteFooter = () => (
  <footer className="marketing marketing-footer">
    <div className="marketing-shell">
      <div className="footer-grid">
        <div className="footer-brand">
          <RouterLink
            href="/"
            className="marketing-logo"
            aria-label="VitNode home"
          >
            <LogoVitNodeBrand />
          </RouterLink>
          <p>
            A home for your community.
            <br />A head start for your next idea.
          </p>
          <span className="canary-pill">
            <span className="status-dot" /> Canary · very early build
          </span>
        </div>
        {columns.map(({ title, links }) => (
          <nav className="footer-column" aria-label={title} key={title}>
            <h2>{title}</h2>
            {links.map(([label, href]) => (
              <RouterLink href={href} key={href}>
                {label}
              </RouterLink>
            ))}
            {title === 'Stay curious' && <a href={REPOSITORY_URL}>GitHub ↗</a>}
          </nav>
        ))}
      </div>
      <div className="footer-bottom">
        <p>
          Made with care by{' '}
          <a href="https://github.com/aXenDeveloper">Maciej Balcerzak</a> &
          contributors.
        </p>
        <a href={`${REPOSITORY_URL}/blob/canary/LICENSE`}>
          Open source · MIT licence ↗
        </a>
        <p>All the ambition. None of the licence fees.</p>
      </div>
    </div>
  </footer>
)
