// Prototype - variant 7: Ambient. Axis: restraint - the cover dissolves into the card.
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
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

const FADE =
  'linear-gradient(to bottom, black 0%, rgb(0 0 0 / 0.85) 30%, rgb(0 0 0 / 0.45) 60%, rgb(0 0 0 / 0.12) 85%, transparent 100%)'

const AmbientSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-3 p-4 pt-14">
    <PendingLabel />
    <Skeleton className="size-14 rounded-full" />
    <Skeleton className="h-5 w-3/5" />
    <Skeleton className="h-4 w-2/5" />
    <Skeleton className="h-4 w-4/5" />
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const joined = useJoined(query.data?.createdAt ?? 0)

  if (query.isPending) return <AmbientSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="relative isolate flex flex-col gap-3 p-4 pt-14">
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
      <div className="flex min-w-0 flex-col">
        <NameLink
          className="text-foreground truncate text-base font-semibold"
          name={user.name}
          nameCode={user.nameCode}
        />
        <p className="text-muted-foreground truncate text-sm">
          @{user.nameCode} · joined {joined}
        </p>
      </div>
      {user.headline ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
          {user.headline}
        </p>
      ) : null}
      <AllRoles user={user} />
    </div>
  )
}

export const ambient: Variant = {
  name: 'Ambient',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
