// Prototype - riff anchor "Cards" (picked last round): every topic is its own
// card, the forum's icon anchors it on the left, and points, reactions and
// comments sit in a footer bar.
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

const TopicCard = ({ forum, topic }: { forum?: Forum; topic: FeedTopic }) => {
  const t = useTranslations('@vitnode/forum.forums')
  const titleId = `card-${topic.id}`
  const target = contentTarget('@vitnode/forum', topicContentType, topic.id)

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="bg-card flex flex-col rounded-xl border shadow-xs"
      >
        <div className="flex gap-4 p-4 md:p-5">
          {forum ? (
            <HrefLink
              aria-hidden="true"
              className="hidden shrink-0 sm:block"
              href={forumHref(forum.slug)}
              tabIndex={-1}
            >
              <ForumIcon icon={forum.metadata.icon} />
            </HrefLink>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
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
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <ReactionPoints initial={topic.points} target={target} />
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
      </article>
    </li>
  )
}

export const Cards = (props: VariantProps) => (
  <CardsLayout
    {...props}
    list={(topics, forums) => (
      <ul className="flex flex-col gap-3">
        {topics.map((topic) => (
          <TopicCard
            forum={forums.get(topic.forum)}
            key={topic.id}
            topic={topic}
          />
        ))}
      </ul>
    )}
  />
)
