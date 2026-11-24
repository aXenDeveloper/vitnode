// Prototype - riff 2 "Rail": the baseline's parts, moved. Forums become a
// sticky left nav (always in reach while scrolling), the feed sits in the
// middle, and a right rail adds what a home page lacks: this week's top
// topics and the community's size.
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { topicHref, topicNewHref } from '@vitnode/forum/pages/forum-links'
import { MessageSquareIcon, PenSquareIcon, TrophyIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { useFeed, useHomeData } from './data'
import { BaselineFeed, ForumChips, ForumTree } from './parts'

const TopThisWeek = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const top = useFeed({ sort: 'top' })
  const topics = top.data?.topics.slice(0, 5) ?? []
  if (top.isPending || topics.length === 0) return null

  return (
    <section
      aria-labelledby="rail-top"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2
        className="text-foreground flex items-center gap-2 text-sm font-semibold"
        id="rail-top"
      >
        <TrophyIcon aria-hidden="true" className="text-primary size-4" />
        {t('feed.window.label')} {t('feed.window.week').toLowerCase()}
      </h2>
      <ol className="flex flex-col gap-3">
        {topics.map((topic, index) => (
          <li className="flex gap-3" key={topic.id}>
            <span
              aria-hidden="true"
              className="text-muted-foreground w-4 shrink-0 pt-0.5 text-end text-sm font-semibold tabular-nums"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <HrefLink
                className="text-foreground line-clamp-2 text-sm leading-snug font-medium text-pretty underline-offset-4 hover:underline"
                href={topicHref(topic.slug)}
              >
                {topic.title}
              </HrefLink>
              <p className="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
                <span>
                  {format.number(topic.points, { signDisplay: 'exceptZero' })}{' '}
                  pts
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquareIcon aria-hidden="true" className="size-3" />
                  {format.number(topic.commentCount)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const Community = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const { totals } = useHomeData()

  return (
    <section
      aria-labelledby="rail-community"
      className="bg-card flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="text-foreground text-sm font-semibold"
          id="rail-community"
        >
          {t('title')}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t('desc')}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">{t('stats.topics')}</dt>
          <dd className="text-foreground text-lg font-semibold tabular-nums">
            {format.number(totals.topics)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">
            {t('stats.comments')}
          </dt>
          <dd className="text-foreground text-lg font-semibold tabular-nums">
            {format.number(totals.comments)}
          </dd>
        </div>
      </dl>
      <HrefLink
        className={buttonVariants({ className: 'w-full' })}
        href={topicNewHref()}
      >
        <PenSquareIcon aria-hidden="true" />
        {t('new_topic')}
      </HrefLink>
    </section>
  )
}

export const Rail = ({ hrefFor, search }: VariantProps) => {
  const t = useTranslations('@vitnode/forum.forums')
  const { stats, tree } = useHomeData()

  return (
    <div className="container mx-auto grid max-w-7xl gap-6 px-4 py-8 md:py-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[14rem_minmax(0,1fr)_18rem]">
      <aside
        aria-labelledby="rail-tree"
        className="hidden flex-col gap-2 lg:sticky lg:top-20 lg:flex"
      >
        <h2
          className="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase"
          id="rail-tree"
        >
          {t('tree')}
        </h2>
        <nav aria-labelledby="rail-tree">
          <ForumTree nodes={tree} stats={stats} />
        </nav>
      </aside>

      <section
        aria-labelledby="rail-title"
        className="flex min-w-0 flex-col gap-4"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1
            className="text-foreground text-3xl font-semibold tracking-tight text-balance"
            id="rail-title"
          >
            {t('title')}
          </h1>
          <HrefLink
            className={buttonVariants({ className: 'xl:hidden' })}
            href={topicNewHref()}
          >
            <PenSquareIcon aria-hidden="true" />
            {t('new_topic')}
          </HrefLink>
        </header>
        <ForumChips className="lg:hidden" nodes={tree} />
        <BaselineFeed hrefFor={hrefFor} search={search} />
      </section>

      <div className="hidden flex-col gap-4 xl:sticky xl:top-20 xl:flex">
        <Community />
        <TopThisWeek />
      </div>
    </div>
  )
}
