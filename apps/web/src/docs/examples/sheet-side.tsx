import { Button } from '@vitnode/core/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@vitnode/core/components/ui/sheet'

const sides = ['top', 'right', 'bottom', 'left'] as const

export default function SheetSideDemo() {
  return (
    <div className="not-prose grid grid-cols-2 gap-3">
      {sides.map((side) => (
        <Sheet key={side}>
          <SheetTrigger
            render={
              <Button className="capitalize" variant="outline">
                {side}
              </Button>
            }
          />
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle className="capitalize">{side} sheet</SheetTitle>
              <SheetDescription>
                Slid in from the {side} edge, and it leaves the same way.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  )
}
