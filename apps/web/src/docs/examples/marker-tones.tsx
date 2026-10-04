import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from '@vitnode/core/components/ui/marker'
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  MessageSquare,
} from 'lucide-react'

const tones = [
  {
    tone: 'neutral',
    icon: MessageSquare,
    text: '12 new replies since you left',
  },
  { tone: 'info', icon: Info, text: 'Replies are sorted by votes' },
  { tone: 'success', icon: CircleCheck, text: 'Backup finished in 42s' },
  { tone: 'warning', icon: CircleAlert, text: 'License expires in 3 days' },
  { tone: 'destructive', icon: CircleX, text: 'Email delivery failed' },
] as const

export default function MarkerTonesExample() {
  return (
    <div className="not-prose flex w-full flex-col gap-4">
      {tones.map(({ tone, icon: Icon, text }) => (
        <Marker key={tone} tone={tone}>
          <MarkerIcon>
            <Icon />
          </MarkerIcon>
          <MarkerContent>{text}</MarkerContent>
        </Marker>
      ))}
    </div>
  )
}
