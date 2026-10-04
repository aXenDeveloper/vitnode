import { Badge } from '@vitnode/core/components/ui/badge'
import { ArrowUpRight, BadgeCheck, Clock } from 'lucide-react'

export default function BadgeIconExample() {
  return (
    <div className="not-prose flex flex-wrap justify-center gap-2">
      <Badge variant="success">
        <BadgeCheck data-icon="inline-start" />
        Verified
      </Badge>
      <Badge variant="warning">
        <Clock data-icon="inline-start" />
        Scheduled
      </Badge>
      <Badge variant="outline">
        Changelog
        <ArrowUpRight data-icon="inline-end" />
      </Badge>
    </div>
  )
}
