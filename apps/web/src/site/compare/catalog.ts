import type { MarketingPageMeta } from '@/site/marketing/metadata'

export interface CompareEntry {
  metaDescription: string
  name: string
  slug: string
}

const COMPARE_CATALOG = {
  discourse: {
    metaDescription:
      'VitNode vs Discourse: licence, hosting, moderation, translations, AI and plugins compared with sources. An honest look at when each one fits.',
    name: 'Discourse',
  },
  flarum: {
    metaDescription:
      'VitNode vs Flarum: two MIT-licensed community platforms compared on stack, core features, extensions, translations and hosting, with sources.',
    name: 'Flarum',
  },
  'invision-community': {
    metaDescription:
      'VitNode vs Invision Community: pricing, licence, moderation, translations, AI and APIs compared with sources. A free, open-source alternative, honestly assessed.',
    name: 'Invision Community',
  },
  nodebb: {
    metaDescription:
      'VitNode vs NodeBB: licence, hosting plans, realtime, moderation, translations and AI compared with sources, so you can pick the right one.',
    name: 'NodeBB',
  },
  'wordpress-bbpress': {
    metaDescription:
      'VitNode vs WordPress + bbPress: forums, plugins, translations, moderation and importers compared with sources. One core or a stack of plugins?',
    name: 'WordPress + bbPress',
  },
  xenforo: {
    metaDescription:
      'VitNode vs XenForo: licence and add-on pricing, moderation, translations, search and AI compared with sources. A free, MIT-licensed alternative, honestly assessed.',
    name: 'XenForo',
  },
} satisfies Record<string, Omit<CompareEntry, 'slug'>>

export type CompareSlug = keyof typeof COMPARE_CATALOG

export const COMPARE_SLUGS = Object.keys(COMPARE_CATALOG) as CompareSlug[]

const isCompareSlug = (slug: string): slug is CompareSlug =>
  Object.hasOwn(COMPARE_CATALOG, slug)

export const compareEntry = (slug: CompareSlug): CompareEntry => ({
  slug,
  ...COMPARE_CATALOG[slug],
})

export const findCompareEntry = (slug: string): CompareEntry | undefined =>
  isCompareSlug(slug) ? compareEntry(slug) : undefined

export const comparePath = (slug: string) => `/compare/${slug}`

export const comparePageMeta = (entry: CompareEntry): MarketingPageMeta => ({
  breadcrumbs: [
    { name: 'Compare', path: '/compare' },
    { name: `VitNode vs ${entry.name}`, path: comparePath(entry.slug) },
  ],
  description: entry.metaDescription,
  path: comparePath(entry.slug),
  title: `VitNode vs ${entry.name} - An Honest Comparison`,
})
