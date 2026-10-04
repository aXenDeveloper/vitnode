import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@vitnode/core/components/ui/resizable'

export default function ResizableHandleDemo() {
  return (
    <div className="not-prose h-48 w-full max-w-md">
      <ResizablePanelGroup className="bg-background text-foreground rounded-lg border">
        <ResizablePanel defaultSize="40%" minSize="20%">
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm font-medium">Sidebar</span>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize="30%">
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm font-medium">Content</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
