import { AiActionIcon } from '@vitnode/core/components/ai/action-icon'
import { Badge } from '@vitnode/core/components/ui/badge'
import { SETTINGS_ROW, SettingsGroup } from '@vitnode/core/views/auth/settings/settings-group'
import { cn } from 'cn'

import { formatPoints, type ProtoUsage } from './data'
import { DetailsLink, InfinityTile } from './shared'

export const DailyLimits = ({ usage }: { usage: ProtoUsage }) => {
  const limited = usage.features.filter(feature => feature.dailyLimit !== null)
  const open = usage.features.length - limited.length

  return (
    <SettingsGroup title="AI points">
      <li className={cn(SETTINGS_ROW, 'items-start')}>
        <InfinityTile />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">No monthly cap on your points</span>
          <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
            Only daily limits can pause a feature. They reset at midnight.
          </span>
        </div>
      </li>
      {limited.map(feature => {
        const limit = feature.dailyLimit ?? 0
        const isFull = feature.usedToday >= limit
        const share = Math.min(feature.usedToday / limit, 1)

        return (
          <li className={SETTINGS_ROW} key={feature.key}>
            <AiActionIcon enabled={!isFull} icon={feature.icon} />
            <span className="min-w-0 flex-1 truncate text-sm">{feature.title}</span>
            {isFull ? (
              <Badge variant="destructive">Limit reached</Badge>
            ) : (
              <span className="flex shrink-0 items-center gap-3">
                <span
                  aria-hidden
                  className="bg-muted hidden h-1.5 w-20 overflow-hidden rounded-full sm:block"
                >
                  <span
                    className={cn('block h-full rounded-full', share >= 0.8 ? 'bg-warn' : 'bg-primary')}
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
                <span className="text-muted-foreground min-w-24 text-end text-sm whitespace-nowrap tabular-nums">
                  {feature.usedToday} / {limit} today
                </span>
              </span>
            )}
          </li>
        )
      })}
      <li className={cn(SETTINGS_ROW, 'flex-wrap justify-between gap-y-1')}>
        <span className="text-muted-foreground text-sm tabular-nums">
          {open > 0 ? `${open} more ${open === 1 ? 'feature has' : 'features have'} no daily limit · ` : ''}
          {formatPoints(usage.used)} pts used this month
        </span>
        <DetailsLink>All features</DetailsLink>
      </li>
    </SettingsGroup>
  )
}
