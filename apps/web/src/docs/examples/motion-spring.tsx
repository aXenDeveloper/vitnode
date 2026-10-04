import { MotionFeatures } from '@vitnode/core/components/motion-features'
import { Button } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { ArrowLeftRightIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import React from 'react'

const SPRINGS = [
  { bounce: 0, label: 'bounce: 0', use: 'Taps, toggles, menus' },
  { bounce: 0.3, label: 'bounce: 0.3', use: 'Only after a fling' },
] as const

export default function MotionSpring() {
  const [isOn, setIsOn] = React.useState(false)
  const shouldReduceMotion = useReducedMotion()

  return (
    <MotionFeatures withLayoutAndDrag>
      <div className="not-prose flex w-full flex-col gap-5">
        <ul className="flex list-none flex-col gap-4 p-0">
          {SPRINGS.map((spring) => (
            <li className="flex flex-col gap-2 p-0" key={spring.label}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <code className="font-mono font-medium">{spring.label}</code>
                <span className="text-muted-foreground">{spring.use}</span>
              </div>
              <div
                aria-hidden
                className={cn(
                  'bg-muted flex rounded-full p-1',
                  isOn ? 'justify-end' : 'justify-start',
                )}
              >
                <m.span
                  className="bg-primary block h-6 w-12 rounded-full shadow-sm"
                  layout
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', duration: 0.3, bounce: spring.bounce }
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        <Button
          aria-pressed={isOn}
          className="self-start"
          onClick={() => setIsOn((value) => !value)}
          size="sm"
          variant="outline"
        >
          <ArrowLeftRightIcon />
          Flip
        </Button>
      </div>
    </MotionFeatures>
  )
}
