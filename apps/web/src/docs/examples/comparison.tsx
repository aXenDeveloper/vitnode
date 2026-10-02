import {
  Comparison,
  ComparisonHandle,
  ComparisonItem,
} from '@vitnode/core/components/ui/comparison'

import adminDashboardDark from '@/site/home/assets/admin-dashboard-dark-800.webp'
import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'

export default function ComparisonExample() {
  return (
    <figure className="not-prose flex w-full flex-col gap-2">
      <Comparison
        aria-label="Light and dark theme"
        className="aspect-video rounded-lg border"
      >
        <ComparisonItem position="left">
          <img alt="" draggable={false} src={adminDashboardLight} />
        </ComparisonItem>
        <ComparisonItem position="right">
          <img alt="" draggable={false} src={adminDashboardDark} />
        </ComparisonItem>
        <ComparisonHandle />
      </Comparison>
      <figcaption className="text-muted-foreground text-center text-sm leading-relaxed">
        Drag the handle - or focus it and use the arrow keys - to compare the
        light and dark themes.
      </figcaption>
    </figure>
  )
}
