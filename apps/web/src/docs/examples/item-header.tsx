import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemHeader,
  ItemTitle,
} from '@vitnode/core/components/ui/item'

export default function ItemHeaderExample() {
  return (
    <div className="not-prose flex w-full max-w-md flex-col">
      <Item variant="outline">
        <ItemHeader>
          <Badge variant="success">Active</Badge>
          <span className="text-muted-foreground text-xs">Updated 2h ago</span>
        </ItemHeader>
        <ItemContent>
          <ItemTitle>Weekly newsletter</ItemTitle>
          <ItemDescription>
            Sent every Monday to 1,204 subscribers. Nobody has unsubscribed this
            week, which we choose to take personally.
          </ItemDescription>
        </ItemContent>
        <ItemFooter>
          <span className="text-muted-foreground text-xs">
            Next send: Monday
          </span>
          <Button size="sm" variant="outline">
            Edit
          </Button>
        </ItemFooter>
      </Item>
    </div>
  )
}
