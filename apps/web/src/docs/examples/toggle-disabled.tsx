import { Toggle } from '@vitnode/core/components/ui/toggle'
import { LockIcon } from 'lucide-react'

export default function ToggleDisabled() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Toggle disabled variant="outline">
        <LockIcon data-icon="inline-start" />
        Lock topic
      </Toggle>
      <Toggle defaultPressed disabled variant="outline">
        <LockIcon data-icon="inline-start" />
        Locked
      </Toggle>
    </div>
  )
}
