// Prototype - variant 4: Badge. Axis: symmetric layout + stats + one explicit action.
import { Link } from '@tanstack/react-router'
import { Avatar } from '@vitnode/core/components/avatar'
import { RoleFormat } from '@vitnode/core/components/role-format'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { UserPresenceStatus } from '@vitnode/core/components/user-presence-status'
import { userProfileHref } from '@vitnode/core/components/user-profile-href'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'
import { cn } from 'cn'
import { UserRoundIcon } from 'lucide-react'

import type { Variant } from './shared'

import {
  NameLink,
  PendingLabel,
  ProfileError,
  SignedReputation,
  useJoined,
  usePresence,
  useProfile,
} from './shared'

const Stat = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="flex min-w-0 flex-col items-center gap-0.5 px-2">
    <dd className="text-foreground flex items-center gap-1.5 font-semibold tabular-nums">
      {children}
    </dd>
    <dt className="text-muted-foreground text-sm">{label}</dt>
  </div>
)

const BadgeSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <PendingLabel />
    <Skeleton className="h-16 w-full rounded-none" />
    <div className="flex flex-col items-center gap-3 px-4 pb-4">
      <Skeleton className="border-popover bg-muted -mt-9 size-18 rounded-full border-4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-8 w-full rounded-md" />
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const query = useProfile(nameCode)
  const presence = usePresence(query.data?.id ?? 0)
  const joinedYear = useJoined(query.data?.createdAt ?? 0, true)

  if (query.isPending) return <BadgeSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data
  const online = presence?.status === 'online'

  return (
    <div className="flex flex-col">
      <div
        className="bg-muted h-16 overflow-hidden"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage url={user.coverUrl} />
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pb-4 text-center">
        <Avatar
          alt=""
          className="border-popover -mt-9 size-18 border-4"
          size={72}
          user={user}
        />

        <div className="flex max-w-full min-w-0 flex-col items-center gap-0.5">
          <NameLink
            className="text-foreground line-clamp-2 text-base font-semibold text-balance"
            name={user.name}
            nameCode={user.nameCode}
          />
          <p className="text-muted-foreground max-w-full truncate text-sm">
            @{user.nameCode}
          </p>
        </div>

        <p className="flex max-w-full items-center gap-1.5 text-sm">
          <RoleFormat className="min-w-0" role={user.role} />
          {user.secondaryRoles.length > 0 ? (
            <span className="text-muted-foreground shrink-0">
              +{user.secondaryRoles.length}
            </span>
          ) : null}
        </p>

        {user.headline ? (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed text-pretty">
            {user.headline}
          </p>
        ) : null}

        <dl className="bg-muted/60 grid w-full grid-cols-3 divide-x rounded-lg py-2.5">
          <Stat label="Reputation">
            <SignedReputation value={user.reputation ?? 0} />
          </Stat>
          <Stat label="Joined">{joinedYear}</Stat>
          <Stat label="Status">
            {presence ? (
              <>
                <UserPresenceStatus presence={presence} variant="dot" />
                {presence.status === 'hidden'
                  ? 'Hidden'
                  : online
                    ? 'Online'
                    : 'Offline'}
              </>
            ) : (
              '-'
            )}
          </Stat>
        </dl>

        <Link
          className={cn(
            buttonVariants({ size: 'sm', variant: 'outline' }),
            'w-full',
          )}
          to={userProfileHref(user.nameCode)}
        >
          <UserRoundIcon aria-hidden="true" />
          View profile
        </Link>
      </div>
    </div>
  )
}

export const centered: Variant = {
  name: 'Badge',
  contentClassName: 'w-72 overflow-hidden p-0',
  Content: Body,
}
