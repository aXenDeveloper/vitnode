import { Button } from '@vitnode/core/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@vitnode/core/components/ui/dropdown-menu'
import { SlidersHorizontalIcon } from 'lucide-react'
import React from 'react'

export default function DropdownMenuCheckboxesExample() {
  const [showPinned, setShowPinned] = React.useState(true)
  const [showSolved, setShowSolved] = React.useState(false)
  const [sort, setSort] = React.useState('latest')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline">
            <SlidersHorizontalIcon />
            View
          </Button>
        }
      />
      <DropdownMenuContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>Show</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={showPinned}
            onCheckedChange={setShowPinned}
          >
            Pinned threads
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={showSolved}
            onCheckedChange={setShowSolved}
          >
            Solved threads
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup onValueChange={setSort} value={sort}>
            <DropdownMenuRadioItem value="latest">
              Latest activity
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="top">
              Most replies
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
