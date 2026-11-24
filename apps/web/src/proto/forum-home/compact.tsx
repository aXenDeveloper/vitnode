// Prototype - variant 3 "Compact": density first. One line per topic in
// columns - points, topic, replies, activity - like a mailing list or a
// Discourse "Latest" view. Sort and forum filter swap in place.
import { Button, buttonVariants } from '@vitnode/core/components/ui/button'
import { FEEDBACK_TONE_TEXT } from '@vitnode/core/components/ui/feedback-tone'
import {
  NativeSelect,
  NativeSelectOption,
} from '@vitnode/core/components/ui/native-select'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { topicHref, topicNewHref } from '@vitnode/forum/pages/forum-links'
import {
  PersonAvatar,
  PersonName,
  TimeAgo,
} from '@vitnode/forum/pages/forum-ui'
import { cn } from 'cn'
import { PenSquareIcon } from 'lucide-react'
import React from 'react'
import { useFormatter, useTranslations } from 'use-intl'

import type { Sort } from './data'

import { SORTS, useFeed, useHomeData } from './data'

export const Compact = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const { forums, forumsById } = useHomeData()
  const [sort, setSort] = React.useState<Sort>('hot')
  const [forumId, setForumId] = React.useState<number | undefined>()
  const feed = useFeed({ forumId, sort })
  const topics = feed.data?.topics ?? []

  return (
    <div className="container mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <HrefLink className={buttonVariants()} href={topicNewHref(forumId)}>
          <PenSquareIcon aria-hidden="true" />
          {t('new_topic')}
        </HrefLink>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div
          aria-label={t('feed.sort.label')}
          className="bg-muted flex items-center gap-1 rounded-lg p-1"
          role="group"
        >
          {SORTS.map((item) => (
            <Button
              aria-pressed={item === sort}
              className={cn(
                'h-10 rounded-md px-3 md:h-7',
                item === sort
                  ? 'bg-background text-foreground hover:bg-background shadow-xs'
                  : 'text-muted-foreground',
              )}
              key={item}
              onClick={() => {
                setSort(item)
              }}
              size="sm"
              variant="ghost"
            >
              {t(`feed.sort.${item}`)}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Forum</span>
          <NativeSelect
            className="max-w-56"
            onChange={(event) => {
              setForumId(
                event.target.value ? Number(event.target.value) : undefined,
              )
            }}
            value={forumId ?? ''}
          >
            <NativeSelectOption value="">All forums</NativeSelectOption>
            {forums.map((forum) => (
              <NativeSelectOption key={forum.id} value={forum.id}>
                {forum.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div
        aria-busy={feed.isFetching}
        className={cn(
          'flex flex-col motion-safe:transition-opacity',
          feed.isPlaceholderData && 'opacity-60',
        )}
      >
        <div
          aria-hidden="true"
          className="text-muted-foreground hidden grid-cols-[4rem_minmax(0,1fr)_5rem_7rem] gap-4 border-b px-2 pb-2 text-xs font-medium tracking-wider uppercase md:grid"
        >
          <span className="text-end">Points</span>
          <span>Topic</span>
          <span className="text-end">Replies</span>
          <span className="text-end">Activity</span>
        </div>

        {feed.isPending ? (
          <p className="text-muted-foreground py-8 text-center" role="status">
            Loading topics…
          </p>
        ) : topics.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            {t('empty_forum.title')}
          </p>
        ) : (
          <ol className="divide-y">
            {topics.map((topic) => {
              const forum = forumsById.get(topic.forum)

              return (
                <li
                  className="hover:bg-muted/50 grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-2 py-3 md:grid-cols-[4rem_minmax(0,1fr)_5rem_7rem]"
                  key={topic.id}
                >
                  <span
                    className={cn(
                      'row-span-2 text-end text-lg font-semibold tabular-nums md:row-span-1',
                      topic.points > 0 && FEEDBACK_TONE_TEXT.success,
                      topic.points < 0 && FEEDBACK_TONE_TEXT.destructive,
                      topic.points === 0 && 'text-muted-foreground',
                    )}
                  >
                    {format.number(topic.points, { signDisplay: 'exceptZero' })}
                    <span className="sr-only"> points</span>
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <HrefLink
                      className="text-foreground truncate font-medium underline-offset-4 hover:underline"
                      href={topicHref(topic.slug)}
                      title={topic.title}
                    >
                      {topic.title}
                    </HrefLink>
                    <p className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
                      {forum ? (
                        <span
                          className="bg-muted text-foreground max-w-40 shrink-0 truncate rounded px-1.5 py-0.5 font-medium"
                          title={forum.name}
                        >
                          {forum.name}
                        </span>
                      ) : null}
                      <PersonAvatar person={topic.author} size={24} />
                      <span className="min-w-0 truncate">
                        <PersonName person={topic.author} />
                      </span>
                    </p>
                  </div>
                  <span className="text-muted-foreground col-start-2 text-xs tabular-nums md:col-start-auto md:text-end md:text-sm">
                    <span className="md:hidden">
                      {t('comment_count', { count: topic.commentCount })}
                    </span>
                    <span className="hidden md:inline">
                      {format.number(topic.commentCount)}
                    </span>
                  </span>
                  <span className="text-muted-foreground hidden text-end text-sm md:block">
                    {topic.lastActivityAt ? (
                      <TimeAgo date={topic.lastActivityAt} />
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
