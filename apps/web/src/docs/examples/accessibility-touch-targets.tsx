import { Button } from '@vitnode/core/components/ui/button'
import { Checkbox } from '@vitnode/core/components/ui/checkbox'
import { Label } from '@vitnode/core/components/ui/label'
import { Switch } from '@vitnode/core/components/ui/switch'
import { cn } from 'cn'
import { Trash2Icon } from 'lucide-react'
import React from 'react'

const HIT_AREA_OUTLINE =
  'after:rounded-md after:border-2 after:border-dashed after:border-primary after:bg-primary/10'

const COARSE_HIT_AREA_PREVIEW =
  'after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2'

const formatSize = (width: number, height: number) =>
  `${Math.round(width)} × ${Math.round(height)}`

const measure = (wrapper: HTMLElement) => {
  const control = wrapper.querySelector<HTMLElement>('[data-slot]')
  if (!control) return null

  const box = control.getBoundingClientRect()
  const hitArea = getComputedStyle(control, '::after')
  const hitWidth = Number.parseFloat(hitArea.width)
  const hitHeight = Number.parseFloat(hitArea.height)
  const hasHitArea =
    hitArea.position === 'absolute' &&
    Number.isFinite(hitWidth) &&
    Number.isFinite(hitHeight)

  return {
    hit: hasHitArea
      ? formatSize(hitWidth, hitHeight)
      : formatSize(box.width, box.height),
    visible: formatSize(box.width, box.height),
  }
}

const Target = ({
  children,
  isShowing,
  name,
  note,
}: {
  children: React.ReactNode
  isShowing: boolean
  name: string
  note: string
}) => {
  const [sizes, setSizes] = React.useState<null | {
    hit: string
    visible: string
  }>(null)

  const wrapperRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node && isShowing) setSizes(measure(node))
    },
    [isShowing],
  )

  return (
    <li className="bg-card flex flex-col items-center gap-3 rounded-lg border p-4 text-center">
      <div className="flex h-16 items-center justify-center" ref={wrapperRef}>
        {children}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {isShowing && sizes
            ? `${sizes.visible} → ${sizes.hit} px`
            : 'hit area hidden'}
        </span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          {note}
        </span>
      </div>
    </li>
  )
}

export default function AccessibilityTouchTargets() {
  const id = React.useId()
  const [isShowing, setIsShowing] = React.useState(true)
  const outline = isShowing ? HIT_AREA_OUTLINE : undefined

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Switch
          checked={isShowing}
          id={`${id}-show`}
          onCheckedChange={setIsShowing}
        />
        <Label htmlFor={`${id}-show`}>Show hit areas</Label>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Target isShowing={isShowing} name="Checkbox" note="Always on.">
          <Checkbox aria-label="Accept terms" className={outline} />
        </Target>
        <Target isShowing={isShowing} name="Switch" note="Always on.">
          <Switch aria-label="Enable alerts" className={outline} />
        </Target>
        <Target
          isShowing={isShowing}
          name="Icon button"
          note="Touch screens only."
        >
          <Button
            aria-label="Delete post"
            className={cn(isShowing && [COARSE_HIT_AREA_PREVIEW, outline])}
            size="icon-xs"
            variant="outline"
          >
            <Trash2Icon />
          </Button>
        </Target>
      </ul>
    </div>
  )
}
