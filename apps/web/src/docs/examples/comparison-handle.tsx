import {
  Comparison,
  ComparisonHandle,
  ComparisonItem,
} from '@vitnode/core/components/ui/comparison'
import { ChevronsLeftRightIcon } from 'lucide-react'

import adminDashboardDark from '@/site/home/assets/admin-dashboard-dark-800.webp'
import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'

export default function ComparisonCustomHandle() {
  return (
    <Comparison
      aria-label="Light and dark theme"
      className="not-prose aspect-video w-full rounded-lg border"
      defaultPosition={70}
    >
      <ComparisonItem position="left">
        <img alt="" draggable={false} src={adminDashboardLight} />
      </ComparisonItem>
      <ComparisonItem position="right">
        <img alt="" draggable={false} src={adminDashboardDark} />
      </ComparisonItem>
      <ComparisonHandle>
        <div className="bg-primary absolute inset-y-0 w-0.5" />
        <div className="bg-primary text-primary-foreground relative flex size-8 items-center justify-center rounded-full shadow-md">
          <ChevronsLeftRightIcon className="size-4" />
        </div>
      </ComparisonHandle>
    </Comparison>
  )
}
