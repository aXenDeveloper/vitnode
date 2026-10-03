import { Toggle } from '@vitnode/core/components/ui/toggle'
import { PinIcon } from 'lucide-react'

export default function ToggleOutline() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-4">
      <Toggle aria-label="Pin topic" defaultPressed>
        <PinIcon />
      </Toggle>
      <Toggle aria-label="Pin topic" defaultPressed variant="outline">
        <PinIcon />
      </Toggle>
    </div>
  )
}
