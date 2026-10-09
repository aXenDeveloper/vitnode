import { SETTINGS_ROW, SettingsGroup } from '@vitnode/core/views/auth/settings/settings-group'
import { cn } from 'cn'

import { formatDay, formatPoints, type ProtoUsage, usedFeatures } from './data'
import { DetailsLink, InfinityTile } from './shared'

const SEGMENT_TONES = ['bg-primary', 'bg-primary/65', 'bg-primary/40', 'bg-primary/20']
const MAX_SEGMENTS = 3

const percent = new Intl.NumberFormat('en', { maximumFractionDigits: 0, style: 'percent' })

export const Breakdown = ({ usage }: { usage: ProtoUsage }) => {
  const features = usedFeatures(usage)
  const top = features.slice(0, MAX_SEGMENTS)
  const rest = features.slice(MAX_SEGMENTS)
  const segments = [
    ...top.map(feature => ({ key: feature.key, label: feature.title, points: feature.monthPoints })),
    ...(rest.length > 0
      ? [
          {
            key: 'other',
            label: `${rest.length} other ${rest.length === 1 ? 'feature' : 'features'}`,
            points: rest.reduce((sum, feature) => sum + feature.monthPoints, 0),
          },
        ]
      : []),
  ]

  return (
    <SettingsGroup title="AI points">
      <li className={cn(SETTINGS_ROW, 'items-start')}>
        <InfinityTile />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">Unlimited points</span>
          <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
            No monthly cap. Your usage count starts over on {formatDay(usage.resetsAt)}.
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-lg leading-none font-semibold tabular-nums">{formatPoints(usage.used)}</span>
          <span className="text-muted-foreground text-xs">pts this month</span>
        </div>
      </li>
      <li className={cn(SETTINGS_ROW, 'flex-col items-stretch gap-3')}>
        {segments.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            Nothing used since {formatDay(usage.periodStart)}. Once you run an AI feature, you'll see where your points go.
          </p>
        ) : (
          <>
            <div
              aria-hidden
              className="bg-muted flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
            >
              {segments.map((segment, index) => (
                <span
                  className={cn('h-full min-w-1', SEGMENT_TONES[index])}
                  key={segment.key}
                  style={{ flexGrow: segment.points }}
                />
              ))}
            </div>
            <ul aria-label="Where your points went this month" className="flex flex-col gap-2">
              {segments.map((segment, index) => (
                <li className="flex items-center gap-3 text-sm" key={segment.key}>
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', SEGMENT_TONES[index])} />
                  <span className="min-w-0 flex-1 truncate">{segment.label}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">{formatPoints(segment.points)} pts</span>
                  <span className="w-10 shrink-0 text-end font-medium tabular-nums">
                    {percent.format(segment.points / usage.used)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </li>
      <li className={SETTINGS_ROW}>
        <DetailsLink />
      </li>
    </SettingsGroup>
  )
}
