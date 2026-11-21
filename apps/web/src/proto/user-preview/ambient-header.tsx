// Prototype - the Ambient header (variant 7 of round 2) shared by this round's riffs,
// plus the content blocks modelled on the screenshot.
import { parseEmojiIcon } from '@vitnode/api/lib/emoji-icon'
import { RoleFormat } from '@vitnode/core/components/role-format'
import { resolveRoleName } from '@vitnode/core/components/role-name'
import { EmojiIcon } from '@vitnode/core/components/ui/emoji-icon'
import { FEEDBACK_TONE_TEXT } from '@vitnode/core/components/ui/feedback-tone'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'
import { cn } from 'cn'
import { useLocale } from 'use-intl'

import type { Presence, Profile, Role } from './shared'

import { NameLink, PendingLabel, PresenceAvatar } from './shared'

const FADE =
  'linear-gradient(to bottom, black 0%, rgb(0 0 0 / 0.85) 30%, rgb(0 0 0 / 0.45) 60%, rgb(0 0 0 / 0.12) 85%, transparent 100%)'

/** Short elapsed time, like the screenshot's "9 yr" / "14 hr". */
export const useElapsed = () => {
  const locale = useLocale()

  return (date: Date | string) => {
    const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000)
    const steps = [
      ['year', 31_536_000],
      ['month', 2_592_000],
      ['day', 86_400],
      ['hour', 3600],
      ['minute', 60],
    ] as const
    const [unit, size] = steps.find(([, s]) => seconds >= s) ?? ['minute', 60]

    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).format(Math.max(1, Math.floor(seconds / size)))
  }
}

export const LastVisited = ({ presence }: { presence: Presence }) => {
  const elapsed = useElapsed()
  if (!presence) return <>-</>
  if (presence.status === 'hidden') return <>Hidden</>
  if (presence.status === 'online') {
    return <span className={FEEDBACK_TONE_TEXT.success}>Online now</span>
  }

  return <>{presence.lastSeenAt ? elapsed(presence.lastSeenAt) : '-'}</>
}

export const AmbientHeader = ({
  presence,
  user,
}: {
  presence: Presence
  user: Profile
}) => (
  <div className="relative isolate flex flex-col gap-3 px-4 pt-14 pb-4">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 opacity-70"
      style={{
        ...userCoverStyle(user.avatarColor),
        maskImage: FADE,
        WebkitMaskImage: FADE,
      }}
    >
      <UserCoverImage url={user.coverUrl} />
    </div>
    <PresenceAvatar
      className="ring-popover/60 ring-4"
      presence={presence}
      size={56}
      user={user}
    />
    <div className="flex min-w-0 flex-col gap-0.5">
      <NameLink
        className="text-foreground truncate text-base font-semibold"
        name={user.name}
        nameCode={user.nameCode}
      />
      <p className="flex min-w-0 items-center gap-1.5 text-sm">
        <RoleFormat className="max-w-3/5 shrink-0" role={user.role} />
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span className="text-muted-foreground truncate">@{user.nameCode}</span>
      </p>
    </div>
  </div>
)

export const AmbientHeaderSkeleton = () => (
  <div className="flex flex-col gap-3 px-4 pt-14 pb-4">
    <PendingLabel />
    <Skeleton className="size-14 rounded-full" />
    <Skeleton className="h-5 w-3/5" />
    <Skeleton className="h-4 w-2/5" />
  </div>
)

const tint = (color: null | string, amount = 15) =>
  color
    ? {
        backgroundColor: `color-mix(in oklab, ${color} ${amount}%, transparent)`,
        color,
      }
    : undefined

const RoleIcon = ({ className, role }: { className?: string; role: Role }) => {
  const locale = useLocale()
  const prefix = parseEmojiIcon(role.prefix)

  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-muted text-muted-foreground flex shrink-0 items-center justify-center',
        className,
      )}
      style={tint(role.color)}
    >
      {prefix ? (
        <EmojiIcon value={prefix} />
      ) : (
        <span className="text-sm font-semibold">
          {resolveRoleName(role, locale).slice(0, 1).toLocaleUpperCase()}
        </span>
      )}
    </span>
  )
}

/** The screenshot's rank row: the group with its icon, other roles as badges. */
export const GroupRow = ({ user }: { user: Profile }) => {
  const locale = useLocale()

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <RoleIcon className="size-9 rounded-lg" role={user.role} />
        <span
          className="truncate font-medium"
          style={user.role.color ? { color: user.role.color } : undefined}
        >
          {resolveRoleName(user.role, locale)}
        </span>
      </div>
      {user.secondaryRoles.length > 0 ? (
        <ul
          aria-label="Other roles"
          className="flex shrink-0 items-center gap-1"
        >
          {user.secondaryRoles.map((role) => {
            const name = resolveRoleName(role, locale)

            return (
              <li key={role.id} title={name}>
                <RoleIcon className="size-7 rounded-full" role={role} />
                <span className="sr-only">{name}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
