import { useEffect, useState } from 'react'

import { whenIdle } from '@/site/marketing/when-idle'

import {
  ArticlePage,
  BlogIndexPage,
  DiscoverPage,
  ForumIndexPage,
  ForumPage,
  ModcpPage,
  NotificationsPage,
  PaymentsPage,
  ProfilePage,
  SearchPage,
  TopicPage,
} from './app-pages'
import { ArticleScreen, DashboardScreen } from './content-screens'
import { RolesScreen, UsersScreen } from './people-screens'
import { AiScreen } from './system-screens'

const COLUMNS = [
  {
    key: 'activity',
    screens: [
      { key: 'users', Screen: UsersScreen },
      { key: 'discover', Screen: DiscoverPage },
      { key: 'modcp', Screen: ModcpPage },
      { key: 'ai', Screen: AiScreen },
    ],
  },
  {
    key: 'members',
    screens: [
      { key: 'payments', Screen: PaymentsPage },
      { key: 'profile', Screen: ProfilePage },
      { key: 'article', Screen: ArticlePage },
      { key: 'forum', Screen: ForumPage },
    ],
  },
  {
    key: 'community',
    screens: [
      { key: 'notifications', Screen: NotificationsPage },
      { key: 'blog', Screen: BlogIndexPage },
      { key: 'forums', Screen: ForumIndexPage },
      { key: 'search', Screen: SearchPage },
    ],
  },
  {
    key: 'staff',
    screens: [
      { key: 'roles', Screen: RolesScreen },
      { key: 'topic', Screen: TopicPage },
      { key: 'dashboard', Screen: DashboardScreen },
      { key: 'editor', Screen: ArticleScreen },
    ],
  },
]

const slide = (index: number) => {
  const direction = index % 2 === 0 ? -1 : 1
  const offset = index % 2 === 0 ? 4 : -8

  return `translateY(calc(var(--progress, 0) * ${direction * 14}% + ${offset}%))`
}

const SLOT_COUNT =
  COLUMNS.length * Math.max(...COLUMNS.map(({ screens }) => screens.length))

const slotOf = (columnIndex: number, screenIndex: number) =>
  screenIndex * COLUMNS.length + columnIndex

const useMountedSlotCount = () => {
  const [count, setCount] = useState(1)

  useEffect(() => {
    if (count >= SLOT_COUNT) return

    return whenIdle(() => {
      setCount(count + 1)
    })
  }, [count])

  return count
}

export const HeroWallColumns = () => {
  const mountedCount = useMountedSlotCount()

  return (
    <div
      className="absolute top-1/2 left-1/2 flex gap-8"
      style={{
        transform:
          'translate(-50%, -50%) rotateX(50deg) rotateZ(-30deg) scale(var(--wall-scale))',
      }}
    >
      {COLUMNS.map(({ key, screens }, columnIndex) => (
        <div
          className="mk-wall-column flex flex-col gap-8"
          key={key}
          style={{ transform: slide(columnIndex) }}
        >
          {screens.map(({ key: screenKey, Screen }, screenIndex) =>
            slotOf(columnIndex, screenIndex) < mountedCount ? (
              <div
                className="mk-wall-fade bg-card overflow-hidden rounded-2xl border shadow-xl"
                key={screenKey}
              >
                <Screen />
              </div>
            ) : (
              <div
                className="h-130 w-240 border border-transparent"
                key={screenKey}
              />
            ),
          )}
        </div>
      ))}
    </div>
  )
}
