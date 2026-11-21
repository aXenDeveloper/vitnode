// Prototype - variant 10: Details. Axis: structure - a labelled key-value list.
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

const Row = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="grid grid-cols-3 gap-3 py-2">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="col-span-2 min-w-0 text-sm">{children}</dd>
  </div>
)

const DetailsSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <PendingLabel />
    <Skeleton className="h-14 w-full rounded-none" />
    <div className="flex items-end gap-3 px-4">
      <Skeleton className="border-popover bg-muted -mt-6 size-12 rounded-full border-4" />
      <Skeleton className="mb-1 h-4 w-1/2" />
    </div>
    <div className="flex flex-col gap-3 p-4">
      {[0, 1, 2, 3].map((key) => (
        <div className="grid grid-cols-3 gap-3" key={key}>
          <Skeleton className="h-4" />
          <Skeleton className="col-span-2 h-4" />
        </div>
      ))}
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const format = useFormatter()

  if (query.isPending) return <DetailsSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data

  return (
    <div className="flex flex-col">
      <div className="bg-muted h-14" style={userCoverStyle(user.avatarColor)}>
        <UserCoverImage url={user.coverUrl} />
      </div>
      <div className="flex min-w-0 items-end gap-3 px-4">
        <div className="-mt-6">
          <PresenceAvatar
            className="border-popover border-4"
            presence={presence}
            size={52}
            user={user}
          />
        </div>
        <div className="flex min-w-0 flex-col pb-0.5">
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
      <dl className="divide-y px-4 pt-2 pb-2">
        <Row label="Group">
          <RoleFormat role={user.role} />
        </Row>
        {user.secondaryRoles.length > 0 ? (
          <Row label="Also">
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {user.secondaryRoles.map((role) => (
                <RoleFormat className="font-normal" key={role.id} role={role} />
              ))}
            </span>
          </Row>
        ) : null}
        {user.headline ? (
          <Row label="About">
            <span className="line-clamp-2 leading-relaxed">
              {user.headline}
            </span>
          </Row>
        ) : null}
        <Row label="Joined">
          {format.dateTime(new Date(user.createdAt), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Row>
        <Row label="Reputation">
          <SignedReputation
            className="font-medium"
            value={user.reputation ?? 0}
          />
        </Row>
      </dl>
    </div>
  )
}

export const details: Variant = {
  name: 'Details',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
