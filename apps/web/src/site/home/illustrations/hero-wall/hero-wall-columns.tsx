import { useEffect, useState } from 'react'

import {
  ArticleScreen,
  CategoriesScreen,
  DashboardScreen,
  FilesScreen,
  NavigationScreen,
} from './content-screens'
import { DevicesScreen, LoginScreen, ProfileScreen } from './member-screens'
import {
  ModeratorsScreen,
  NotificationsScreen,
  RolesScreen,
  UsersScreen,
} from './people-screens'
import {
  AiScreen,
  CronScreen,
  IntegrationsScreen,
  SearchScreen,
} from './system-screens'
import { whenIdle } from './when-idle'

const COLUMNS = [
  {
    key: 'content',
    screens: [
      { key: 'categories', Screen: CategoriesScreen },
      { key: 'login', Screen: LoginScreen },
      { key: 'notifications', Screen: NotificationsScreen },
      { key: 'cron', Screen: CronScreen },
    ],
  },
  {
    key: 'overview',
    screens: [
      { key: 'ai', Screen: AiScreen },
      { key: 'dashboard', Screen: DashboardScreen },
      { key: 'users', Screen: UsersScreen },
      { key: 'files', Screen: FilesScreen },
    ],
  },
  {
    key: 'publishing',
    screens: [
      { key: 'navigation', Screen: NavigationScreen },
      { key: 'article', Screen: ArticleScreen },
      { key: 'integrations', Screen: IntegrationsScreen },
      { key: 'devices', Screen: DevicesScreen },
    ],
  },
  {
    key: 'people',
    screens: [
      { key: 'moderators', Screen: ModeratorsScreen },
      { key: 'roles', Screen: RolesScreen },
      { key: 'profile', Screen: ProfileScreen },
      { key: 'search', Screen: SearchScreen },
    ],
  },
]

const slide = (index: number) => {
  const direction = index % 2 === 0 ? -1 : 1
  const offset = index % 2 === 0 ? 4 : -8

  return `translateY(calc(var(--progress, 0) * ${direction * 14}% + ${offset}%))`
}

const useMountedColumnCount = () => {
  const [count, setCount] = useState(1)

  useEffect(() => {
    if (count >= COLUMNS.length) return

    return whenIdle(() => {
      setCount(count + 1)
    })
  }, [count])

  return count
}

export const HeroWallColumns = () => {
  const mountedCount = useMountedColumnCount()

  return (
    <div
      className="absolute top-1/2 left-1/2 flex gap-8"
      style={{
        transform:
          'translate(-50%, -50%) rotateX(50deg) rotateZ(-30deg) scale(var(--wall-scale))',
      }}
    >
      {COLUMNS.map(({ key, screens }, index) => (
        <div
          className="mk-wall-column"
          key={key}
          style={{ transform: slide(index) }}
        >
          {index < mountedCount ? (
            <div className="mk-wall-fade flex flex-col gap-8">
              {screens.map(({ key: screenKey, Screen }) => (
                <div
                  className="bg-card overflow-hidden rounded-2xl border shadow-xl"
                  key={screenKey}
                >
                  <Screen />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-130 w-240 border border-transparent" />
          )}
        </div>
      ))}
    </div>
  )
}
