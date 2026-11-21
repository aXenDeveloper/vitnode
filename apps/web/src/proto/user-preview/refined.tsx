// Prototype - Sheet, refined: primary role under the handle, three stat cards,
// a moderator-only warnings summary and a single action.
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RoleFormat } from '@vitnode/core/components/role-format'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { Button } from '@vitnode/core/components/ui/button'
import { FEEDBACK_TONE_TEXT } from '@vitnode/core/components/ui/feedback-tone'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { UserCoverImage } from '@vitnode/core/components/user-cover-image'
import { userProfileHref } from '@vitnode/core/components/user-profile-href'
import { useSessionQuery } from '@vitnode/core/tanstack/auth'
import { ModcpRequestError } from '@vitnode/core/views/moderation/modcp/modcp-query'
import { memberStandingQueryOptions } from '@vitnode/core/views/moderation/warnings/warnings-api'
import { userCoverStyle } from '@vitnode/core/views/profile/images/cover-style'
import { cn } from 'cn'
import {
  ArrowRightIcon,
  ChevronRightIcon,
  RotateCwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react'

import type { Presence, Profile, Variant } from './shared'

import { LastVisited, useElapsed } from './ambient-header'
import {
  NameLink,
  PendingLabel,
  PresenceAvatar,
  ProfileError,
  SignedReputation,
  useCard,
} from './shared'

const FADE =
  'linear-gradient(to bottom, black 0%, rgb(0 0 0 / 0.85) 30%, rgb(0 0 0 / 0.45) 60%, rgb(0 0 0 / 0.12) 85%, transparent 100%)'

const Header = ({ presence, user }: { presence: Presence; user: Profile }) => (
  <div className="relative isolate flex flex-col gap-3 px-4 pt-14 pb-4">
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
    <div className="flex min-w-0 flex-col gap-0.5">
      <NameLink
        className="text-foreground truncate text-base font-semibold"
        name={user.name}
        nameCode={user.nameCode}
      />
      <p className="text-muted-foreground truncate text-sm">@{user.nameCode}</p>
      <RoleFormat className="text-sm" role={user.role} />
    </div>
  </div>
)

const Stat = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-3">
    <dd className="text-foreground max-w-full truncate text-base font-semibold tabular-nums">
      {children}
    </dd>
    <dt className="text-muted-foreground text-sm">{label}</dt>
  </div>
)

const WarningsSkeleton = () => (
  <div className="border-t px-4 py-3">
    <Skeleton className="h-14 rounded-lg" />
  </div>
)

/** Only rendered for moderators; the API answers 403 to everyone else anyway. */
const ModeratorWarnings = ({ userId }: { userId: number }) => {
  const query = useQuery(memberStandingQueryOptions(userId))

  if (query.isPending) return <WarningsSkeleton />
  if (query.isError) {
    // A moderator without the warnings permission: nothing to show, nothing to retry.
    if (
      query.error instanceof ModcpRequestError &&
      query.error.status === 403
    ) {
      return null
    }

    return (
      <div className="border-t px-4 py-3">
        <div
          className="text-muted-foreground flex items-center justify-between gap-3 text-sm"
          role="alert"
        >
          <span>Warnings didn't load.</span>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            size="xs"
            variant="ghost"
          >
            <RotateCwIcon aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const { activePoints, hiddenWarnings, warnings } = query.data
  const active = warnings.filter(
    (warning) => warning.status === 'active',
  ).length
  const total = warnings.length + hiddenWarnings
  const flagged = activePoints > 0
  const reviewHref = ['/modcp/warnings?user=', userId].join('')

  return (
    <section
      aria-label="Warnings, visible to moderators"
      className="border-t px-4 py-3"
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5',
          flagged ? 'bg-warn/10 dark:bg-warn/15' : 'bg-muted/60',
        )}
      >
        {flagged ? (
          <TriangleAlertIcon
            aria-hidden="true"
            className={cn('size-5 shrink-0', FEEDBACK_TONE_TEXT.warning)}
          />
        ) : (
          <ShieldCheckIcon
            aria-hidden="true"
            className="text-muted-foreground size-5 shrink-0"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-foreground text-sm font-medium">
            {flagged
              ? `${activePoints} warning ${activePoints === 1 ? 'point' : 'points'}`
              : 'No active warnings'}
          </p>
          <p className="text-muted-foreground text-sm">
            {total === 0
              ? 'Clean record'
              : `${active} active · ${total} in total`}
          </p>
        </div>
        {total > 0 ? (
          <Link
            className="text-foreground focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-0.5 rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
            to={reviewHref}
          >
            Review
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </section>
  )
}

const RefinedSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <div className="flex flex-col gap-3 px-4 pt-14 pb-4">
      <PendingLabel />
      <Skeleton className="size-14 rounded-full" />
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-4 w-1/3" />
    </div>
    <div className="grid grid-cols-3 gap-3 border-t px-4 py-3">
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
    <div className="border-t p-4">
      <Skeleton className="h-8" />
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const session = useSessionQuery()
  const elapsed = useElapsed()

  if (query.isPending) return <RefinedSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data
  const isModerator = session.data?.user?.isModerator === true

  return (
    <div className="flex flex-col">
      <Header presence={presence} user={user} />

      <dl className="grid grid-cols-3 divide-x border-t">
        <Stat label="Reputation">
          <SignedReputation value={user.reputation ?? 0} />
        </Stat>
        <Stat label="Joined">{elapsed(user.createdAt)}</Stat>
        <Stat label="Last visited">
          <LastVisited presence={presence} />
        </Stat>
      </dl>

      {isModerator ? <ModeratorWarnings userId={user.id} /> : null}

      <div className="border-t p-4">
        <Link
          className={cn(buttonVariants({ size: 'sm' }), 'w-full')}
          to={userProfileHref(user.nameCode)}
        >
          View profile
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

export const refined: Variant = {
  name: 'Refined',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
