import { Button } from '@vitnode/core/components/ui/button'
import { Spinner } from '@vitnode/core/components/ui/spinner'
import React from 'react'

export default function SpinnerButtonsExample() {
  const [isSaving, setIsSaving] = React.useState(false)

  return (
    <div className="not-prose flex flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-3">
        <Button disabled>
          <Spinner aria-hidden="true" />
          Uploading...
        </Button>
        <Button disabled variant="outline">
          <Spinner aria-hidden="true" />
          Please wait
        </Button>
        <Button aria-label="Refreshing" disabled size="icon" variant="ghost">
          <Spinner aria-hidden="true" />
        </Button>
      </div>
      <Button
        isLoading={isSaving}
        onClick={() => {
          setIsSaving(true)
          setTimeout(() => {
            setIsSaving(false)
          }, 1500)
        }}
      >
        Save changes
      </Button>
    </div>
  )
}
