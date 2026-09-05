import type { MarketingPageMeta } from '#/site/marketing/metadata'

export interface SolutionEntry {
  metaDescription: string
  name: string
  slug: string
}

const SOLUTION_CATALOG = {
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
} satisfies Record<string, Omit<SolutionEntry, 'slug'>>

export type SolutionSlug = keyof typeof SOLUTION_CATALOG

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
