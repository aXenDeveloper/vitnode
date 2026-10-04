import type { EmojiIconValue } from '@vitnode/core/lib/emoji-icon'

import { EmojiIconPicker } from '@vitnode/core/components/ui/emoji-icon-picker'
import { Label } from '@vitnode/core/components/ui/label'
import { serializeEmojiIcon } from '@vitnode/core/lib/emoji-icon'
import React from 'react'

export default function EmojiIconPickerStandaloneExample() {
  const [value, setValue] = React.useState<EmojiIconValue | undefined>({
    type: 'emoji',
    value: '🚀',
  })

  return (
    <div className="not-prose flex w-full flex-col gap-2">
      <Label htmlFor="emoji-icon-standalone">Category icon</Label>
      <EmojiIconPicker
        allowRemove
        id="emoji-icon-standalone"
        onChange={setValue}
        value={value}
      />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Stored as: <code>{serializeEmojiIcon(value) || 'empty string'}</code>
      </p>
    </div>
  )
}
