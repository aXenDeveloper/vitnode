import { Button } from '@vitnode/core/components/ui/button'
import { Kbd, KbdGroup } from '@vitnode/core/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@vitnode/core/components/ui/tooltip'
import { SaveIcon } from 'lucide-react'

const sides = ['top', 'right', 'bottom', 'left'] as const

export default function TooltipSideDemo() {
  return (
    <div className="not-prose flex flex-col items-center gap-6">
      <div className="grid grid-cols-2 gap-3">
        {sides.map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger
              render={
                <Button className="capitalize" variant="outline">
                  {side}
                </Button>
              }
            />
            <TooltipContent side={side}>Shown on the {side}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button aria-label="Save draft" size="icon" variant="outline">
              <SaveIcon />
            </Button>
          }
        />
        <TooltipContent>
          Save draft
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>S</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
