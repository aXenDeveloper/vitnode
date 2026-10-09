import { SETTINGS_ROW, SettingsGroup } from '@vitnode/core/views/auth/settings/settings-group'
import { cn } from 'cn'
import { InfinityIcon } from 'lucide-react'

import { formatDay, formatPoints, type ProtoUsage, runsToday, usedFeatures } from './data'
import { DetailsLink } from './shared'

const Stat = ({ hint, label, value }: { hint: string; label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1 px-4 py-3">
    <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
    <dd className="flex flex-col gap-0.5">
      <span className="text-xl leading-tight font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground truncate text-xs">{hint}</span>
    </dd>
  </div>
)

export const Stats = ({ usage }: { usage: ProtoUsage }) => {
  const features = usedFeatures(usage)
  const top = features[0]
  const today = runsToday(usage)
  const activeToday = usage.features.filter(feature => feature.usedToday > 0).length

  return (
    <SettingsGroup title="AI points">
      <li>
        <dl className="grid grid-cols-2 sm:grid-cols-3 [&>*:not(:first-child)]:border-s max-sm:[&>*:nth-child(3)]:col-span-2 max-sm:[&>*:nth-child(3)]:border-s-0 max-sm:[&>*:nth-child(3)]:border-t">
          <Stat
            hint="No monthly cap"
            label="Allowance"
            value={
              <span className="flex items-center gap-1.5">
                <InfinityIcon aria-hidden className="text-primary size-5" />
                Unlimited
              </span>
            }
          />
          <Stat hint={`Since ${formatDay(usage.periodStart)}`} label="Used this month" value={`${formatPoints(usage.used)} pts`} />
          <Stat
            hint={today === 0 ? 'Nothing yet today' : `Across ${activeToday} ${activeToday === 1 ? 'feature' : 'features'}`}
            label="Runs today"
            value={today}
          />
        </dl>
      </li>
      <li className={cn(SETTINGS_ROW, 'flex-wrap justify-between gap-y-1')}>
        <span className="text-muted-foreground min-w-0 truncate text-sm">
          {top ? (
            <>
              Most used: <span className="text-foreground font-medium">{top.title}</span>
            </>
          ) : (
            'No features used this month'
          )}
        </span>
        <DetailsLink />
      </li>
    </SettingsGroup>
  )
}
