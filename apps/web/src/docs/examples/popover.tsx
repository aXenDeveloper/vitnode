import { Button } from '@vitnode/core/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@vitnode/core/components/ui/popover'

export default function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Open</Button>} />
      <PopoverContent>Place content for the popover here.</PopoverContent>
    </Popover>
  )
}
