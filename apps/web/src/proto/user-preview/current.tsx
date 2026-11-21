// Prototype - variant 1: the shipped layout, with status moved to an avatar dot.
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { Reputation } from '@vitnode/core/tanstack/reactions'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'

import type { Variant } from './shared'

import {
  AllRoles,
  NameLink,
  PendingLabel,
  PresenceAvatar,
  ProfileError,
  useCard,
  useJoined,
} from './shared'

const CurrentSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <PendingLabel />
    <Skeleton className="h-20 w-full rounded-none" />
    <div className="flex flex-col gap-3 px-4 pb-4">
      <Skeleton className="border-popover bg-muted -mt-8 size-16 rounded-full border-4" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const joined = useJoined(query.data?.createdAt ?? 0)

  if (query.isPending) return <CurrentSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex flex-col">
      <div
        className="bg-muted h-20 w-full"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage url={user.coverUrl} />
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="-mt-8 flex items-end justify-between gap-3">
          <PresenceAvatar
            className="border-popover border-4"
            presence={presence}
            size={64}
            user={user}
          />
          {typeof user.reputation === 'number' ? (
            <Reputation value={user.reputation} />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col">
          <NameLink
            className="text-foreground truncate text-base font-semibold"
            name={user.name}
            nameCode={user.nameCode}
          />
          <p className="text-muted-foreground truncate text-sm">
            @{user.nameCode}
          </p>
        </div>
        {user.headline ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
            {user.headline}
          </p>
        ) : null}
        <AllRoles user={user} />
        <p className="text-muted-foreground text-sm">Joined {joined}</p>
      </div>
    </div>
  )
}

export const current: Variant = {
  name: 'Current',
  contentClassName: 'w-72 overflow-hidden p-0 sm:w-80',
  Content: Body,
}
