import type { LucideIcon } from 'lucide-react'

import {
  Blocks,
  Crown,
  Gamepad2,
  GitBranch,
  LifeBuoy,
  MessagesSquare,
  Newspaper,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '@/site/marketing/shared'

type BuildKey =
  | 'custom'
  | 'forum'
  | 'guild'
  | 'help_center'
  | 'magazine'
  | 'membership'
  | 'open_source'

interface BuildItem {
  docs?: string
  Icon: LucideIcon
  key: BuildKey
  solution?: string
}

const ITEMS: readonly BuildItem[] = [
  { docs: 'guides/forum', Icon: MessagesSquare, key: 'forum' },
  { Icon: Newspaper, key: 'magazine', solution: 'multilingual-magazine' },
  { Icon: LifeBuoy, key: 'help_center', solution: 'help-center' },
  { Icon: Crown, key: 'membership', solution: 'membership-site' },
  { Icon: GitBranch, key: 'open_source', solution: 'open-source-hub' },
  { Icon: Gamepad2, key: 'guild', solution: 'gaming-guild' },
]

const INCLUDES = ['first', 'second', 'third'] as const

const CONTENT_TYPE_SNIPPET = `defineContentType({
  id: 'recipes.recipe',
  tableName: 'recipes',
  fields: {
    title: field.text({ localized: true, required: true }),
    body: field.richText({ localized: true }),
  },
  admin: { path: 'recipes', titleField: 'title' },
})`

const ItemLink = ({ item, label }: { item: BuildItem; label: string }) =>
  item.solution ? (
    <TextLink
      className="mt-auto"
      params={{ slug: item.solution }}
      to="/solutions/$slug"
    >
      {label}
    </TextLink>
  ) : (
    <TextLink
      className="mt-auto"
      params={{ _splat: item.docs ?? 'dev' }}
      to="/docs/$"
    >
      {label}
    </TextLink>
  )

const Includes = ({ itemKey }: { itemKey: BuildKey }) => {
  const t = useTranslations('site.home.build')

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
        {t('includes')}
      </p>
      <ul className="flex flex-wrap gap-2">
        {INCLUDES.map((slot) => (
          <li
            className="bg-muted rounded-full px-2.5 py-1 text-xs font-medium"
            key={slot}
          >
            {t(`items.${itemKey}.includes.${slot}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

const IconTile = ({ Icon }: { Icon: LucideIcon }) => (
  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
    <Icon aria-hidden className="size-5" />
  </span>
)

export const BuildSection = () => {
  const t = useTranslations('site.home.build')

  return (
    <MarketingSection id="build" labelledBy="build-title">
      <SectionHeading
        eyebrow={t('eyebrow')}
        id="build-title"
        title={t('title')}
      >
        {t('description')}
      </SectionHeading>

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <li key={item.key}>
            <article className="bg-card flex h-full flex-col gap-5 rounded-2xl border p-6">
              <IconTile Icon={item.Icon} />
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-balance">
                  {t(`items.${item.key}.title`)}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {t(`items.${item.key}.description`)}
                </p>
              </div>
              <Includes itemKey={item.key} />
              <ItemLink item={item} label={t(`items.${item.key}.link`)} />
            </article>
          </li>
        ))}
        <li className="md:col-span-2 lg:col-span-3">
          <article className="bg-card grid gap-6 rounded-2xl border p-6 lg:grid-cols-2 lg:items-center lg:gap-10">
            <div className="flex flex-col gap-5">
              <IconTile Icon={Blocks} />
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-balance">
                  {t('items.custom.title')}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {t('items.custom.description')}
                </p>
              </div>
              <Includes itemKey="custom" />
              <ItemLink
                item={{
                  docs: 'guides/first-plugin',
                  Icon: Blocks,
                  key: 'custom',
                }}
                label={t('items.custom.link')}
              />
            </div>
            <pre className="bg-muted/60 min-w-0 overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed sm:text-sm">
              <code>{CONTENT_TYPE_SNIPPET}</code>
            </pre>
          </article>
        </li>
      </ul>
    </MarketingSection>
  )
}
