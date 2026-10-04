import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@vitnode/core/components/ui/alert'
import { Button } from '@vitnode/core/components/ui/button'
import { CheckIcon, SaveIcon, TrashIcon } from 'lucide-react'
import React from 'react'

const timeNow = () =>
  new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

export default function AccessibilityAnnouncements() {
  const [status, setStatus] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)

  React.useEffect(() => {
    if (!isSaving) return
    const timeout = window.setTimeout(() => {
      setIsSaving(false)
      setStatus(`Draft saved at ${timeNow()}`)
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [isSaving])

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          isLoading={isSaving}
          onClick={() => {
            setHasError(false)
            setIsSaving(true)
          }}
          variant="outline"
        >
          <SaveIcon />
          Save draft
        </Button>
        <Button
          onClick={() => {
            setStatus('')
            setHasError(true)
          }}
          variant="destructive"
        >
          <TrashIcon />
          Delete post
        </Button>
      </div>

      <div className="bg-card flex min-h-12 flex-col justify-center gap-1 rounded-lg border p-3">
        <span className="text-muted-foreground text-xs font-medium">
          role=&quot;status&quot; · polite
        </span>
        <p
          className="flex items-center gap-2 text-sm leading-relaxed"
          role="status"
        >
          {status && (
            <>
              <CheckIcon aria-hidden className="text-success size-4" />
              {status}
            </>
          )}
        </p>
        {!status && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Waiting for news…
          </p>
        )}
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t delete the post</AlertTitle>
          <AlertDescription>
            You&apos;re offline. We&apos;ll keep it right where it is.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
