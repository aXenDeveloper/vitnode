// Prototype - riff 5 "Soft": the Cards layout with a calmer surface. No
// borders or shadows - each card is a softly tinted block with more air, the
// footer bar dissolves into the card, and the sidebar matches. Hover deepens
// the tint instead of drawing an edge.
import type { FeedTopic, Forum } from '@vitnode/forum/pages/forum-data'

import { buttonVariants } from '@vitnode/core/components/ui/button'
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
import { useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { CardsLayout, MetaItem } from './layout'

const SURFACE = 'bg-muted/50 rounded-2xl'

const SoftCard = ({ forum, topic }: { forum?: Forum; topic: FeedTopic }) => {
  const t = useTranslations('@vitnode/forum.forums')
  const titleId = `soft-${topic.id}`
  const target = contentTarget('@vitnode/forum', topicContentType, topic.id)

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className={`${SURFACE} hover:bg-muted/80 flex gap-4 p-5 motion-safe:transition-colors md:p-6`}
      >
        {forum ? (
          <HrefLink
            aria-hidden="true"
            className="hidden shrink-0 sm:block"
            href={forumHref(forum.slug)}
            tabIndex={-1}
          >
            <ForumIcon className="bg-background" icon={forum.metadata.icon} />
          </HrefLink>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
            {forum ? (
              <MetaItem first>
                <HrefLink
                  className="text-foreground font-semibold underline-offset-4 hover:underline"
                  href={forumHref(forum.slug)}
                >
                  {forum.name}
                </HrefLink>
              </MetaItem>
            ) : null}
            <MetaItem first={!forum}>
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
          <h3
            className="text-foreground text-xl leading-snug font-semibold tracking-tight text-balance"
            id={titleId}
          >
            <HrefLink
              className="underline-offset-4 hover:underline"
              href={topicHref(topic.slug)}
            >
              {topic.title}
            </HrefLink>
          </h3>
          {topic.excerpt ? (
            <p className="text-muted-foreground line-clamp-3 leading-relaxed text-pretty break-words">
              {topic.excerpt}
            </p>
          ) : null}
          <footer className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <ReactionPoints
                className="bg-background"
                initial={topic.points}
                target={target}
              />
              <ReactionBar target={target} />
            </div>
            <HrefLink
              className={buttonVariants({ size: 'sm', variant: 'ghost' })}
              href={`${topicHref(topic.slug)}#comments`}
            >
              <MessageSquareIcon aria-hidden="true" />
              {t('comment_count', { count: topic.commentCount })}
            </HrefLink>
          </footer>
        </div>
      </article>
    </li>
  )
}

export const Soft = (props: VariantProps) => (
  <CardsLayout
    {...props}
    list={(topics, forums) => (
      <ul className="flex flex-col gap-4">
        {topics.map((topic) => (
          <SoftCard
            forum={forums.get(topic.forum)}
            key={topic.id}
            topic={topic}
          />
        ))}
      </ul>
    )}
    surface={SURFACE}
  />
)
