import type { Metadata } from "next/dist/types";

import { LayoutSettings } from "@vitnode/core/views/auth/settings/layout";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// instant = false: kept on purpose. Every route under this layout is gated on a
// signed-in user in `LayoutSettings`, which calls `notFound()` when there isn't
// one. Moving that read inside `<Suspense>` would turn a real 404 into a 200
// shell that later swaps to a not-found body, so the gate stays where it is and
// the segment is allowed to block.
export const instant = false;

export default function Layout(
  props: React.ComponentProps<typeof LayoutSettings>,
) {
  return <LayoutSettings {...props} />;
}
