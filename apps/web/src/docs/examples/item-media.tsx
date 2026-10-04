import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vitnode/core/components/ui/avatar'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@vitnode/core/components/ui/item'
import { Bell } from 'lucide-react'

export default function ItemMediaExample() {
  return (
    <ItemGroup
      aria-label="Media variants"
      className="not-prose w-full max-w-md"
    >
      <Item role="listitem" variant="outline">
        <ItemMedia>
          <Avatar>
            <AvatarImage alt="" src="/logo_vitnode_icon.svg" />
            <AvatarFallback>VN</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>VitNode Bot</ItemTitle>
          <ItemDescription>default - leaves your avatar alone</ItemDescription>
        </ItemContent>
      </Item>
      <Item role="listitem" variant="outline">
        <ItemMedia variant="icon">
          <Bell />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Mentions</ItemTitle>
          <ItemDescription>icon - sizes a bare SVG</ItemDescription>
        </ItemContent>
      </Item>
      <Item role="listitem" variant="outline">
        <ItemMedia className="bg-muted p-1" variant="image">
          <img alt="" src="/logo_vitnode_icon.svg" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Release notes 2.0</ItemTitle>
          <ItemDescription>image - crops to a rounded square</ItemDescription>
        </ItemContent>
      </Item>
    </ItemGroup>
  )
}
