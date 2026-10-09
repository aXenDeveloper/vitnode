import { useScrollProgress } from '@/site/home/use-scroll-progress'

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

export const HeroWall = () => {
  const ref = useScrollProgress<HTMLDivElement>(0.9)

  return (
    <div
      aria-hidden
      className="relative -mx-4 h-112 mask-t-from-85% mask-b-from-80% select-none [--wall-scale:0.24] sm:-mx-6 sm:h-144 sm:[--wall-scale:0.3] lg:mr-[calc(50%-50vw)] lg:-ml-24 lg:h-176 lg:mask-l-from-58% lg:mask-l-to-88% lg:[--wall-scale:0.46]"
      inert
      ref={ref}
      style={{ perspective: '1800px' }}
    >
      <div
        className="absolute top-1/2 left-1/2 flex gap-8"
        style={{
          transform:
            'translate(-50%, -50%) rotateX(50deg) rotateZ(-30deg) scale(var(--wall-scale))',
        }}
      >
        {COLUMNS.map(({ key, screens }, index) => (
          <div
            className="flex flex-col gap-8 will-change-transform"
            key={key}
            style={{ transform: slide(index) }}
          >
            {screens.map(({ key: screenKey, Screen }) => (
              <div
                className="bg-card overflow-hidden rounded-2xl border shadow-xl"
                key={screenKey}
              >
                <Screen />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
