import { Button } from '@vitnode/core/components/ui/button'
import { CheckIcon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import React from 'react'

const TAGS = [
  'react',
  'hono',
  'drizzle',
  'tailwind',
  'postgres',
  'vite',
  'tanstack',
  'zod',
  'redis',
  'motion',
]

const INITIAL_COUNT = 6

const Tag = ({ label }: { label: string }) => (
  <li className="bg-muted text-foreground ring-primary/40 rounded-md px-2 py-1 font-mono text-xs ring-1">
    {label}
  </li>
)

const Column = ({
  className,
  good,
  label,
  tags,
}: {
  className: string
  good: boolean
  label: string
  tags: string[]
}) => (
  <figure className="bg-card flex min-w-0 flex-col gap-3 rounded-lg border p-3">
    <figcaption className="flex items-center justify-between gap-2">
      <code className="font-mono text-xs">{label}</code>
      <span
        className={`flex items-center gap-1 text-xs font-medium ${good ? 'text-success' : 'text-destructive'}`}
      >
        {good ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <XIcon className="size-3.5" />
        )}
        {good ? 'Do' : "Don't"}
      </span>
    </figcaption>
    <ul className={`flex flex-wrap ${className}`}>
      {tags.map((tag) => (
        <Tag key={tag} label={tag} />
      ))}
    </ul>
  </figure>
)

export default function SpacingGapVsSpace() {
  const [count, setCount] = React.useState(INITIAL_COUNT)
  const tags = TAGS.slice(0, count)
  const isFull = count === TAGS.length

  return (
    <div className="not-prose flex w-full flex-col items-start gap-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Column className="gap-2" good label="flex-wrap gap-2" tags={tags} />
        <Column
          className="space-x-2"
          good={false}
          label="flex-wrap space-x-2"
          tags={tags}
        />
      </div>
      <Button
        onClick={() => setCount(isFull ? INITIAL_COUNT : count + 2)}
        size="sm"
        variant="outline"
      >
        {isFull ? <RotateCcwIcon /> : <PlusIcon />}
        {isFull ? 'Reset' : 'Add tags'}
      </Button>
    </div>
  )
}
