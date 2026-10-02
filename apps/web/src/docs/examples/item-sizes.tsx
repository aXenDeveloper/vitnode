import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@vitnode/core/components/ui/item'
import { Inbox } from 'lucide-react'

const sizes = [
  { size: 'default', title: 'Default size' },
  { size: 'sm', title: 'Small size' },
  { size: 'xs', title: 'Extra small size' },
] as const

export default function ItemSizesExample() {
  return (
    <div className="not-prose flex w-full max-w-md flex-col gap-4">
      {sizes.map((item) => (
        <Item key={item.size} size={item.size} variant="outline">
          <ItemMedia variant="icon">
            <Inbox />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{item.title}</ItemTitle>
            <ItemDescription>3 unread messages are waiting.</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </div>
  )
}
