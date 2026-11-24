// Prototype - riff 3 "People": a card reads like a post from someone, not an
// entry in a forum. The author leads - big avatar, name, "in Forum · 6h" -
// and the footer is a row of actions: react, comment, share.
import type { FeedTopic, Forum } from '@vitnode/forum/pages/forum-data'

import { Button, buttonVariants } from '@vitnode/core/components/ui/button'
import { contentTarget } from '@vitnode/core/content'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { ReactionBar, ReactionPoints } from '@vitnode/core/tanstack/reactions'
import { topicContentType } from '@vitnode/forum/content/topic'
import { forumHref, topicHref } from '@vitnode/forum/pages/forum-links'
import {
  PersonAvatar,
  PersonName,
  TimeAgo,
} from '@vitnode/forum/pages/forum-ui'
import { MessageSquareIcon, Share2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { CardsLayout, MetaItem } from './layout'

const ShareButton = ({ topic }: { topic: FeedTopic }) => {
  const share = async () => {
    const url = new URL(topicHref(topic.slug), window.location.origin).href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: topic.title, url })
      } catch {
        // Closed the share sheet - nothing to do.
      }

      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied', { description: topic.title })
    } catch {
      toast.error('Could not copy the link', { description: url })
    }
  }

  return (
    <Button
      aria-label={`Share "${topic.title}"`}
      onClick={() => {
        void share()
      }}
      size="sm"
      variant="ghost"
    >
      <Share2Icon aria-hidden="true" />
      <span className="hidden sm:inline">Share</span>
    </Button>
  )
}

const PostCard = ({ forum, topic }: { forum?: Forum; topic: FeedTopic }) => {
  const t = useTranslations('@vitnode/forum.forums')
  const titleId = `post-${topic.id}`
  const target = contentTarget('@vitnode/forum', topicContentType, topic.id)

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs md:p-5"
      >
        <header className="flex min-w-0 items-center gap-3">
          <PersonAvatar person={topic.author} size={40} />
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground min-w-0 truncate font-semibold">
              <PersonName person={topic.author} />
            </span>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
              {forum ? (
                <MetaItem first>
                  <span className="min-w-0 truncate">
                    in{' '}
                    <HrefLink
                      className="text-foreground font-medium underline-offset-4 hover:underline"
                      href={forumHref(forum.slug)}
                    >
                      {forum.name}
                    </HrefLink>
                  </span>
                </MetaItem>
              ) : null}
              {topic.publishedAt ? (
                <MetaItem first={!forum}>
                  <TimeAgo date={topic.publishedAt} />
                </MetaItem>
              ) : null}
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-1.5">
          <h3
            className="text-foreground text-lg leading-snug font-semibold text-balance md:text-xl"
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

        <div className="flex flex-wrap items-center gap-2">
          <ReactionPoints initial={topic.points} target={target} />
          {topic.commentCount > 0 && topic.lastActivityAt ? (
            <span className="text-muted-foreground text-sm">
              {t('last_comment')} <TimeAgo date={topic.lastActivityAt} />
            </span>
          ) : null}
        </div>

        <footer className="-mx-2 flex flex-wrap items-center justify-between gap-2 border-t px-2 pt-2">
          <ReactionBar target={target} />
          <div className="flex items-center gap-1">
            <HrefLink
              className={buttonVariants({ size: 'sm', variant: 'ghost' })}
              href={`${topicHref(topic.slug)}#comments`}
            >
              <MessageSquareIcon aria-hidden="true" />
              {t('comment_count', { count: topic.commentCount })}
            </HrefLink>
            <ShareButton topic={topic} />
          </div>
        </footer>
      </article>
    </li>
  )
}

export const People = (props: VariantProps) => (
  <CardsLayout
    {...props}
    list={(topics, forums) => (
      <ul className="flex flex-col gap-3">
        {topics.map((topic) => (
          <PostCard
            forum={forums.get(topic.forum)}
            key={topic.id}
            topic={topic}
          />
        ))}
      </ul>
    )}
  />
)
