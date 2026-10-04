import { Button } from '@vitnode/core/components/ui/button'
import {
  TooltipGroup,
  TooltipGroupTrigger,
} from '@vitnode/core/components/ui/tooltip'
import {
  BoldIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  UnderlineIcon,
} from 'lucide-react'

const tools = [
  { icon: BoldIcon, label: 'Bold' },
  { icon: ItalicIcon, label: 'Italic' },
  { icon: UnderlineIcon, label: 'Underline' },
  { icon: LinkIcon, label: 'Insert link' },
  { icon: ImageIcon, label: 'Add an image from your files' },
]

export default function TooltipGroupExample() {
  return (
    <TooltipGroup>
      <div
        aria-label="Formatting"
        className="bg-card flex items-center gap-1 rounded-lg border p-1 shadow-xs"
        role="toolbar"
      >
        {tools.map(({ icon: Icon, label }) => (
          <TooltipGroupTrigger
            content={label}
            key={label}
            render={
              <Button aria-label={label} size="icon-sm" variant="ghost" />
            }
          >
            <Icon />
          </TooltipGroupTrigger>
        ))}
      </div>
    </TooltipGroup>
  )
}
