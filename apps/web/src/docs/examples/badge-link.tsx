import { Badge } from '@vitnode/core/components/ui/badge'

export default function BadgeLinkExample() {
  return (
    <div className="not-prose flex flex-wrap justify-center gap-2">
      <Badge render={<a href="#variants" />} variant="secondary">
        #announcements
      </Badge>
      <Badge render={<a href="#variants" />} variant="outline">
        #help-wanted
      </Badge>
    </div>
  )
}
