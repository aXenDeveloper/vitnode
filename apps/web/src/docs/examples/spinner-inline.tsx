import { Badge } from '@vitnode/core/components/ui/badge'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@vitnode/core/components/ui/input-group'
import { Spinner } from '@vitnode/core/components/ui/spinner'
import { SearchIcon } from 'lucide-react'

export default function SpinnerInlineExample() {
  return (
    <div className="not-prose flex w-full flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-2">
        <Badge variant="secondary">
          <Spinner aria-hidden="true" />
          Syncing
        </Badge>
        <Badge variant="outline">
          <Spinner aria-hidden="true" />
          Building
        </Badge>
      </div>
      <InputGroup className="max-w-xs">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput aria-label="Search" defaultValue="vitnode" />
        <InputGroupAddon align="inline-end">
          <Spinner aria-label="Searching" />
        </InputGroupAddon>
      </InputGroup>
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner aria-hidden="true" />
        Generating your report - hang tight.
      </p>
    </div>
  )
}
