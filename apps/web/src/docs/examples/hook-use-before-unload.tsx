import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'
import { Label } from '@vitnode/core/components/ui/label'
import { Textarea } from '@vitnode/core/components/ui/textarea'
import { useBeforeUnload } from '@vitnode/core/hooks/use-before-unload'
import React from 'react'

const SAVED_REPLY = 'Thanks for the report! A fix ships in the next release.'

export default function HookUseBeforeUnloadDemo() {
  const id = React.useId()
  const [reply, setReply] = React.useState(SAVED_REPLY)
  const [savedReply, setSavedReply] = React.useState(SAVED_REPLY)
  const isDirty = reply !== savedReply

  useBeforeUnload(isDirty)

  return (
    <div className="not-prose flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>Your reply</Label>
        <Badge variant={isDirty ? 'warning' : 'success'}>
          {isDirty ? 'Unsaved changes' : 'Saved'}
        </Badge>
      </div>
      <Textarea
        id={id}
        onChange={(event) => setReply(event.target.value)}
        rows={4}
        value={reply}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {isDirty
            ? 'Now try reloading the tab.'
            : 'Edit the reply, then reload the tab.'}
        </p>
        <Button
          disabled={!isDirty}
          onClick={() => setSavedReply(reply)}
          size="sm"
        >
          Save reply
        </Button>
      </div>
    </div>
  )
}
