import { Button } from '@vitnode/core/components/ui/button'
import { PlusIcon } from 'lucide-react'

export default function ButtonSizes() {
  return (
    <div className="not-prose flex flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="sm" variant="outline">
          Small
        </Button>
        <Button variant="outline">Default</Button>
        <Button size="lg" variant="outline">
          Large
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button aria-label="New topic" size="icon-xs" variant="outline">
          <PlusIcon />
        </Button>
        <Button aria-label="New topic" size="icon-sm" variant="outline">
          <PlusIcon />
        </Button>
        <Button aria-label="New topic" size="icon" variant="outline">
          <PlusIcon />
        </Button>
        <Button aria-label="New topic" size="icon-lg" variant="outline">
          <PlusIcon />
        </Button>
      </div>
    </div>
  )
}
