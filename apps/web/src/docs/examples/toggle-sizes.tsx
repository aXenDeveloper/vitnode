import { Toggle } from '@vitnode/core/components/ui/toggle'
import { BoldIcon } from 'lucide-react'

const SIZES = ['sm', 'default', 'lg'] as const

export default function ToggleSizes() {
  return (
    <div className="not-prose flex flex-wrap items-end justify-center gap-6">
      {SIZES.map((size) => (
        <div className="flex flex-col items-center gap-2" key={size}>
          <Toggle aria-label="Bold" size={size} variant="outline">
            <BoldIcon />
          </Toggle>
          <code className="text-muted-foreground font-mono text-xs">
            {size}
          </code>
        </div>
      ))}
    </div>
  )
}
