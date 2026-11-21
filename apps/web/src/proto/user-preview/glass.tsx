// Prototype - variant 8: Glass. Axis: material - the blurred cover tints the whole card.
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

const GlassSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-3 p-2">
    <PendingLabel />
    <Skeleton className="h-24 w-full rounded-md" />
    <div className="flex items-center gap-3 px-2">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
    <Skeleton className="mx-2 mb-2 h-4 w-4/5" />
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const joined = useJoined(query.data?.createdAt ?? 0)

  if (query.isPending) return <GlassSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="relative isolate flex flex-col gap-3 p-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 scale-125 blur-2xl"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage url={user.coverUrl} />
      </div>
      <div
        aria-hidden="true"
        className="bg-popover/75 absolute inset-0 -z-10"
      />

      <div
        className="bg-muted relative h-24 overflow-hidden rounded-md shadow-sm"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage className="absolute inset-0" url={user.coverUrl} />
      </div>

      <div className="flex min-w-0 items-center gap-3 px-2">
        <PresenceAvatar
          className="ring-2 ring-white/40"
          presence={presence}
          ringClassName="ring-popover/80"
          size={48}
          user={user}
        />
        <div className="flex min-w-0 flex-1 flex-col">
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

      <div className="flex flex-col gap-3 px-2 pb-2">
        {user.headline ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
            {user.headline}
          </p>
        ) : null}
        <AllRoles user={user} />
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

export const glass: Variant = {
  name: 'Glass',
  contentClassName: 'w-80 overflow-hidden bg-popover/40 p-0',
  Content: Body,
}
