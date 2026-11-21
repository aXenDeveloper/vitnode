// Prototype - variant 6: ID card. Axis: personality - a member card with a square photo.
import { RoleFormat } from '@vitnode/core/components/role-format'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'
import { useFormatter } from 'use-intl'

import type { Variant } from './shared'

import {
  NameLink,
  PendingLabel,
  PresenceAvatar,
  ProfileError,
  SignedReputation,
  useCard,
} from './shared'

const Field = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
      {label}
    </dt>
    <dd className="truncate text-sm font-medium tabular-nums">{children}</dd>
  </div>
)

const IdSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-3">
    <PendingLabel />
    <Skeleton className="h-12 w-full rounded-md" />
    <div className="flex gap-3">
      <Skeleton className="size-16 shrink-0 rounded-xl" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
    <Skeleton className="h-10 w-full" />
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const format = useFormatter()

  if (query.isPending) return <IdSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-muted relative h-12 overflow-hidden rounded-md"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage className="absolute inset-0" url={user.coverUrl} />
      </div>

      <div className="flex min-w-0 gap-3">
        <PresenceAvatar
          presence={presence}
          shape="square"
          size={64}
          user={user}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <NameLink
            className="text-foreground line-clamp-2 font-semibold text-balance"
            name={user.name}
            nameCode={user.nameCode}
          />
          <p className="text-muted-foreground truncate text-sm">
            @{user.nameCode}
          </p>
          <RoleFormat className="text-sm" role={user.role} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t border-dashed pt-3">
        <Field label="Member">#{String(user.id).padStart(5, '0')}</Field>
        <Field label="Since">
          {format.dateTime(new Date(user.createdAt), {
            month: 'short',
            year: 'numeric',
          })}
        </Field>
        <Field label="Rep">
          <SignedReputation value={user.reputation ?? 0} />
        </Field>
      </dl>
    </div>
  )
}

export const idCard: Variant = {
  name: 'ID',
  contentClassName: 'w-80 p-3',
  Content: Body,
}
