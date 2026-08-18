import type { Metadata } from "next/dist/types";

import { LayoutSettings } from "@/views/auth/settings/layout";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export const instant = false;

export default function Layout(
  props: React.ComponentProps<typeof LayoutSettings>,
) {
  return <LayoutSettings {...props} />;
}
