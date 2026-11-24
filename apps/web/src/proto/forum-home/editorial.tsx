// Prototype - variant 4 "Editorial": a front page with a hierarchy. The week's
// top topic leads at full width, the next hot ones sit in a grid, a narrow
// "Latest" column keeps time, and the forums close the page.
import type { FeedTopic } from '@vitnode/forum/pages/forum-data'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { contentTarget } from '@vitnode/core/content'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { ReactionBar, ReactionPoints } from '@vitnode/core/tanstack/reactions'
import { topicContentType } from '@vitnode/forum/content/topic'
import {
  forumHref,
  topicHref,
  topicNewHref,
} from '@vitnode/forum/pages/forum-links'
import {
  ForumIcon,
  PersonAvatar,
  PersonName,
  TimeAgo,
} from '@vitnode/forum/pages/forum-ui'
import { MessageSquareIcon, PenSquareIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import { useFeed, useHomeData } from './data'

const Kicker = ({ forumId }: { forumId: number }) => {
  const { forumsById } = useHomeData()
  const forum = forumsById.get(forumId)
  if (!forum) return null

  return (
    <HrefLink
      className="text-primary w-fit max-w-full truncate text-xs font-semibold tracking-wider uppercase underline-offset-4 hover:underline"
      href={forumHref(forum.slug)}
    >
      {forum.name}
    </HrefLink>
  )
}

const Byline = ({ topic }: { topic: FeedTopic }) => {
  const t = useTranslations('@vitnode/forum.forums')

  return (
    <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <PersonAvatar person={topic.author} size={24} />
        <span className="min-w-0 truncate">
          <PersonName person={topic.author} />
        </span>
      </span>
      {topic.publishedAt ? (
        <>
          <span aria-hidden="true">·</span>
          <TimeAgo date={topic.publishedAt} />
        </>
      ) : null}
      <span aria-hidden="true">·</span>
      <span className="flex items-center gap-1 tabular-nums">
        <MessageSquareIcon aria-hidden="true" className="size-3.5" />
        {t('comment_count', { count: topic.commentCount })}
      </span>
    </p>
  )
}

const Lead = ({ topic }: { topic: FeedTopic }) => {
  const target = contentTarget('@vitnode/forum', topicContentType, topic.id)

  return (
    <article
      aria-labelledby={`lead-${topic.id}`}
      className="flex flex-col gap-4 border-b pb-8"
    >
      <Kicker forumId={topic.forum} />
      <h2
        className="text-foreground max-w-[26ch] text-3xl leading-[1.1] font-semibold tracking-tight text-balance md:text-4xl"
        id={`lead-${topic.id}`}
      >
        <HrefLink
          className="underline-offset-8 hover:underline"
          href={topicHref(topic.slug)}
        >
          {topic.title}
        </HrefLink>
      </h2>
      {topic.excerpt ? (
        <p className="text-muted-foreground max-w-prose text-lg leading-relaxed text-pretty">
          {topic.excerpt}
        </p>
      ) : null}
      <Byline topic={topic} />
      <div className="flex flex-wrap items-center gap-2">
        <ReactionPoints initial={topic.points} target={target} />
        <ReactionBar target={target} />
      </div>
    </article>
  )
}

const Story = ({ topic }: { topic: FeedTopic }) => (
  <article
    aria-labelledby={`story-${topic.id}`}
    className="flex min-w-0 flex-col gap-2"
  >
    <Kicker forumId={topic.forum} />
    <h3
      className="text-foreground text-xl leading-snug font-semibold text-balance"
      id={`story-${topic.id}`}
    >
      <HrefLink
        className="underline-offset-4 hover:underline"
        href={topicHref(topic.slug)}
      >
        {topic.title}
      </HrefLink>
    </h3>
    {topic.excerpt ? (
      <p className="text-muted-foreground line-clamp-3 leading-relaxed text-pretty">
        {topic.excerpt}
      </p>
    ) : null}
    <Byline topic={topic} />
  </article>
)

export const Editorial = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const { stats, tree } = useHomeData()
  const top = useFeed({ sort: 'top', t: 'week' })
  const hot = useFeed({ sort: 'hot' })
  const latest = useFeed({ sort: 'new' })

  const lead = top.data?.topics[0] ?? hot.data?.topics[0]
  const stories = (hot.data?.topics ?? [])
    .filter((topic) => topic.id !== lead?.id)
    .slice(0, 4)
  const shown = new Set([lead?.id, ...stories.map((topic) => topic.id)])
  const newest = (latest.data?.topics ?? [])
    .filter((topic) => !shown.has(topic.id))
    .slice(0, 8)

  return (
    <div className="container mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <p className="text-sm font-semibold tracking-wider uppercase">
          {t('title')}
          <span className="text-muted-foreground ms-3 font-normal tracking-normal normal-case">
            {t('desc')}
          </span>
        </p>
        <HrefLink className={buttonVariants()} href={topicNewHref()}>
          <PenSquareIcon aria-hidden="true" />
          {t('new_topic')}
        </HrefLink>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {lead ? <Lead topic={lead} /> : null}
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-2">
            {stories.map((topic) => (
              <Story key={topic.id} topic={topic} />
            ))}
          </div>
        </div>

        <aside
          aria-labelledby="editorial-latest"
          className="flex flex-col gap-4 lg:border-s lg:ps-8"
        >
          <h2
            className="text-sm font-semibold tracking-wider uppercase"
            id="editorial-latest"
          >
            Latest
          </h2>
          <ol className="flex flex-col divide-y">
            {newest.map((topic) => (
              <li className="flex flex-col gap-1 py-3" key={topic.id}>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {topic.publishedAt ? (
                    <TimeAgo date={topic.publishedAt} />
                  ) : null}
                </span>
                <HrefLink
                  className="text-foreground leading-snug font-medium text-pretty underline-offset-4 hover:underline"
                  href={topicHref(topic.slug)}
                >
                  {topic.title}
                </HrefLink>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <section
        aria-labelledby="editorial-forums"
        className="flex flex-col gap-4 border-t pt-8"
      >
        <h2
          className="text-sm font-semibold tracking-wider uppercase"
          id="editorial-forums"
        >
          {t('tree')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tree.map((node) => (
            <li key={node.id}>
              <HrefLink
                className="hover:bg-muted/60 flex items-center gap-3 rounded-xl border p-3"
                href={forumHref(node.slug)}
              >
                <ForumIcon icon={node.metadata.icon} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate font-medium">
                    {node.name}
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {format.number(stats.get(node.id)?.topicCount ?? 0)}{' '}
                    {t('stats.topics').toLowerCase()}
                  </span>
                </span>
              </HrefLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
