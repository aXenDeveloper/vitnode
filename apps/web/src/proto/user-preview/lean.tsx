// Prototype - riff 4: Lean. Meta row and group row only; the name is the way in.
import { Skeleton } from '@vitnode/core/components/ui/skeleton'

import type { Variant } from './shared'

import {
  AmbientHeader,
  AmbientHeaderSkeleton,
  GroupRow,
  LastVisited,
  useElapsed,
} from './ambient-header'
import { ProfileError, SignedReputation, useCard } from './shared'

const LeanSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <AmbientHeaderSkeleton />
    <div className="flex flex-col gap-3 border-t p-4">
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const elapsed = useElapsed()

  if (query.isPending) return <LeanSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex flex-col">
      <AmbientHeader presence={presence} user={user} />
      {user.headline ? (
        <p className="-mt-1 px-4 pb-4 text-sm leading-relaxed text-pretty">
          {user.headline}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 border-t p-4">
        <dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="flex gap-1">
            <dt>Joined</dt>
            <dd className="text-foreground font-medium">
              {elapsed(user.createdAt)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Seen</dt>
            <dd className="text-foreground font-medium">
              <LastVisited presence={presence} />
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="sr-only">Reputation</dt>
            <dd className="font-medium">
              <SignedReputation value={user.reputation ?? 0} />
            </dd>
            <span aria-hidden="true">rep</span>
          </div>
        </dl>
        <GroupRow user={user} />
      </div>
    </div>
  )
}

export const lean: Variant = {
  name: 'Lean',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
