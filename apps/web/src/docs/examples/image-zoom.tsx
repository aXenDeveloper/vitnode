import { ImageZoom } from '@vitnode/core/components/ui/image-zoom'

import adminDashboardDark from '@/site/home/assets/admin-dashboard-dark-800.webp'
import adminDashboardDarkFull from '@/site/home/assets/admin-dashboard-dark.webp'
import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'
import adminDashboardLightFull from '@/site/home/assets/admin-dashboard-light.webp'

export default function ImageZoomExample() {
  return (
    <figure className="not-prose flex w-full flex-col gap-2">
      <ImageZoom
        alt="The VitNode AdminCP dashboard"
        className="dark:hidden"
        imageClassName="w-full rounded-md border"
        src={adminDashboardLight}
        zoomSrc={adminDashboardLightFull}
      />
      <ImageZoom
        alt="The VitNode AdminCP dashboard"
        className="hidden dark:block"
        imageClassName="w-full rounded-md border"
        src={adminDashboardDark}
        zoomSrc={adminDashboardDarkFull}
      />
      <figcaption className="text-muted-foreground text-center text-sm leading-relaxed">
        Click the screenshot to take a closer look.
      </figcaption>
    </figure>
  )
}
