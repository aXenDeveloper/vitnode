import { Button } from '@vitnode/core/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@vitnode/core/components/ui/popover'

const sides = ['top', 'right', 'bottom', 'left'] as const

export default function PopoverSideDemo() {
  return (
    <div className="not-prose grid grid-cols-2 gap-3">
      {sides.map((side) => (
        <Popover key={side}>
          <PopoverTrigger
            render={
              <Button className="capitalize" variant="outline">
                {side}
              </Button>
            }
          />
          <PopoverContent className="w-56" side={side}>
            <PopoverHeader>
              <PopoverTitle className="capitalize">{side}</PopoverTitle>
              <PopoverDescription>
                No room on this side? It flips to the other one.
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  )
}
