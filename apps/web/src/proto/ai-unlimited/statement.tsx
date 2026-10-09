import { SETTINGS_INTERACTIVE_ROW, SettingsGroup } from '@vitnode/core/views/auth/settings/settings-group'
import { cn } from 'cn'
import { ChevronRightIcon } from 'lucide-react'

import { formatDay, formatPoints, type ProtoUsage, usedFeatures } from './data'
import { InfinityTile } from './shared'

const sentenceFor = (usage: ProtoUsage) => {
  const features = usedFeatures(usage)
  const top = features[0]
  if (!top) {
    return `You haven't used an AI feature since ${formatDay(usage.periodStart)}. Go wild — nothing here runs out.`
  }

  const across = features.length === 1 ? '1 feature' : `${features.length} features`
  const mostly = features.length > 1 ? `, mostly on ${top.title}` : ''

  return `You've spent ${formatPoints(usage.used)} points on ${across} since ${formatDay(usage.periodStart)}${mostly}.`
}

export const Statement = ({ usage }: { usage: ProtoUsage }) => (
  <SettingsGroup title="AI points">
    <li>
      <a className={cn(SETTINGS_INTERACTIVE_ROW, 'items-start gap-4 py-4')} href="/settings/ai">
        <InfinityTile className="size-12 rounded-lg [&>svg]:size-6" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium text-balance">Your AI points never run out</span>
          <span className="text-muted-foreground text-sm leading-relaxed text-pretty">{sentenceFor(usage)}</span>
          <span className="text-primary pt-1 text-sm font-medium">See your AI features</span>
        </span>
        <ChevronRightIcon aria-hidden className="text-muted-foreground mt-3 size-5 shrink-0 rtl:-scale-x-100" />
      </a>
    </li>
  </SettingsGroup>
)
