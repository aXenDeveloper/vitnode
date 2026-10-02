import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@vitnode/core/components/ui/item'
import { BookOpen, ChevronRight, ExternalLink } from 'lucide-react'

export default function ItemLinkExample() {
  return (
    <div className="not-prose flex w-full max-w-md flex-col gap-4">
      <Item
        render={
          <a href="/docs/ui/avatar">
            <ItemMedia variant="icon">
              <BookOpen />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Read the Avatar docs</ItemTitle>
              <ItemDescription>
                The whole row is one link, hover state included.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight aria-hidden className="size-4" />
            </ItemActions>
          </a>
        }
      />

      <Item
        render={
          <a
            href="https://ui.shadcn.com/docs/components/base/item"
            rel="noreferrer"
            target="_blank"
          >
            <ItemContent>
              <ItemTitle>Inspired by shadcn/ui</ItemTitle>
              <ItemDescription>
                Opens in a new tab, so this page stays right here.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ExternalLink aria-hidden className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </ItemActions>
          </a>
        }
        variant="outline"
      />
    </div>
  )
}
