import { IconPicker } from '@vitnode/core/components/ui/icon-picker'
import React from 'react'

export default function EmojiIconPickerPanelsExample() {
  const [icon, setIcon] = React.useState('message-circle')

  return (
    <div className="not-prose bg-popover text-popover-foreground flex w-full max-w-76 flex-col overflow-hidden rounded-xl border">
      <IconPicker height={224} onSelect={setIcon} value={icon} />
      <p className="text-muted-foreground border-t px-3 py-2 text-xs">
        Picked: <code>{icon}</code>
      </p>
    </div>
  )
}
