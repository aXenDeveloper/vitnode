import { Badge } from '@vitnode/core/components/ui/badge'
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@vitnode/core/components/ui/frame'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
} from '@vitnode/core/components/ui/item'
import {
  AtSignIcon,
  GlobeIcon,
  type LucideIcon,
  MailIcon,
  PhoneIcon,
} from 'lucide-react'

const Fact = ({
  badge,
  icon: Icon,
  label,
  value,
}: {
  badge?: React.ReactNode
  icon: LucideIcon
  label: string
  value: string
}) => (
  <Item render={<li />}>
    <ItemMedia aria-hidden variant="tile">
      <Icon />
    </ItemMedia>
    <ItemContent className="min-w-0 gap-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium wrap-anywhere">{value}</span>
    </ItemContent>
    {badge ? <ItemActions>{badge}</ItemActions> : null}
  </Item>
)

export default function FrameGridExample() {
  return (
    <div className="not-prose grid w-full gap-4 md:grid-cols-2">
      <Frame>
        <FrameHeader>
          <FrameTitle render={<h3 />}>Personal information</FrameTitle>
        </FrameHeader>
        <FramePanel render={<ul />}>
          <Fact icon={PhoneIcon} label="Phone" value="+48 600 700 800" />
          <Fact
            badge={<Badge variant="outline">Auto</Badge>}
            icon={GlobeIcon}
            label="Time zone"
            value="Europe/Warsaw"
          />
        </FramePanel>
      </Frame>
      <Frame>
        <FrameHeader>
          <FrameTitle render={<h3 />}>Account</FrameTitle>
        </FrameHeader>
        <FramePanel render={<ul />}>
          <Fact icon={AtSignIcon} label="Nickname" value="ada" />
          <Fact
            badge={<Badge variant="success">Verified</Badge>}
            icon={MailIcon}
            label="Email address"
            value="ada@example.com"
          />
        </FramePanel>
      </Frame>
    </div>
  )
}
