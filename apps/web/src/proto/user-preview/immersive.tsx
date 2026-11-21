// Prototype - variant 3: Immersive. Axis: media-forward - identity sits on the cover.
import { Avatar } from '@vitnode/core/components/avatar'
import { RoleFormat } from '@vitnode/core/components/role-format'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { UserPresenceStatus } from '@vitnode/core/components/user-presence-status'
import { Reputation } from '@vitnode/core/tanstack/reactions'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'

import type { Variant } from './shared'

import {
  NameLink,
  PendingLabel,
  ProfileError,
  useJoined,
  usePresence,
  useProfile,
} from './shared'

// Eased scrim: plain two-stop gradients band and leave the middle too light.
const SCRIM =
  'linear-gradient(to top, rgb(0 0 0 / 0.72) 0%, rgb(0 0 0 / 0.6) 18%, rgb(0 0 0 / 0.4) 38%, rgb(0 0 0 / 0.18) 60%, rgb(0 0 0 / 0.05) 80%, transparent 100%)'

const RolePill = ({
  role,
}: {
  role: Parameters<typeof RoleFormat>[0]['role']
}) => (
  <li
    className="bg-muted inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-sm"
    style={
      role.color
        ? {
            backgroundColor: `color-mix(in oklab, ${role.color} 14%, transparent)`,
          }
        : undefined
    }
  >
    <RoleFormat role={role} />
  </li>
)

const ImmersiveSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <PendingLabel />
    <div className="bg-muted flex h-36 items-end gap-3 p-4 motion-safe:animate-pulse">
      <Skeleton className="bg-foreground/10 size-14 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5 pb-1">
        <Skeleton className="bg-foreground/10 h-4 w-3/5" />
        <Skeleton className="bg-foreground/10 h-3.5 w-2/5" />
      </div>
    </div>
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const query = useProfile(nameCode)
  const presence = usePresence(query.data?.id ?? 0)
  const joined = useJoined(query.data?.createdAt ?? 0)

  if (query.isPending) return <ImmersiveSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex flex-col">
      <div
        className="bg-muted relative isolate h-36 overflow-hidden"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage className="absolute inset-0" url={user.coverUrl} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: SCRIM }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
          <Avatar
            alt=""
            className="size-14 shrink-0 ring-2 ring-white/90"
            size={56}
            user={user}
          />
          <div className="flex min-w-0 flex-col pb-0.5">
            <NameLink
              className="truncate text-base font-semibold text-white focus-visible:ring-white/70"
              name={user.name}
              nameCode={user.nameCode}
            />
            <p className="truncate text-sm text-white/80">@{user.nameCode}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <ul aria-label="Roles" className="flex flex-wrap gap-1.5">
          <RolePill role={user.role} />
          {user.secondaryRoles.map((role) => (
            <RolePill key={role.id} role={role} />
          ))}
        </ul>

        {user.headline ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
            {user.headline}
          </p>
        ) : null}

        <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span>Joined {joined}</span>
            {presence ? <UserPresenceStatus presence={presence} /> : null}
          </span>
          {typeof user.reputation === 'number' ? (
            <Reputation value={user.reputation} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const immersive: Variant = {
  name: 'Immersive',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
