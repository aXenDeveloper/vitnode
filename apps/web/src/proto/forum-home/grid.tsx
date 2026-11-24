// Prototype - riff 4 "Grid": the same cards, laid out as a two-column board
// on tablets and up - twice the topics above the fold. Each card is a fixed
// shape: forum on top, title, a clamped excerpt, author, then points,
// reactions and comments pinned to the bottom so rows line up.
import type { FeedTopic, Forum } from '@vitnode/forum/pages/forum-data'

import { contentTarget } from '@vitnode/core/content'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { ReactionBar, ReactionPoints } from '@vitnode/core/tanstack/reactions'
import { topicContentType } from '@vitnode/forum/content/topic'
import { forumHref, topicHref } from '@vitnode/forum/pages/forum-links'
import {
  ForumIcon,
  PersonAvatar,
  PersonName,
  TimeAgo,
} from '@vitnode/forum/pages/forum-ui'
import { MessageSquareIcon } from 'lucide-react'
import { useFormatter } from 'use-intl'

import type { VariantProps } from './data'

import { CardsLayout, MetaItem } from './layout'

const GridCard = ({ forum, topic }: { forum?: Forum; topic: FeedTopic }) => {
  const format = useFormatter()
  const titleId = `grid-${topic.id}`
  const target = contentTarget('@vitnode/forum', topicContentType, topic.id)

  return (
    <li className="flex">
      <article
        aria-labelledby={titleId}
        className="bg-card flex w-full flex-col gap-3 rounded-xl border p-4 shadow-xs"
      >
        {forum ? (
          <HrefLink
            className="text-foreground flex w-fit max-w-full min-w-0 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
            href={forumHref(forum.slug)}
          >
            <ForumIcon className="size-6" icon={forum.metadata.icon} />
            <span className="min-w-0 truncate">{forum.name}</span>
          </HrefLink>
        ) : null}
        <h3
          className="text-foreground line-clamp-3 text-lg leading-snug font-semibold text-balance"
          id={titleId}
          title={topic.title}
        >
          <HrefLink
            className="underline-offset-4 hover:underline"
            href={topicHref(topic.slug)}
          >
            {topic.title}
          </HrefLink>
        </h3>
        {topic.excerpt ? (
          <p className="text-muted-foreground line-clamp-4 text-sm leading-relaxed text-pretty break-words">
            {topic.excerpt}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <MetaItem first>
            <PersonAvatar person={topic.author} size={24} />
            <span className="min-w-0 truncate">
              <PersonName person={topic.author} />
            </span>
          </MetaItem>
          {topic.publishedAt ? (
            <MetaItem>
              <TimeAgo date={topic.publishedAt} />
            </MetaItem>
          ) : null}
        </p>
        <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
          <ReactionPoints initial={topic.points} target={target} />
          <ReactionBar target={target} />
          <HrefLink
            className="text-muted-foreground hover:text-foreground ms-auto flex min-h-10 items-center gap-1.5 text-sm tabular-nums underline-offset-4 hover:underline"
            href={`${topicHref(topic.slug)}#comments`}
          >
            <MessageSquareIcon aria-hidden="true" className="size-4" />
            {format.number(topic.commentCount)}
            <span className="sr-only">comments</span>
          </HrefLink>
        </footer>
      </article>
    </li>
  )
}

export const Grid = (props: VariantProps) => (
  <CardsLayout
    {...props}
    list={(topics, forums) => (
      <ul className="grid gap-3 md:grid-cols-2">
        {topics.map((topic) => (
          <GridCard
            forum={forums.get(topic.forum)}
            key={topic.id}
            topic={topic}
          />
        ))}
      </ul>
    )}
    maxWidth="max-w-7xl"
  />
)
