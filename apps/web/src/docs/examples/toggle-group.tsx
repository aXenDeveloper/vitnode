import {
  ToggleGroup,
  ToggleGroupItem,
} from '@vitnode/core/components/ui/toggle-group'
import { BoldIcon, ItalicIcon, UnderlineIcon } from 'lucide-react'

export default function ToggleGroupDemo() {
  return (
    <ToggleGroup
      aria-label="Text formatting"
      className="not-prose"
      multiple
      variant="outline"
    >
      <ToggleGroupItem aria-label="Bold" value="bold">
        <BoldIcon />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Italic" value="italic">
        <ItalicIcon />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Underline" value="underline">
        <UnderlineIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
