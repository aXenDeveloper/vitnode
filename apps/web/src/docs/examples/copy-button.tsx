import { Card } from '@vitnode/core/components/ui/card'
import { CopyButton } from '@vitnode/core/components/ui/copy-button'

const installCommand = 'pnpm create vitnode-app@canary'

export default function CopyButtonExample() {
  return (
    <Card className="flex w-full flex-col items-center gap-6 p-8">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <CopyButton content="Hello from VitNode!" />
        <CopyButton content="Hello from VitNode!" variant="ghost" />
        <CopyButton content="Hello from VitNode!" variant="default" />
        <CopyButton content="Hello from VitNode!" size="icon-sm" />
        <CopyButton content="Hello from VitNode!" variant="secondary">
          Copy text
        </CopyButton>
      </div>

      <div className="not-prose bg-muted flex w-full items-center gap-2 rounded-md border py-1 ps-3 pe-1">
        <code className="text-foreground min-w-0 flex-1 truncate font-mono text-sm">
          {installCommand}
        </code>
        <CopyButton
          aria-label="Copy install command"
          content={installCommand}
          size="icon-sm"
          variant="ghost"
        />
      </div>
    </Card>
  )
}
