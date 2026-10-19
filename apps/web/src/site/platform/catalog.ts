import type { MarketingPageMeta } from '@/site/marketing/metadata'

export interface PlatformEntry {
  metaDescription: string
  name: string
  slug: PlatformSlug
}

const PLATFORM_CATALOG = {
  admincp: {
    metaDescription:
      'The VitNode AdminCP runs members, roles, content, AI budgets and system health from one panel, with a dashboard of widgets and its own admin session.',
    name: 'AdminCP',
  },
  core: {
    metaDescription:
      'What ships in @vitnode/core: members, roles, sign-in, passkeys, an AdminCP, a ModCP, search, notifications, AI and the Content Engine. Free and MIT-licensed.',
    name: 'Core',
  },
  security: {
    metaDescription:
      'VitNode security: hashed passwords and sessions, passkeys, captcha, rate limits, CSRF and origin checks, row-level security and a separate admin session.',
    name: 'Security',
  },
} satisfies Record<string, Omit<PlatformEntry, 'slug'>>

export type PlatformSlug = keyof typeof PLATFORM_CATALOG

export const PLATFORM_SLUGS = Object.keys(PLATFORM_CATALOG) as PlatformSlug[]

const isPlatformSlug = (slug: string): slug is PlatformSlug =>
  Object.hasOwn(PLATFORM_CATALOG, slug)

export const platformEntry = (slug: PlatformSlug): PlatformEntry => ({
  slug,
  ...PLATFORM_CATALOG[slug],
})

export const findPlatformEntry = (slug: string): PlatformEntry | undefined =>
  isPlatformSlug(slug) ? platformEntry(slug) : undefined

export const platformPath = (slug: string) => `/platform/${slug}`

export const platformPageMeta = (entry: PlatformEntry): MarketingPageMeta => ({
  breadcrumbs: [
    { name: 'Platform', path: '/platform' },
    { name: entry.name, path: platformPath(entry.slug) },
  ],
  description: entry.metaDescription,
  path: platformPath(entry.slug),
  title: `${entry.name} - The VitNode Platform`,
})
