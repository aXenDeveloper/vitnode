import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@vitnode/core/components/ui/resizable'

export default function ResizableVerticalDemo() {
  return (
    <div className="not-prose h-64 w-full max-w-md">
      <ResizablePanelGroup
        className="bg-background text-foreground rounded-lg border"
        orientation="vertical"
      >
        <ResizablePanel defaultSize="30%" minSize="20%">
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm font-medium">Header</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize="30%">
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm font-medium">Content</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
