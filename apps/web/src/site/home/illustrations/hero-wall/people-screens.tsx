import { Badge } from '@vitnode/core/components/ui/badge'
import { Card } from '@vitnode/core/components/ui/card'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@vitnode/core/components/ui/table'
import { cn } from 'cn'
import {
  ArrowDown,
  Bell,
  Bot,
  ExternalLink,
  MessageSquare,
  Pencil,
  Plus,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import { AdminFrame } from './frames'
import {
  Initials,
  ListRow,
  SearchField,
  StaticButton,
  TableCard,
  ToggleLook,
  utcDate,
} from './parts'

const MEMBERS = [
  {
    avatar: 'bg-primary text-primary-foreground',
    email: 'maya@yourcommunity.com',
    initials: 'MA',
    joined: '2026-10-02',
    name: 'Maya Andersen',
    role: 'administrator',
  },
  {
    avatar: 'bg-sky-500 text-white',
    email: 'k.wojciechowski-hartmann@example.com',
    initials: 'KW',
    joined: '2026-09-28',
    name: 'Maximilian Wojciechowski-Hartmann',
    role: 'moderator',
  },
  {
    avatar: 'bg-amber-400 text-amber-950',
    email: 'olu@studio.dev',
    initials: 'OL',
    joined: '2026-09-14',
    name: 'Olu Lawal',
    role: 'member',
  },
  {
    avatar: 'bg-emerald-500 text-white',
    email: 'jun.sato@example.jp',
    initials: 'JS',
    joined: '2026-08-30',
    name: 'Jun Sato',
    role: 'member',
  },
] as const

export const UsersScreen = () => {
  const t = useTranslations('site.home.hero.wall')
  const format = useFormatter()

  return (
    <AdminFrame
      actions={
        <StaticButton variant="default">
          <UserPlus />
          {t('users.add')}
        </StaticButton>
      }
      description={t('users.desc')}
      page="user_list"
      title={t('nav.users')}
    >
      <div className="flex flex-col gap-4">
        <SearchField placeholder={t('users.search')} />
        <TableCard>
          <TableHeader>
            <TableRow>
              <TableHead>{t('users.user')}</TableHead>
              <TableHead>{t('roles.role')}</TableHead>
              <TableHead>{t('users.joined')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MEMBERS.map(({ avatar, email, initials, joined, name, role }) => (
              <TableRow key={email}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Initials className={avatar} initials={initials} />
                    <span className="flex min-w-0 flex-col">
                      <span className="max-w-64 truncate font-medium">
                        {name}
                      </span>
                      <span className="text-muted-foreground max-w-64 truncate text-xs">
                        {email}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={role === 'member' ? 'secondary' : 'outline'}>
                    {t(`roles.${role}`)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {format.dateTime(utcDate(joined), {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableCard>
      </div>
    </AdminFrame>
  )
}

const ROLES = [
  {
    className: 'text-emerald-600 dark:text-emerald-400',
    key: 'moderator',
    updated: '2026-07-24',
    users: 0,
  },
  {
    className: 'text-red-600 dark:text-red-400',
    key: 'administrator',
    updated: '2026-07-24',
    users: 2,
  },
  { className: '', key: 'member', updated: '2026-07-17', users: 1285 },
  { className: '', key: 'guest', updated: '2025-11-15', users: 0 },
] as const

export const RolesScreen = () => {
  const t = useTranslations('site.home.hero.wall')
  const format = useFormatter()

  return (
    <AdminFrame
      actions={
        <StaticButton variant="default">
          <Plus />
          {t('roles.create')}
        </StaticButton>
      }
      description={t('roles.desc')}
      page="roles"
      title={t('nav.roles')}
    >
      <div className="flex flex-col gap-4">
        <SearchField placeholder={t('roles.search')} />
        <TableCard>
          <TableHeader>
            <TableRow>
              <TableHead>{t('roles.role')}</TableHead>
              <TableHead>{t('roles.users_count')}</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  {t('roles.updated')}
                  <ArrowDown className="size-3.5" />
                </span>
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLES.map(({ className, key, updated, users }) => (
              <TableRow key={key}>
                <TableCell className={cn('font-medium', className)}>
                  {t(`roles.${key}`)}
                </TableCell>
                <TableCell>
                  {users > 0 ? (
                    <span className="text-primary flex items-center gap-1 tabular-nums">
                      {format.number(users)}
                      <ExternalLink className="size-3.5" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground tabular-nums">
                      0
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {format.dateTime(utcDate(updated), {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  })}
                </TableCell>
                <TableCell>
                  <Pencil className="ml-auto size-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableCard>
      </div>
    </AdminFrame>
  )
}

const PERMISSIONS = [
  { key: 'articles', on: true },
  { key: 'members', on: true },
  { key: 'roles', on: false },
  { key: 'layout', on: true },
  { key: 'usage', on: false },
] as const

export const ModeratorsScreen = () => {
  const t = useTranslations('site.home.hero.wall')

  return (
    <AdminFrame
      badge={<Badge variant="outline">{t('roles.moderator')}</Badge>}
      description={t('moderators.desc')}
      page="moderators"
      title={t('nav.moderators')}
    >
      <Card className="py-0" size="sm">
        {PERMISSIONS.map(({ key, on }) => (
          <ListRow key={key}>
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-medium">
                {t(`moderators.${key}`)}
              </span>
              <span className="text-muted-foreground text-xs">
                {t(`moderators.${key}_desc`)}
              </span>
            </span>
            <ToggleLook on={on} />
          </ListRow>
        ))}
      </Card>
    </AdminFrame>
  )
}

export const NotificationsScreen = () => {
  const t = useTranslations('site.home.hero.wall.notifications')
  const nav = useTranslations('site.home.hero.wall.nav')
  const activity = [
    {
      Icon: UserPlus,
      meta: t('minutes_ago', { count: 2 }),
      title: t('joined', { name: 'Olu Lawal' }),
      unread: true,
    },
    {
      Icon: MessageSquare,
      meta: t('minutes_ago', { count: 18 }),
      title: t('published', { name: 'Jun Sato', title: t('published_title') }),
      unread: true,
    },
    {
      Icon: ShieldCheck,
      meta: t('hours_ago', { count: 1 }),
      title: t('role', { name: 'Maya Andersen' }),
      unread: false,
    },
    {
      Icon: Bell,
      meta: t('yesterday'),
      title: t('digest', { count: 1285 }),
      unread: false,
    },
    {
      Icon: Bot,
      meta: t('yesterday'),
      title: t('translated', { count: 12 }),
      unread: false,
    },
  ]

  return (
    <AdminFrame
      actions={<StaticButton>{t('mark_all')}</StaticButton>}
      badge={<Badge>{t('new', { count: 2 })}</Badge>}
      description={t('desc')}
      page="notifications"
      title={nav('notifications')}
    >
      <Card className="py-0" size="sm">
        {activity.map(({ Icon, meta, title, unread }) => (
          <ListRow key={title}>
            <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('truncate text-sm', unread && 'font-medium')}>
                {title}
              </span>
              <span className="text-muted-foreground text-xs">{meta}</span>
            </span>
            {unread && <span className="bg-primary size-2 rounded-full" />}
          </ListRow>
        ))}
      </Card>
    </AdminFrame>
  )
}
