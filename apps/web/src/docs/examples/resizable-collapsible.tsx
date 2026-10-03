import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@vitnode/core/components/ui/resizable'
import { PanelLeft } from 'lucide-react'

export default function ResizableCollapsibleDemo() {
  return (
    <div className="not-prose h-48 w-full max-w-md">
      <ResizablePanelGroup className="bg-background text-foreground rounded-lg border">
        <ResizablePanel
          collapsedSize="8%"
          collapsible
          defaultSize="35%"
          maxSize="50%"
          minSize="25%"
        >
          <div className="bg-muted/50 @container flex h-full items-center justify-center gap-2 overflow-hidden p-2">
            <PanelLeft aria-hidden className="size-4 shrink-0" />
            <span className="hidden text-sm font-medium @[5rem]:inline">
              Sidebar
            </span>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize="40%">
          <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
            <span className="text-sm font-medium">Content</span>
            <span className="text-muted-foreground text-xs text-pretty">
              Drag the sidebar below 25% and it snaps shut.
            </span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
