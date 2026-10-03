import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@vitnode/core/components/ui/resizable'
import React from 'react'

const ITEMS = ['Posts', 'Members', 'Files', 'Events', 'Polls', 'Badges']

const useGridMetrics = () => {
  const [metrics, setMetrics] = React.useState({ columns: 1, width: 0 })

  const gridRef = React.useCallback((node: HTMLUListElement | null) => {
    if (!node) return

    const update = () => {
      const columns = getComputedStyle(node)
        .gridTemplateColumns.split(' ')
        .filter(Boolean).length
      setMetrics({
        columns,
        width: Math.round(node.getBoundingClientRect().width),
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    update()

    return () => observer.disconnect()
  }, [])

  return { gridRef, metrics }
}

export default function SpacingResponsive() {
  const { gridRef, metrics } = useGridMetrics()

  return (
    <div className="not-prose flex w-full flex-col gap-3">
      <ResizablePanelGroup className="bg-background text-foreground rounded-lg border">
        <ResizablePanel defaultSize="75%" minSize="35%">
          <div className="@container flex flex-col gap-3 p-3">
            <p
              aria-live="polite"
              className="text-muted-foreground font-mono text-xs tabular-nums"
            >
              {metrics.width}px ·{' '}
              <span className="text-foreground">
                {metrics.columns} {metrics.columns === 1 ? 'column' : 'columns'}
              </span>
            </p>
            <ul
              className="grid grid-cols-1 gap-2 @3xs:grid-cols-2 @md:grid-cols-3"
              ref={gridRef}
            >
              {ITEMS.map((item) => (
                <li
                  className="bg-card text-card-foreground flex h-10 items-center rounded-md border px-3 text-sm"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize="8%">
          <div className="bg-muted/50 text-muted-foreground flex h-full items-center justify-center p-3 text-center text-xs">
            Drag me
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <p className="text-muted-foreground font-mono text-xs leading-relaxed">
        grid-cols-1 @3xs:grid-cols-2 @md:grid-cols-3
      </p>
    </div>
  )
}
