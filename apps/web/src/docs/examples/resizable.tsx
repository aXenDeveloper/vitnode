import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@vitnode/core/components/ui/resizable'

export default function ResizableDemo() {
  return (
    <div className="not-prose h-80 w-full max-w-md">
      <ResizablePanelGroup className="bg-background text-foreground rounded-lg border">
        <ResizablePanel defaultSize="35%" minSize="20%">
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm font-medium">Sidebar</span>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize="30%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="60%" minSize="25%">
              <div className="flex h-full items-center justify-center p-4">
                <span className="text-sm font-medium">Content</span>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel minSize="20%">
              <div className="bg-muted/50 flex h-full items-center justify-center p-4">
                <span className="text-muted-foreground text-sm font-medium">
                  Terminal
                </span>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
