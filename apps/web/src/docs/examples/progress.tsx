import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@vitnode/core/components/ui/progress'
import React from 'react'

export default function ProgressDemo() {
  const [progress, setProgress] = React.useState(13)

  React.useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="not-prose flex w-full max-w-sm flex-col gap-6">
      <Progress value={progress}>
        <ProgressLabel>Uploading photos</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={null}>
        <ProgressLabel>Preparing export</ProgressLabel>
      </Progress>
    </div>
  )
}
