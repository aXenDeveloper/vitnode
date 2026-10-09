import { cn } from 'cn'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  FilePenLine,
  KeyRound,
  LayoutDashboard,
  Link2,
  List,
  Monitor,
  Server,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

export type AdminPage =
  | 'ai_overview'
  | 'articles'
  | 'categories'
  | 'cron'
  | 'dashboard'
  | 'files'
  | 'integrations'
  | 'moderators'
  | 'navigation'
  | 'notifications'
  | 'roles'
  | 'search'
  | 'user_list'

const CORE_NAV = [
  { children: [], Icon: LayoutDashboard, key: 'dashboard' },
  { children: ['user_list', 'roles'], Icon: UserRound, key: 'users' },
  { children: ['moderators', 'admins'], Icon: ShieldCheck, key: 'staff' },
  {
    children: ['integrations', 'navigation', 'files', 'notifications'],
    Icon: Server,
    key: 'system',
  },
  { children: ['cron', 'queue', 'search'], Icon: Wrench, key: 'advanced' },
  {
    children: ['ai_overview', 'ai_actions', 'ai_history'],
    Icon: Sparkles,
    key: 'ai',
  },
] as const

const BLOG_NAV = [
  { Icon: FilePenLine, key: 'articles' },
  { Icon: List, key: 'categories' },
] as const

const NavItem = ({
  active,
  children,
  expandable = false,
  Icon,
  open = false,
}: {
  active: boolean
  children: React.ReactNode
  expandable?: boolean
  Icon: React.ElementType
  open?: boolean
}) => (
  <span
    className={cn(
      'flex h-8 items-center gap-2 rounded-md px-2 text-sm',
      active && 'bg-muted font-medium',
    )}
  >
    <Icon className="size-4 shrink-0" />
    <span className="flex-1 truncate">{children}</span>
    {expandable &&
      (open ? (
        <ChevronDown className="size-4" />
      ) : (
        <ChevronRight className="size-4" />
      ))}
  </span>
)

const NavGroup = ({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-muted-foreground px-2 pb-1 text-xs">{title}</span>
    {children}
  </div>
)

const AdminSidebar = ({ page }: { page: AdminPage }) => {
  const t = useTranslations('site.home.hero.wall.nav')

  return (
    <div className="bg-sidebar text-sidebar-foreground flex w-52 shrink-0 flex-col gap-5 border-r p-3">
      <NavGroup title={t('core')}>
        {CORE_NAV.map(({ children, Icon, key }) => {
          const open = children.some((child) => child === page)

          return (
            <div className="flex flex-col gap-0.5" key={key}>
              <NavItem
                active={key === page}
                expandable={children.length > 0}
                Icon={Icon}
                open={open}
              >
                {t(key)}
              </NavItem>
              {open &&
                children.map((child) => (
                  <span
                    className={cn(
                      'ml-4 flex h-7 items-center rounded-md border-l px-3 text-sm',
                      child === page && 'bg-muted font-medium',
                    )}
                    key={child}
                  >
                    {t(child)}
                  </span>
                ))}
            </div>
          )
        })}
      </NavGroup>
      <NavGroup title={t('blog')}>
        {BLOG_NAV.map(({ Icon, key }) => (
          <NavItem active={key === page} Icon={Icon} key={key}>
            {t(key)}
          </NavItem>
        ))}
      </NavGroup>
    </div>
  )
}

export const SCREEN =
  'bg-background text-foreground flex h-130 w-240 overflow-hidden text-left'

export const AdminFrame = ({
  actions,
  badge,
  children,
  description,
  page,
  title,
}: {
  actions?: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
  description: string
  page: AdminPage
  title: string
}) => (
  <div className={SCREEN}>
    <AdminSidebar page={page} />
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight">
              {title}
            </span>
            {badge}
          </div>
          <span className="text-muted-foreground text-sm">{description}</span>
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  </div>
)

const SETTINGS_NAV = [
  { Icon: UserRound, key: 'overview' },
  { Icon: KeyRound, key: 'security' },
  { Icon: Monitor, key: 'devices' },
  { Icon: Link2, key: 'sso' },
  { Icon: Bell, key: 'notifications' },
  { Icon: Sparkles, key: 'ai' },
] as const

export const SettingsFrame = ({
  children,
  page,
}: {
  children: React.ReactNode
  page: 'devices' | 'overview'
}) => {
  const t = useTranslations('site.home.hero.wall.settings')

  return (
    <div className={cn(SCREEN, 'flex-col gap-6 p-8')}>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{t('title')}</span>
        <span className="text-2xl font-semibold tracking-tight">{t(page)}</span>
      </div>
      <div className="flex gap-8">
        <div className="flex w-52 shrink-0 flex-col gap-1">
          {SETTINGS_NAV.map(({ Icon, key }) => (
            <span
              className={cn(
                'flex h-9 items-center gap-2 rounded-full px-3 text-sm',
                key === page && 'bg-primary/10 text-primary font-medium',
              )}
              key={key}
            >
              <Icon className="size-4" />
              {t(key)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
      </div>
    </div>
  )
}
