// Prototype - riff 3: Stats. One stat strip, the group row and a single action.
import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { userProfileHref } from '@vitnode/core/components/user-profile-href'
import { cn } from 'cn'
import { UserRoundIcon } from 'lucide-react'

import type { Variant } from './shared'

import {
  AmbientHeader,
  AmbientHeaderSkeleton,
  GroupRow,
  LastVisited,
  useElapsed,
} from './ambient-header'
import { ProfileError, SignedReputation, useCard } from './shared'

const Stat = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="flex min-w-0 flex-col items-center gap-0.5 px-1">
    <dd className="text-foreground truncate font-semibold tabular-nums">
      {children}
    </dd>
    <dt className="text-muted-foreground text-sm">{label}</dt>
  </div>
)

const StatsSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <AmbientHeaderSkeleton />
    <div className="flex flex-col gap-3 px-4 pb-4">
      <Skeleton className="h-14 rounded-lg" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-8" />
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const elapsed = useElapsed()

  if (query.isPending) return <StatsSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex flex-col">
      <AmbientHeader presence={presence} user={user} />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <dl className="bg-muted/60 grid grid-cols-3 divide-x rounded-lg py-2.5">
          <Stat label="Reputation">
            <SignedReputation value={user.reputation ?? 0} />
          </Stat>
          <Stat label="Joined">{elapsed(user.createdAt)}</Stat>
          <Stat label="Last seen">
            <LastVisited presence={presence} />
          </Stat>
        </dl>
        <GroupRow user={user} />
        <Link
          className={cn(buttonVariants({ size: 'sm' }), 'w-full')}
          to={userProfileHref(user.nameCode)}
        >
          <UserRoundIcon aria-hidden="true" />
          View profile
        </Link>
      </div>
    </div>
  )
}

export const stats: Variant = {
  name: 'Stats',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
