import { Loader } from '@vitnode/core/components/ui/loader'
import { cn } from '@vitnode/core/lib/utils'
import React from 'react'

/**
 * A live VitNode component, rendered inside the document that describes it.
 *
 * `<Preview name="button" />` in an MDX file renders
 * `src/docs/examples/button.tsx` - 37 documents use it, and it is the reason the
 * UI section of the documentation is worth reading rather than a list of prop
 * tables.
 *
 * ## Why the examples are a glob rather than a template literal
 *
 * The Next.js version called ``dynamic(() => import(`../../examples/${name}.tsx`))``
 * *inside the render*, which meant a new component identity on every render and
 * an `eslint-disable` on both lines to say so. `import.meta.glob` is Vite's own
 * answer: it resolves the whole directory at build time into a record of lazy
 * importers, and every `React.lazy` below is created **once, at module scope**.
 * So switching tabs on a page no longer remounts the demo, and the rule that
 * catches components created during render has nothing to complain about.
 *
 * `React.lazy` does not call its importer until something renders it, so the map
 * costs 37 closures and no chunks. `eager: false` is the default and is stated
 * anyway, because it is the whole point: eagerly globbing this directory would
 * put every example - the editor, the data table, the whole form stack - into
 * the documentation's chunk.
 */
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
