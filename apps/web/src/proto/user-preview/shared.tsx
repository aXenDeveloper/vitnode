// Prototype - throwaway. Deleted after a direction is picked.
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'
import { FEEDBACK_TONE_TEXT } from '@vitnode/core/components/ui/feedback-tone'
import { ShortNumber } from '@vitnode/core/components/ui/short-number'
import { userProfileHref } from '@vitnode/core/components/user-profile-href'
import {
  isProfileNotFound,
  userProfileQueryOptions,
} from '@vitnode/core/tanstack/profile'
import { userPresenceQueryOptions } from '@vitnode/core/views/presence/presence-query'
import { cn } from 'cn'
import { IdCardIcon, RotateCwIcon, UserRoundXIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

export const useProfile = (nameCode: string) =>
  useQuery(userProfileQueryOptions({ nameCode }))

export const usePresence = (userId: number) =>
  useQuery({
    ...userPresenceQueryOptions({ userId, viewerId: null }),
    enabled: userId > 0,
  }).data

export const useJoined = (createdAt: Date | string, year = false) => {
  const format = useFormatter()

  return format.dateTime(
    new Date(createdAt),
    year ? { year: 'numeric' } : { month: 'short', year: 'numeric' },
  )
}

export const NameLink = ({
  className,
  name,
  nameCode,
}: {
  className?: string
  name: string
  nameCode: string
}) => (
  <Link
    className={cn(
      'focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3',
      className,
    )}
    to={userProfileHref(nameCode)}
  >
    {name}
  </Link>
)

export const SignedReputation = ({
  className,
  value,
}: {
  className?: string
  value: number
}) => (
  <ShortNumber
    className={cn(
      'tabular-nums',
      value > 0 && FEEDBACK_TONE_TEXT.success,
      value < 0 && FEEDBACK_TONE_TEXT.destructive,
      className,
    )}
    formatOptions={{ signDisplay: 'exceptZero' }}
    value={value}
  />
)

export const ProfileError = ({
  query,
}: {
  query: ReturnType<typeof useProfile>
}) => {
  const t = useTranslations('core.profile')
  const notFound = isProfileNotFound(query.error)

  return (
    <Empty className="p-6" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {notFound ? (
            <UserRoundXIcon aria-hidden="true" />
          ) : (
            <IdCardIcon aria-hidden="true" />
          )}
        </EmptyMedia>
        <EmptyTitle>
          {notFound ? t('notFound.title') : t('preview.load_error.title')}
        </EmptyTitle>
        <EmptyDescription>
          {notFound ? t('notFound.desc') : t('preview.load_error.desc')}
        </EmptyDescription>
      </EmptyHeader>
      {notFound ? null : (
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t('preview.retry')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

export const PendingLabel = () => {
  const t = useTranslations('core.global')

  return (
    <span className="sr-only" role="status">
      {t('loading')}
    </span>
  )
}

export interface Variant {
  Content: (props: { nameCode: string }) => React.ReactNode
  contentClassName: string
  name: string
}
