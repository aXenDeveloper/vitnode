// Prototype - variant 5: Split. Axis: horizontal layout - the cover becomes a side panel.
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
  SignedReputation,
  useCard,
  useJoined,
} from './shared'

const SplitSkeleton = () => (
  <div aria-busy="true" className="flex min-h-44">
    <PendingLabel />
    <Skeleton className="w-24 shrink-0 rounded-none" />
    <div className="flex flex-1 flex-col gap-2.5 p-4">
      <Skeleton className="border-popover bg-muted -ms-11 size-14 rounded-full border-4" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const joined = useJoined(query.data?.createdAt ?? 0)

  if (query.isPending) return <SplitSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex min-h-44">
      <div
        className="bg-muted relative w-24 shrink-0 overflow-hidden"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage className="absolute inset-0" url={user.coverUrl} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div className="-ms-11">
          <PresenceAvatar
            className="border-popover border-4"
            presence={presence}
            size={56}
            user={user}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <NameLink
            className="text-foreground line-clamp-2 font-semibold text-balance"
            name={user.name}
            nameCode={user.nameCode}
          />
          <p className="text-muted-foreground truncate text-sm">
            @{user.nameCode}
          </p>
        </div>
        <AllRoles user={user} />
        {user.headline ? (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {user.headline}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-auto text-sm">
          {joined} ·{' '}
          <SignedReputation
            className="font-medium"
            value={user.reputation ?? 0}
          />{' '}
          rep
        </p>
      </div>
    </div>
  )
}

export const split: Variant = {
  name: 'Split',
  contentClassName: 'w-96 max-w-[calc(100vw-2rem)] overflow-hidden p-0',
  Content: Body,
}
