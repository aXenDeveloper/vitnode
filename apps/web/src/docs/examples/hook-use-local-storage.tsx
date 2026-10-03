import { Button } from '@vitnode/core/components/ui/button'
import { Input } from '@vitnode/core/components/ui/input'
import { Label } from '@vitnode/core/components/ui/label'
import { Switch } from '@vitnode/core/components/ui/switch'
import { useLocalStorage } from '@vitnode/core/hooks/use-local-storage'
import React from 'react'

export default function HookUseLocalStorageDemo() {
  const id = React.useId()
  const [signature, setSignature, resetSignature] = useLocalStorage(
    'vitnode-docs-signature',
    '',
  )
  const [isCompact, setIsCompact] = useLocalStorage(
    'vitnode-docs-compact',
    false,
  )

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Forum signature</Label>
        <Input
          id={id}
          onChange={(event) => setSignature(event.target.value)}
          placeholder="Keep calm and clear the cache"
          value={signature}
        />
      </div>
      <Label>
        <Switch checked={isCompact} onCheckedChange={setIsCompact} />
        Compact thread view
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          Reload the page, or open it in a second tab.
        </p>
        <Button
          onClick={() => {
            resetSignature()
            setIsCompact(false)
          }}
          size="sm"
          variant="outline"
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
