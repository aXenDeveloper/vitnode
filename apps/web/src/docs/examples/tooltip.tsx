import { Button } from '@vitnode/core/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@vitnode/core/components/ui/tooltip'
import { BookmarkIcon } from 'lucide-react'

export default function TooltipDemo() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button aria-label="Bookmark thread" size="icon" variant="outline">
            <BookmarkIcon />
          </Button>
        }
      />
      <TooltipContent>Bookmark thread</TooltipContent>
    </Tooltip>
  )
}
