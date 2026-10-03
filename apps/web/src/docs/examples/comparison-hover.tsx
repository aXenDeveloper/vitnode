import {
  Comparison,
  ComparisonHandle,
  ComparisonItem,
} from '@vitnode/core/components/ui/comparison'
import React from 'react'

import adminDashboardDark from '@/site/home/assets/admin-dashboard-dark-800.webp'
import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'

export default function ComparisonHover() {
  const [position, setPosition] = React.useState(30)

  return (
    <figure className="not-prose flex w-full flex-col gap-2">
      <Comparison
        aria-label="Light and dark theme"
        className="aspect-video rounded-lg border"
        defaultPosition={30}
        mode="hover"
        onPositionChange={setPosition}
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
        Move the pointer across.{' '}
        <span className="text-foreground font-medium tabular-nums">
          {Math.round(position)}%
        </span>{' '}
        light
      </figcaption>
    </figure>
  )
}
