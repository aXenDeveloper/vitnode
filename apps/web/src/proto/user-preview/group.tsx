// Prototype - variant 9: Group. Axis: hierarchy - the group is the headline.
import { RoleFormat } from '@vitnode/core/components/role-format'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { Reputation } from '@vitnode/core/tanstack/reactions'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'

import type { Variant } from './shared'

import {
  NameLink,
  PendingLabel,
  PresenceAvatar,
  ProfileError,
  useCard,
  useJoined,
} from './shared'

const GroupSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <PendingLabel />
    <Skeleton className="h-16 w-full rounded-none" />
    <div className="flex items-end gap-3 px-4">
      <Skeleton className="border-popover bg-muted -mt-7 size-14 rounded-full border-4" />
      <div className="flex flex-1 flex-col gap-1.5 pb-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
    <Skeleton className="mx-4 mt-3 h-11 rounded-lg" />
    <Skeleton className="mx-4 my-3 h-4 w-3/4" />
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const joined = useJoined(query.data?.createdAt ?? 0)

  if (query.isPending) return <GroupSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data
  const color = user.role.color

  return (
    <div className="flex flex-col">
      <div className="bg-muted h-16" style={userCoverStyle(user.avatarColor)}>
        <UserCoverImage url={user.coverUrl} />
      </div>

      <div className="flex min-w-0 items-end gap-3 px-4">
        <div className="-mt-7">
          <PresenceAvatar
            className="border-popover border-4"
            presence={presence}
            size={56}
            user={user}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col pb-0.5">
          <NameLink
            className="text-foreground truncate font-semibold"
            name={user.name}
            nameCode={user.nameCode}
          />
          <p className="text-muted-foreground truncate text-sm">
            @{user.nameCode}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div
          className="bg-muted flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5"
          style={
            color
              ? {
                  backgroundColor: `color-mix(in oklab, ${color} 13%, transparent)`,
                }
              : undefined
          }
        >
          <RoleFormat className="min-w-0 text-base" role={user.role} />
          {user.secondaryRoles.length > 0 ? (
            <span className="text-muted-foreground shrink-0 text-sm">
              +{user.secondaryRoles.length} more
            </span>
          ) : null}
        </div>
        {user.headline ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
            {user.headline}
          </p>
        ) : null}
        <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
          <span>Joined {joined}</span>
          {typeof user.reputation === 'number' ? (
            <Reputation value={user.reputation} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const group: Variant = {
  name: 'Group',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
