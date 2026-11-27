import type { LucideIcon } from 'lucide-react'

import { Switch } from '@vitnode/core/components/ui/switch'
import {
  ClipboardCheck,
  ImageIcon,
  Languages,
  Settings,
  WandSparkles,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

import { Fit } from '@/site/home/illustrations/bento/scene'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

const ACTIONS: readonly { Icon: LucideIcon; key: string }[] = [
  { Icon: ImageIcon, key: 'alt' },
  { Icon: Languages, key: 'translate' },
  { Icon: WandSparkles, key: 'rewrite' },
  { Icon: ClipboardCheck, key: 'review' },
]

const DURATIONS = [900, 750, 750, 750, 3400] as const
const BUDGET_BASE = 28
const BUDGET_PER_ACTION = 6

export const AiActionsScene = () => {
  const t = useTranslations('site.home.bento.ai')
  const { ref, step } = useLoopStep(DURATIONS)
  const percent = BUDGET_BASE + step * BUDGET_PER_ACTION

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={232} width={340}>
        <span className="bg-card absolute inset-x-2 top-1.5 flex flex-col overflow-hidden rounded-xl border shadow-lg">
          {ACTIONS.map(({ Icon, key }, index) => (
            <span
              className="flex h-11 items-center gap-2.5 border-b px-3"
              key={key}
            >
              <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-md">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {t(`actions.${key}`)}
              </span>
              <Switch
                checked={step >= index + 1}
                readOnly
                size="sm"
                tabIndex={-1}
              />
              <Settings
                aria-hidden
                className="text-muted-foreground size-3.5 shrink-0"
              />
            </span>
          ))}
          <span className="bg-muted/40 text-muted-foreground flex h-10 items-center gap-3 px-3 text-xs">
            <span className="bg-muted block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
              <span
                className="bg-primary block h-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `scaleX(${percent / 100})` }}
              />
            </span>
            <span className="shrink-0 tabular-nums">
              {t('budget', { percent })}
            </span>
          </span>
        </span>
      </Fit>
    </div>
  )
}
