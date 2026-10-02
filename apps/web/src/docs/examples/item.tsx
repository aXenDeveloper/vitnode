import { Button } from '@vitnode/core/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@vitnode/core/components/ui/item'
import { BadgeCheck, ChevronRight, ShieldCheck } from 'lucide-react'

export default function ItemExample() {
  return (
    <div className="not-prose flex w-full max-w-md flex-col gap-6">
      <Item variant="outline">
        <ItemMedia variant="icon">
          <ShieldCheck />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Two-factor authentication</ItemTitle>
          <ItemDescription>
            Add a second lock to your account. Future you will say thanks.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline">
            Enable
          </Button>
        </ItemActions>
      </Item>

      <Item
        render={
          <a href="#as-a-link">
            <ItemMedia variant="icon">
              <BadgeCheck />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Your email has been verified</ItemTitle>
            </ItemContent>
            <ItemActions>
              <ChevronRight aria-hidden className="size-4" />
            </ItemActions>
          </a>
        }
        size="sm"
        variant="outline"
      />
    </div>
  )
}
