import type { SiteLinkComponent } from '#/site/home/site-link'

import {
  CloudVisual,
  ServerVisual,
} from '#/site/home/illustrations/security-hosting'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

const OPTIONS = [
  {
    eyebrow: 'Build on cloud',
    href: '/docs/dev/deployments/cloud/vercel',
    link: 'Cloud deployment guide',
    note: 'Live WebSockets, local uploads and in-process cron want a server that stays awake. Everything else is happy on serverless.',
    text: 'Push the repo, point Vercel at it, bring a managed Postgres. The site and the API come up as one function. Fewer servers to babysit.',
    title: 'A little less server wrangling.',
    Visual: CloudVisual,
  },
  {
    eyebrow: 'Self-hosted',
    href: '/docs/dev/deployments/self-hosted',
    link: 'Self-hosting guide',
    note: 'You own updates, backups and the electricity bill. The software stays free, whatever your member count.',
    text: 'One Node.js process or one Docker container, one Postgres, Redis if you feel fancy. Install, build, migrate, start. Four commands.',
    title: 'Home is where your server is.',
    Visual: ServerVisual,
  },
]

export const HostingSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <MarketingSection id="hosting" labelledBy="hosting-title">
    <SectionHeading
      align="center"
      eyebrow="Your code. Your address."
      id="hosting-title"
      title="Build on cloud. Or on your own turf."
    >
      Choose where your community lives and change your mind later. The code
      behind it stays yours either way.
    </SectionHeading>

    <div className="grid gap-4 md:grid-cols-2">
      {OPTIONS.map(({ eyebrow, href, link, note, text, title, Visual }) => (
        <article
          className="bg-card flex flex-col gap-5 rounded-3xl border p-6 sm:p-8"
          key={title}
        >
          <div className="bg-muted/40 flex justify-center rounded-2xl border p-4">
            <Visual />
          </div>
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">
            {eyebrow}
          </p>
          <h3 className="text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty sm:text-base">
            {text}
          </p>
          <TextLink href={href} LinkComponent={LinkComponent}>
            {link}
          </TextLink>
          <p className="text-muted-foreground border-t pt-4 text-xs leading-relaxed text-pretty">
            {note}
          </p>
        </article>
      ))}
    </div>
  </MarketingSection>
)
