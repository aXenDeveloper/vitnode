// Prototype - throwaway. Deleted after a direction is picked.
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Avatar } from '@vitnode/core/components/avatar'
import { RoleFormat } from '@vitnode/core/components/role-format'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'
import { FEEDBACK_TONE_TEXT } from '@vitnode/core/components/ui/feedback-tone'
import { ShortNumber } from '@vitnode/core/components/ui/short-number'
import { userProfileHref } from '@vitnode/core/components/user-profile-href'
import {
  isProfileNotFound,
  userProfileQueryOptions,
} from '@vitnode/core/tanstack/profile'
import { userPresenceQueryOptions } from '@vitnode/core/views/presence/presence-query'
import { cn } from 'cn'
import { IdCardIcon, RotateCwIcon, UserRoundXIcon } from 'lucide-react'
import { useFormatter, useNow, useTranslations } from 'use-intl'

export const useProfile = (nameCode: string) =>
  useQuery(userProfileQueryOptions({ nameCode }))

export const usePresence = (userId: number) =>
  useQuery({
    ...userPresenceQueryOptions({ userId, viewerId: null }),
    enabled: userId > 0,
  }).data

export const useJoined = (createdAt: Date | number | string, year = false) => {
  const format = useFormatter()

  return format.dateTime(
    new Date(createdAt),
    year ? { year: 'numeric' } : { month: 'short', year: 'numeric' },
  )
}

export const NameLink = ({
  className,
  name,
  nameCode,
}: {
  className?: string
  name: string
  nameCode: string
}) => (
  <Link
    className={cn(
      'focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3',
      className,
    )}
    to={userProfileHref(nameCode)}
  >
    {name}
  </Link>
)

export const SignedReputation = ({
  className,
  value,
}: {
  className?: string
  value: number
}) => (
  <ShortNumber
    className={cn(
      'tabular-nums',
      value > 0 && FEEDBACK_TONE_TEXT.success,
      value < 0 && FEEDBACK_TONE_TEXT.destructive,
      className,
    )}
    formatOptions={{ signDisplay: 'exceptZero' }}
    value={value}
  />
)

export const ProfileError = ({
  query,
}: {
  query: ReturnType<typeof useProfile>
}) => {
  const t = useTranslations('core.profile')
  const notFound = isProfileNotFound(query.error)

  return (
    <Empty className="p-6" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {notFound ? (
            <UserRoundXIcon aria-hidden="true" />
          ) : (
            <IdCardIcon aria-hidden="true" />
          )}
        </EmptyMedia>
        <EmptyTitle>
          {notFound ? t('notFound.title') : t('preview.load_error.title')}
        </EmptyTitle>
        <EmptyDescription>
          {notFound ? t('notFound.desc') : t('preview.load_error.desc')}
        </EmptyDescription>
      </EmptyHeader>
      {notFound ? null : (
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t('preview.retry')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

export const PendingLabel = () => {
  const t = useTranslations('core.global')

  return (
    <span className="sr-only" role="status">
      {t('loading')}
    </span>
  )
}

export interface Variant {
  Content: (props: { nameCode: string }) => React.ReactNode
  contentClassName: string
  name: string
}

export type Profile = NonNullable<ReturnType<typeof useProfile>['data']>
export type Presence = ReturnType<typeof usePresence>
export type Role = Profile['role']

export const useCard = (nameCode: string) => {
  const query = useProfile(nameCode)
  const presence = usePresence(query.data?.id ?? 0)

  return { presence, query }
}

const usePresenceLabel = (presence: Presence) => {
  const t = useTranslations('core.global.presence')
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  if (!presence || presence.status === 'hidden') return null
  if (presence.status === 'online') return t('online_now')
  if (presence.lastSeenAt) {
    return t('last_seen', {
      time: format.relativeTime(new Date(presence.lastSeenAt), now),
    })
  }

  return t('offline')
}

/**
 * The avatar with the member's online status as a dot on its bottom-right
 * edge. `ringClassName` must match the surface behind the avatar so the dot
 * reads as cut out of it.
 */
export const PresenceAvatar = ({
  className,
  presence,
  ringClassName = 'ring-popover',
  shape = 'circle',
  size,
  user,
}: {
  className?: string
  presence: Presence
  ringClassName?: string
  shape?: 'circle' | 'square'
  size: number
  user: Profile
}) => {
  const label = usePresenceLabel(presence)
  const online = presence?.status === 'online'
  const dot = Math.max(10, Math.round(size * 0.2))
  // On a circle the bottom-right point of the edge sits ~15% in from the box.
  const offset =
    shape === 'circle'
      ? Math.round(size * 0.146 - dot / 2)
      : -Math.round(dot / 3)

  return (
    <span className="relative inline-flex size-fit shrink-0">
      <Avatar
        alt=""
        className={cn(shape === 'square' && 'rounded-xl', className)}
        size={size}
        style={{ height: size, width: size }}
        user={user}
      />
      {label ? (
        <span
          aria-label={label}
          className={cn(
            'absolute rounded-full ring-2',
            ringClassName,
            online ? 'bg-success' : 'bg-muted-foreground',
          )}
          role="img"
          style={{ bottom: offset, height: dot, right: offset, width: dot }}
          title={label}
        />
      ) : null}
    </span>
  )
}

export const AllRoles = ({
  className,
  user,
}: {
  className?: string
  user: Profile
}) => (
  <ul
    aria-label="Roles"
    className={cn(
      'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm',
      className,
    )}
  >
    <li className="min-w-0">
      <RoleFormat role={user.role} />
    </li>
    {user.secondaryRoles.map((role) => (
      <li className="min-w-0" key={role.id}>
        <RoleFormat className="font-normal" role={role} />
      </li>
    ))}
  </ul>
)
