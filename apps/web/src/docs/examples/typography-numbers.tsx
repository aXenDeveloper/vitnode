import { Button } from '@vitnode/core/components/ui/button'
import { PauseIcon, PlayIcon } from 'lucide-react'
import React from 'react'

const randomCount = () => 1000 + Math.floor(Math.random() * 9000)

const Counter = ({
  className,
  label,
  value,
}: {
  className: string
  label: string
  value: number
}) => (
  <figure className="bg-card flex flex-col items-start gap-1 rounded-lg border p-4">
    <figcaption className="text-muted-foreground font-mono text-xs">
      {label}
    </figcaption>
    <span className={`text-4xl font-semibold ${className}`}>
      {value.toLocaleString('en-US')}
    </span>
    <span className="text-muted-foreground text-xs">members online</span>
  </figure>
)

export default function TypographyNumbers() {
  const [value, setValue] = React.useState(4821)
  const [isRunning, setIsRunning] = React.useState(true)

  React.useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setValue(randomCount()), 400)

    return () => window.clearInterval(id)
  }, [isRunning])

  return (
    <div className="not-prose flex w-full flex-col items-start gap-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Counter className="proportional-nums" label="default" value={value} />
        <Counter className="tabular-nums" label="tabular-nums" value={value} />
      </div>
      <Button
        onClick={() => setIsRunning((running) => !running)}
        size="sm"
        variant="outline"
      >
        {isRunning ? <PauseIcon /> : <PlayIcon />}
        {isRunning ? 'Pause' : 'Play'}
      </Button>
    </div>
  )
}
