import { Button } from '@vitnode/core/components/ui/button'
import { SlidingNumber } from '@vitnode/core/components/ui/sliding-number'
import React from 'react'

export default function SlidingNumberExample() {
  const [downloads, setDownloads] = React.useState(1287)

  return (
    <div className="not-prose flex flex-col items-center gap-4">
      <p className="text-muted-foreground text-sm">Downloads this week</p>
      <SlidingNumber className="text-5xl font-semibold" value={downloads} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            setDownloads((current) => current + 1)
          }}
          variant="outline"
        >
          +1
        </Button>
        <Button
          onClick={() => {
            setDownloads((current) => current + 125)
          }}
          variant="outline"
        >
          +125
        </Button>
        <Button
          onClick={() => {
            setDownloads(9)
          }}
          variant="ghost"
        >
          Reset to 9
        </Button>
      </div>
    </div>
  )
}
