import { Button } from '@vitnode/core/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@vitnode/core/components/ui/item'

const variants = [
  {
    variant: 'default',
    title: 'Default',
    description: 'No border, no background. Blends right into the page.',
  },
  {
    variant: 'outline',
    title: 'Outline',
    description: 'A subtle border for rows that need a little structure.',
  },
  {
    variant: 'muted',
    title: 'Muted',
    description: 'A soft background for secondary or grouped content.',
  },
] as const

export default function ItemVariantsExample() {
  return (
    <div className="not-prose flex w-full max-w-md flex-col gap-4">
      {variants.map((item) => (
        <Item key={item.variant} variant={item.variant}>
          <ItemContent>
            <ItemTitle>{item.title}</ItemTitle>
            <ItemDescription>{item.description}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              Open
            </Button>
          </ItemActions>
        </Item>
      ))}
    </div>
  )
}
