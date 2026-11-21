// Prototype - variant 11: Playful. Axis: personality - gradient ring, soft shapes, pop-in.
import './playful.css'

import { RoleFormat } from '@vitnode/core/components/role-format'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'

import type { Role, Variant } from './shared'

import {
  NameLink,
  PendingLabel,
  PresenceAvatar,
  ProfileError,
  SignedReputation,
  useCard,
  useJoined,
} from './shared'

const Chip = ({
  children,
  color,
}: {
  children: React.ReactNode
  color?: null | string
}) => (
  <li
    className="bg-muted inline-flex items-center rounded-full px-3 py-1 text-sm"
    style={
      color
        ? { backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)` }
        : undefined
    }
  >
    {children}
  </li>
)

const RoleChip = ({ role }: { role: Role }) => (
  <Chip color={role.color}>
    <RoleFormat role={role} />
  </Chip>
)

const PlayfulSkeleton = () => (
  <div aria-busy="true" className="flex flex-col items-center">
    <PendingLabel />
    <Skeleton className="proto-blob h-24 w-full rounded-none" />
    <Skeleton className="-mt-11 size-21 rounded-full" />
    <div className="flex w-full flex-col items-center gap-2 p-5 pt-3">
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-4 w-2/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const joined = useJoined(query.data?.createdAt ?? 0, true)

  if (query.isPending) return <PlayfulSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data
  const color = `#${user.avatarColor}`

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="proto-blob bg-muted h-24 w-full"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage url={user.coverUrl} />
      </div>
      <div
        className="proto-pop -mt-11 rounded-full p-1"
        style={{
          backgroundImage: `conic-gradient(from 140deg, ${color}, color-mix(in oklab, ${color} 40%, #fbbf24), color-mix(in oklab, ${color} 30%, #f472b6), ${color})`,
        }}
      >
        <PresenceAvatar
          className="border-popover border-4"
          presence={presence}
          size={76}
          user={user}
        />
      </div>
      <div className="flex w-full flex-col items-center gap-3 p-5 pt-3">
        <div className="flex max-w-full min-w-0 flex-col items-center">
          <NameLink
            className="text-foreground line-clamp-2 text-lg font-semibold text-balance"
            name={user.name}
            nameCode={user.nameCode}
          />
          <p className="text-muted-foreground max-w-full truncate text-sm">
            @{user.nameCode}
          </p>
        </div>
        {user.headline ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
            {user.headline}
          </p>
        ) : null}
        <ul
          aria-label="Roles and stats"
          className="flex flex-wrap justify-center gap-1.5"
        >
          <RoleChip role={user.role} />
          {user.secondaryRoles.map((role) => (
            <RoleChip key={role.id} role={role} />
          ))}
          <Chip>
            <SignedReputation
              className="font-semibold"
              value={user.reputation ?? 0}
            />
            &nbsp;rep
          </Chip>
          <Chip>since {joined}</Chip>
        </ul>
      </div>
    </div>
  )
}

export const playful: Variant = {
  name: 'Playful',
  contentClassName: 'w-80 overflow-hidden rounded-3xl p-0',
  Content: Body,
}
