import type { ReactNode } from 'react'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { ArrowRight, Bird, Code2 } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { REPOSITORY_URL } from './links'

export { REPOSITORY_URL } from './links'

export const MarketingActions = ({
  LinkComponent: Link,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="marketing-actions">
    <Link className={buttonVariants({ size: 'lg' })} href="/docs/dev/setup">
      Start building <ArrowRight size={16} aria-hidden />
    </Link>
    <a
      className={buttonVariants({ size: 'lg', variant: 'outline' })}
      href={REPOSITORY_URL}
    >
      <Code2 size={18} aria-hidden /> Explore GitHub
    </a>
  </div>
)

export const CanaryNotice = ({
  LinkComponent: Link,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <aside className="canary-notice" aria-label="Canary release status">
    <Bird aria-hidden />
    <div>
      <strong>Very early. Very canary.</strong>
      <p>
        This is an early development build, not a stable release. Expect bugs,
        unfinished features, and breaking changes. Explore, experiment, and help
        shape it before relying on it in production.
      </p>
    </div>
    <Link href="/docs/dev/contribution">
      Help it grow <ArrowRight size={16} aria-hidden />
    </Link>
  </aside>
)

export const SectionHeading = ({
  children,
  eyebrow,
  id,
  title,
}: {
  children: ReactNode
  eyebrow: string
  id: string
  title: string
}) => (
  <div className="section-heading">
    <p className="eyebrow">{eyebrow}</p>
    <h2 id={id}>{title}</h2>
    <p>{children}</p>
  </div>
)
