// Prototype - variant 2: Compact. Axis: density - one identity row, cover as a framed band.
import { RoleFormat } from '@vitnode/core/components/role-format'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'

import type { Variant } from './shared'

import {
  NameLink,
  PendingLabel,
  PresenceAvatar,
  ProfileError,
  SignedReputation,
  useJoined,
  usePresence,
  useProfile,
} from './shared'

const CompactSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-3">
    <PendingLabel />
    <Skeleton className="h-14 w-full rounded-md" />
    <div className="flex items-center gap-3">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
    <Skeleton className="h-4 w-4/5" />
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const query = useProfile(nameCode)
  const presence = usePresence(query.data?.id ?? 0)
  const joined = useJoined(query.data?.createdAt ?? 0)

  if (query.isPending) return <CompactSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-muted h-14 overflow-hidden rounded-md"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage url={user.coverUrl} />
      </div>

      <div className="flex items-center gap-3">
        <PresenceAvatar presence={presence} size={44} user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <NameLink
            className="text-foreground truncate font-semibold"
            name={user.name}
            nameCode={user.nameCode}
          />
          <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
            <span className="truncate">@{user.nameCode}</span>
            <span aria-hidden="true">·</span>
            <RoleFormat className="max-w-3/5 shrink-0" role={user.role} />
          </p>
        </div>
      </div>

      {user.headline ? (
        <p className="truncate text-sm leading-relaxed" title={user.headline}>
          {user.headline}
        </p>
      ) : null}

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 border-t pt-2.5 text-sm">
        <span>Joined {joined}</span>
        {typeof user.reputation === 'number' ? (
          <>
            <span aria-hidden="true">·</span>
            <span>
              <SignedReputation
                className="font-medium"
                value={user.reputation}
              />{' '}
              rep
            </span>
          </>
        ) : null}
        {user.secondaryRoles.length > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>+{user.secondaryRoles.length} roles</span>
          </>
        ) : null}
      </p>
    </div>
  )
}

export const compact: Variant = {
  name: 'Compact',
  contentClassName: 'w-80 p-3',
  Content: Body,
}
