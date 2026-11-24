// Prototype - riff 2 "Score": the card's left edge is its points. A tall
// column holds the number - big, tinted by sign, ticking live as people
// react - so scanning the feed reads like a scoreboard. The forum icon moves
// into the meta line; the footer keeps reactions and comments.
import type { FeedTopic, Forum } from '@vitnode/forum/pages/forum-data'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { FEEDBACK_TONE_TEXT } from '@vitnode/core/components/ui/feedback-tone'
import { contentTarget } from '@vitnode/core/content'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { ReactionBar } from '@vitnode/core/tanstack/reactions'
import { topicContentType } from '@vitnode/forum/content/topic'
import { forumHref, topicHref } from '@vitnode/forum/pages/forum-links'
import { ForumIcon, PersonName, TimeAgo } from '@vitnode/forum/pages/forum-ui'
import { cn } from 'cn'
import { MessageSquareIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { CardsLayout, MetaItem } from './layout'
import { useLivePoints } from './parts'

const ScoreColumn = ({ topic }: { topic: FeedTopic }) => {
  const format = useFormatter()
  const points = useLivePoints(topic.id, topic.points)

  return (
    <div
      className={cn(
        'flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-s-xl border-e py-4 md:w-16',
        points > 0 && 'bg-success/5 dark:bg-success/10',
        points < 0 && 'bg-destructive/5 dark:bg-destructive/10',
        points === 0 && 'bg-muted/40',
      )}
    >
      <span
        className={cn(
          'text-xl font-semibold tabular-nums md:text-2xl',
          points > 0 && FEEDBACK_TONE_TEXT.success,
          points < 0 && FEEDBACK_TONE_TEXT.destructive,
          points === 0 && 'text-muted-foreground',
        )}
      >
        {format.number(points, {
          notation: 'compact',
          signDisplay: 'exceptZero',
        })}
      </span>
      <span className="text-muted-foreground text-xs">pts</span>
      <span className="sr-only">points</span>
    </div>
  )
}

const ScoreCard = ({ forum, topic }: { forum?: Forum; topic: FeedTopic }) => {
  const t = useTranslations('@vitnode/forum.forums')
  const titleId = `score-${topic.id}`
  const target = contentTarget('@vitnode/forum', topicContentType, topic.id)

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="bg-card flex rounded-xl border shadow-xs"
      >
        <ScoreColumn topic={topic} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-2 p-4 md:px-5">
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
              {forum ? (
                <MetaItem first>
                  <HrefLink
                    className="text-foreground flex min-w-0 items-center gap-2 font-semibold underline-offset-4 hover:underline"
                    href={forumHref(forum.slug)}
                  >
                    <ForumIcon className="size-6" icon={forum.metadata.icon} />
                    <span className="min-w-0 truncate">{forum.name}</span>
                  </HrefLink>
                </MetaItem>
              ) : null}
              <MetaItem first={!forum}>
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
              <p className="text-muted-foreground line-clamp-2 leading-relaxed text-pretty break-words">
                {topic.excerpt}
              </p>
            ) : null}
          </div>
          <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 md:px-5">
            <ReactionBar target={target} />
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

export const Score = (props: VariantProps) => (
  <CardsLayout
    {...props}
    list={(topics, forums) => (
      <ul className="flex flex-col gap-3">
        {topics.map((topic) => (
          <ScoreCard
            forum={forums.get(topic.forum)}
            key={topic.id}
            topic={topic}
          />
        ))}
      </ul>
    )}
  />
)
