import { Button } from '@vitnode/core/components/ui/button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from '@vitnode/core/components/ui/button-group'
import { Card } from '@vitnode/core/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@vitnode/core/components/ui/dropdown-menu'
import { Input } from '@vitnode/core/components/ui/input'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Archive,
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Clock,
  Flag,
  Minus,
  Plus,
  Search,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import React from 'react'

const QuantityStepper = () => {
  const [quantity, setQuantity] = React.useState(1)

  return (
    <ButtonGroup aria-label="Quantity">
      <Button
        aria-label="Decrease quantity"
        disabled={quantity <= 1}
        onClick={() => setQuantity((value) => value - 1)}
        size="icon"
        variant="outline"
      >
        <Minus />
      </Button>
      <ButtonGroupText
        aria-live="polite"
        className="bg-card min-w-12 justify-center tabular-nums"
      >
        {quantity}
      </ButtonGroupText>
      <Button
        aria-label="Increase quantity"
        disabled={quantity >= 9}
        onClick={() => setQuantity((value) => value + 1)}
        size="icon"
        variant="outline"
      >
        <Plus />
      </Button>
    </ButtonGroup>
  )
}

export default function ButtonGroupExample() {
  return (
    <Card className="flex w-full flex-col items-center gap-6 p-6 md:p-8">
      <ButtonGroup
        aria-label="Message actions"
        className="flex-wrap justify-center"
      >
        <ButtonGroup>
          <Button aria-label="Go back" size="icon" variant="outline">
            <ArrowLeft />
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="outline">
            <Archive data-icon="inline-start" />
            Archive
          </Button>
          <Button aria-label="Report" size="icon" variant="outline">
            <Flag />
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="outline">
            <Clock data-icon="inline-start" />
            Snooze
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="More snooze options"
                  size="icon"
                  variant="outline"
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Clock />
                  Later today
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CalendarClock />
                  Next week
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </ButtonGroup>

      <ButtonGroup aria-label="Search members" className="w-full max-w-sm">
        <Input aria-label="Search members" placeholder="Search members..." />
        <Button aria-label="Search" size="icon" variant="outline">
          <Search />
        </Button>
      </ButtonGroup>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <ButtonGroup aria-label="Text alignment">
          <Button aria-label="Align left" size="icon" variant="secondary">
            <AlignLeft />
          </Button>
          <ButtonGroupSeparator />
          <Button aria-label="Align center" size="icon" variant="secondary">
            <AlignCenter />
          </Button>
          <ButtonGroupSeparator />
          <Button aria-label="Align right" size="icon" variant="secondary">
            <AlignRight />
          </Button>
        </ButtonGroup>

        <QuantityStepper />

        <ButtonGroup aria-label="Zoom" orientation="vertical">
          <Button aria-label="Zoom in" size="icon-sm" variant="outline">
            <ZoomIn />
          </Button>
          <Button aria-label="Zoom out" size="icon-sm" variant="outline">
            <ZoomOut />
          </Button>
        </ButtonGroup>
      </div>
    </Card>
  )
}
