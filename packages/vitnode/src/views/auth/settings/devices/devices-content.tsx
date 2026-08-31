"use client";

import { useTranslations } from "use-intl";

import type { Device } from "./devices-query";
import type { RevokeDevice } from "./devices-revoke";

import { DeviceItem } from "./device-item";

/**
 * The visitor's devices, as a list both frameworks render.
 *
 * The presentation half of `/settings/devices`, and the whole of it: the cards,
 * the spacing between them, and the sentence that stands in for an empty list.
 *
 *     Next.js         devices-list.tsx              fetch + notFound + server action
 *     TanStack Start  routes/.../settings/devices   loader + useSuspenseQuery + browser revoke
 *                                    \       /
 *                               DevicesContent
 *
 * ## What it does not own
 *
 * **Fetching.** It is handed a list. Which list, and how it was fetched, is
 * `devices-query.ts`'s - the same definition a TanStack loader warms and a
 * Next.js Server Component awaits. That is also why an API failure never reaches
 * here: it is a rejected query, not an empty array, so this component's "no
 * devices" state means only that the API said so.
 *
 * **Revoking.** One callback, because the two frameworks genuinely differ: one
 * ends in `revalidatePath`, the other in a query invalidation, and neither can
 * exist in the other's runtime. The request, the status mapping and the rule
 * about the current device are shared - see `devices-revoke.ts`.
 *
 * **The heading.** Deliberately outside, in each framework's own page. The
 * Next.js page renders `HeaderContent` above a `<Suspense>` whose fallback is
 * `DevicesListSkeleton`, so the title is on screen while the list is still
 * streaming; folding the heading in here would put it behind the same boundary
 * and lose that.
 */
export const DevicesContent = ({
  devices,
  onRevoke,
}: {
  devices: Device[];
  onRevoke: RevokeDevice;
}) => {
  const t = useTranslations("core.auth.settings.devices");

  if (devices.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {devices.map(device => (
        <DeviceItem device={device} key={device.publicId} onRevoke={onRevoke} />
      ))}
    </div>
  );
};
