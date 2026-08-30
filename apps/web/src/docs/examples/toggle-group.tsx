'use client'

import {
  ToggleGroup,
  ToggleGroupItem,
} from '@vitnode/core/components/ui/toggle-group'
import { Bold, Italic, Underline } from 'lucide-react'

export default function ToggleGroupDemo() {
  return (
    <ToggleGroup multiple variant="outline">
      <ToggleGroupItem aria-label="Toggle bold" value="bold">
        <Bold className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Toggle italic" value="italic">
        <Italic className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Toggle strikethrough" value="strikethrough">
        <Underline className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
