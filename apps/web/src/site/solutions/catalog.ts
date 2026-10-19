import type { MarketingPageMeta } from '@/site/marketing/metadata'

export interface SolutionEntry {
  metaDescription: string
  name: string
  slug: string
}

const SOLUTION_CATALOG = {
  blog: {
    metaDescription:
      'Start a blog with VitNode: live co-editing, per-field translations, scheduled posts, revisions, an SEO checklist and AI helpers. Free and open source.',
    name: 'Blog',
  },
  community: {
    metaDescription:
      'Build a community site with VitNode: blog, forum and profiles under one account, with ⌘K search, a Discover feed, notifications and a ModCP. Open source.',
    name: 'Community site',
  },
  'e-commerce': {
    metaDescription:
      'Build a store on VitNode: a product catalog as content types, customer accounts, translations, search and a typed API. Payments are on the roadmap. Open source.',
    name: 'E-commerce',
  },
  forum: {
    metaDescription:
      'Run a forum with VitNode: nested sections, topics and comments, approval rules per section, scoped moderators and a ModCP reports board. Free and open source.',
    name: 'Forum',
  },
  'gaming-guild': {
    metaDescription:
      'Build a guild or clan hub with VitNode: Discord sign-in, ranks as roles, announcements with real-time updates, events as a plugin and a multilingual roster. Free and open source.',
    name: 'Gaming guild hub',
  },
  'help-center': {
    metaDescription:
      'Build a help center and knowledge base with VitNode: articles as content types, site-wide search, editor and reviewer roles, real-time updates and SSO. Free and open source.',
    name: 'Help center',
  },
  'membership-site': {
    metaDescription:
      'Build a membership site with VitNode: posts with the blog plugin, tiers as roles, members-only content, social sign-in and real-time updates, on a domain you own. Open source and free.',
    name: 'Membership site',
  },
  'multilingual-magazine': {
    metaDescription:
      'Run a multilingual magazine with VitNode: articles with per-field translations, editorial roles, scheduled publishing, hreflang and sitemap generated, and search across every language. Free and open source.',
    name: 'Multilingual magazine',
  },
  'open-source-hub': {
    metaDescription:
      'Build a home for your open-source project with VitNode: release notes and guides as content types, contributor roles, Discord and OAuth2 sign-in, real-time updates and agent-readable docs. Free and MIT-licensed.',
    name: 'Open-source hub',
  },
  saas: {
    metaDescription:
      'Build a SaaS app on VitNode: accounts, SSO, plans as roles, an AdminCP, AI budgets, notifications, cron and a typed API. Billing is on the roadmap. Open source.',
    name: 'SaaS app',
  },
} satisfies Record<string, Omit<SolutionEntry, 'slug'>>

export type SolutionSlug = keyof typeof SOLUTION_CATALOG

export const SOLUTION_SLUGS = Object.keys(SOLUTION_CATALOG) as SolutionSlug[]

const isSolutionSlug = (slug: string): slug is SolutionSlug =>
  Object.hasOwn(SOLUTION_CATALOG, slug)

export const solutionEntry = (slug: SolutionSlug): SolutionEntry => ({
  slug,
  ...SOLUTION_CATALOG[slug],
})

export const findSolutionEntry = (slug: string): SolutionEntry | undefined =>
  isSolutionSlug(slug) ? solutionEntry(slug) : undefined

export const solutionPath = (slug: string) => `/solutions/${slug}`

export const solutionPageMeta = (
  solution: SolutionEntry,
): MarketingPageMeta => ({
  breadcrumbs: [
    { name: 'Solutions', path: '/solutions' },
    { name: solution.name, path: solutionPath(solution.slug) },
  ],
  description: solution.metaDescription,
  path: solutionPath(solution.slug),
  title: `${solution.name} - Solutions`,
})
