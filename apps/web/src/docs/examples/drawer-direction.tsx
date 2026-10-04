import { Button } from '@vitnode/core/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@vitnode/core/components/ui/drawer'
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
} from 'lucide-react'

const directions = [
  { direction: 'top', icon: ArrowUpIcon, swipe: 'up' },
  { direction: 'right', icon: ArrowRightIcon, swipe: 'right' },
  { direction: 'bottom', icon: ArrowDownIcon, swipe: 'down' },
  { direction: 'left', icon: ArrowLeftIcon, swipe: 'left' },
] as const

export default function DrawerDirectionExample() {
  return (
    <div className="not-prose grid grid-cols-2 gap-3">
      {directions.map(({ direction, icon: Icon, swipe }) => (
        <Drawer direction={direction} key={direction}>
          <DrawerTrigger asChild>
            <Button className="capitalize" variant="outline">
              {direction}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="capitalize">
                {direction} drawer
              </DrawerTitle>
              <DrawerDescription>
                Grab it and fling it {swipe} to close. A slow nudge springs it
                back.
              </DrawerDescription>
            </DrawerHeader>
            <div className="text-muted-foreground flex flex-1 items-center justify-center p-8">
              <Icon aria-hidden className="size-8" />
            </div>
          </DrawerContent>
        </Drawer>
      ))}
    </div>
  )
}
