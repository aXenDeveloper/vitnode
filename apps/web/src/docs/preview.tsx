import { Loader } from '@vitnode/core/components/ui/loader'
import { cn } from '@vitnode/core/lib/utils'
import React from 'react'

const exampleModules = import.meta.glob<{
  default: React.ComponentType
}>('./examples/*.tsx', { eager: false })

const examples: Record<string, React.ComponentType> = Object.fromEntries(
  Object.entries(exampleModules).map(([path, load]) => [
    path.slice('./examples/'.length, -'.tsx'.length),
    React.lazy(load),
  ]),
)

export const Preview = ({
  className,
  name,
  withoutBackground,
}: {
  className?: string
  name: string
  withoutBackground?: boolean
}) => {
  const Example = examples[name]

  // A document naming an example that does not exist renders nothing rather
  // than throwing: a broken demo must not take the page it illustrates with it.
  if (!Example) return null

  if (withoutBackground) {
    return (
      <div className="[&_p]:m-0 [&_table]:my-0 [&_table]:rounded-md [&_table]:border-none [&_table]:bg-transparent">
        <React.Suspense fallback={<Loader />} key={name}>
          <Example />
        </React.Suspense>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'from-fd-primary/1 bg-card/50 flex min-h-112.5 items-center justify-center rounded-xl border bg-linear-to-br p-6 *:max-w-120 [&_p]:m-0',
        className,
      )}
    >
      <React.Suspense fallback={<Loader />} key={name}>
        <Example />
      </React.Suspense>
    </div>
  )
}
