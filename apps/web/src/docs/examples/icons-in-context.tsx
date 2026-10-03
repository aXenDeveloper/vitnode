import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@vitnode/core/components/ui/input-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@vitnode/core/components/ui/tooltip'
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react'

const Row = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
    <span className="text-muted-foreground shrink-0 font-mono text-xs sm:w-28">
      {label}
    </span>
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {children}
    </div>
  </div>
)

export default function IconsInContext() {
  return (
    <TooltipProvider>
      <div className="not-prose flex w-full flex-col">
        <Row label="leading">
          <Button>
            <PlusIcon data-icon="inline-start" />
            New post
          </Button>
        </Row>
        <Row label="trailing">
          <Button variant="outline">
            Continue
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </Row>
        <Row label="icon only">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button aria-label="Delete post" size="icon" variant="ghost">
                  <Trash2Icon />
                </Button>
              }
            />
            <TooltipContent>Delete post</TooltipContent>
          </Tooltip>
        </Row>
        <Row label="badge">
          <Badge variant="success">
            <BadgeCheckIcon data-icon="inline-start" />
            Verified
          </Badge>
        </Row>
        <Row label="input">
          <InputGroup className="max-w-xs">
            <InputGroupInput
              aria-label="Search members"
              placeholder="Search members..."
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </Row>
      </div>
    </TooltipProvider>
  )
}
