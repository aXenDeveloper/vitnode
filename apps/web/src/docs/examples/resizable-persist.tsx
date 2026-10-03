import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@vitnode/core/components/ui/resizable'
import React from 'react'

type Layout = Record<string, number>

const storageKey = 'vitnode-docs-resizable-layout'

const subscribe = () => () => {}

const readLayout = (): null | string => {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

const saveLayout = (layout: Layout) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout))
  } catch {
    return
  }
}

const parseLayout = (value: null | string): Layout | undefined => {
  if (!value) return undefined

  try {
    const parsed: unknown = JSON.parse(value)

    if (typeof parsed !== 'object' || parsed === null) return undefined

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
      ),
    )
  } catch {
    return undefined
  }
}

export default function ResizablePersistDemo() {
  const storedLayout = React.useSyncExternalStore(
    subscribe,
    readLayout,
    () => null,
  )
  const defaultLayout = React.useMemo(
    () => parseLayout(storedLayout),
    [storedLayout],
  )

  return (
    <div className="not-prose h-48 w-full max-w-md">
      <ResizablePanelGroup
        className="bg-background text-foreground rounded-lg border"
        defaultLayout={defaultLayout}
        id="docs-resizable-persist"
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction) saveLayout(meta.requestedLayout ?? layout)
        }}
      >
        <ResizablePanel defaultSize="40%" id="sidebar" minSize="20%">
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm font-medium">Sidebar</span>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="content" minSize="30%">
          <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
            <span className="text-sm font-medium">Content</span>
            <span className="text-muted-foreground text-xs text-pretty">
              Resize, then reload. It remembers.
            </span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
