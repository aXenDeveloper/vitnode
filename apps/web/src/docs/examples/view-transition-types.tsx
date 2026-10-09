import { Button } from '@vitnode/core/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import React, {
  addTransitionType,
  startTransition,
  ViewTransition,
} from 'react'

const STEPS = [
  { body: 'Pick a name and a language.', title: 'Create your community' },
  { body: 'Turn on the plugins you need.', title: 'Add plugins' },
  { body: 'Invite people and start talking.', title: 'Go live' },
] as const

export default function ViewTransitionTypes() {
  const [index, setIndex] = React.useState(0)
  const step = STEPS[index] ?? STEPS[0]

  const go = (direction: 'back' | 'forward') => {
    startTransition(() => {
      addTransitionType(direction)
      setIndex((current) => current + (direction === 'forward' ? 1 : -1))
    })
  }

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <div className="bg-card text-card-foreground rounded-xl border p-6 shadow-xs">
        <ViewTransition
          default="none"
          enter={{
            back: 'vt-from-left',
            default: 'none',
            forward: 'vt-from-right',
          }}
          exit={{
            back: 'vt-to-right',
            default: 'none',
            forward: 'vt-to-left',
          }}
          key={index}
        >
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Step {index + 1} of {STEPS.length}
            </span>
            <h3 className="text-lg font-semibold text-balance">{step.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {step.body}
            </p>
          </div>
        </ViewTransition>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          disabled={index === 0}
          onClick={() => {
            go('back')
          }}
          variant="outline"
        >
          <ChevronLeftIcon aria-hidden />
          Back
        </Button>
        <Button
          disabled={index === STEPS.length - 1}
          onClick={() => {
            go('forward')
          }}
        >
          Next
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
    </div>
  )
}
