import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vitnode/core/components/ui/avatar'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@vitnode/core/components/ui/item'
import { Plus } from 'lucide-react'
import { Fragment } from 'react'

const people = [
  { initials: 'VN', name: 'VitNode Bot', email: 'bot@vitnode.com', logo: true },
  { initials: 'AL', name: 'Ada Lovelace', email: 'ada@example.com' },
  { initials: 'GH', name: 'Grace Hopper', email: 'grace@example.com' },
]

export default function ItemGroupExample() {
  return (
    <div className="not-prose flex w-full max-w-md flex-col">
      <ItemGroup aria-label="Team members">
        {people.map((person, index) => (
          <Fragment key={person.email}>
            {index > 0 && <ItemSeparator />}
            <Item role="listitem">
              <ItemMedia>
                <Avatar>
                  {person.logo && (
                    <AvatarImage alt="" src="/logo_vitnode_icon.svg" />
                  )}
                  <AvatarFallback>{person.initials}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{person.name}</ItemTitle>
                <ItemDescription>{person.email}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  aria-label={`Invite ${person.name}`}
                  size="icon-sm"
                  variant="outline"
                >
                  <Plus />
                </Button>
              </ItemActions>
            </Item>
          </Fragment>
        ))}
      </ItemGroup>
    </div>
  )
}
