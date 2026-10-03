import { ColorPresetPicker } from '@vitnode/core/components/ui/color-preset-picker'
import React from 'react'

export default function ColorPresetsExample() {
  const [color, setColor] = React.useState('hsl(215, 81%, 52%)')

  return (
    <div className="not-prose flex flex-col items-center gap-4">
      <ColorPresetPicker onChange={setColor} value={color} />
      <p className="bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <span
          aria-hidden="true"
          className="border-input bg-foreground size-4 rounded-sm border"
          style={color ? { backgroundColor: color } : undefined}
        />
        <code className="font-mono">{color || '"" (default)'}</code>
      </p>
    </div>
  )
}
