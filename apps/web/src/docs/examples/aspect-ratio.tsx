import { AspectRatio } from '@vitnode/core/components/ui/aspect-ratio'

import adminDashboardDark from '@/site/home/assets/admin-dashboard-dark-800.webp'
import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'

export default function AspectRatioExample() {
  return (
    <figure className="flex w-full flex-col gap-2">
      <AspectRatio
        className="bg-muted overflow-hidden rounded-lg border"
        ratio={16 / 9}
      >
        <img
          alt="VitNode AdminCP dashboard"
          className="size-full object-cover object-top dark:hidden"
          decoding="async"
          loading="lazy"
          src={adminDashboardLight}
        />
        <img
          alt="VitNode AdminCP dashboard"
          className="hidden size-full object-cover object-top dark:block"
          decoding="async"
          loading="lazy"
          src={adminDashboardDark}
        />
      </AspectRatio>
      <figcaption className="text-muted-foreground text-center text-sm leading-relaxed">
        Always 16:9, however wide the screen gets.
      </figcaption>
    </figure>
  )
}
