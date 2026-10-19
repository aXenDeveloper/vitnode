import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@vitnode/core/components/ui/dialog'

export const ImplementationPromptPreviewDialog = ({
  onOpenChange,
  open,
  prompt,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  prompt: string
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Implementation prompt</DialogTitle>
        <DialogDescription className="leading-relaxed text-pretty">
          Paste it into your coding agent. The agent reads this guide, looks
          through your project and asks you a few questions before it changes
          anything.
        </DialogDescription>
      </DialogHeader>

      <pre
        aria-label="Prompt text"
        className="bg-muted text-foreground focus-visible:ring-ring/50 max-h-96 overflow-y-auto rounded-lg border p-4 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap outline-none focus-visible:ring-3"
        // A scrollable region must be reachable by keyboard.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {prompt}
      </pre>

      <DialogFooter showCloseButton>
        <CopyButton content={prompt} variant="default">
          Copy prompt
        </CopyButton>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
