import type { VitNodeConfig } from "@/vitnode.config";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import { getAdminNav } from "../sidebar/nav/get-admin-nav";
import { BreadcrumbAdmin } from "./breadcrumb-admin";
import { resolveBreadcrumb } from "./resolve-breadcrumb";

/**
 * Breadcrumb for the user detail page (`/admin/core/users/<id>`). Resolves the
 * real user name server-side so the last crumb shows the name instead of the
 * raw url segment - the data-resolution showcase of the parallel-routes pattern.
 *
 * Takes `params` as the promise the slot was handed rather than the resolved
 * id: awaiting it above the slot's `<Suspense>` would pull the URL back into
 * the AdminCP's shared App Shell.
 */
export const BreadcrumbUserAdmin = async ({
  params,
  vitNodeConfig,
}: {
  params: Promise<{ id: string }>;
  /** Defaults to the registered app config when omitted. */
  vitNodeConfig?: VitNodeConfig;
}) => {
  const [{ id }, nav] = await Promise.all([
    params,
    getAdminNav({ vitNodeConfig }),
  ]);
  const segments = ["core", "users", id];

  // Static sibling routes (e.g. `/users/roles`) also match this dynamic slot —
  // only look up a user when the segment isn't already a known nav route.
  const isKnownRoute =
    resolveBreadcrumb(nav, segments).at(-1)?.isKnown ?? false;

  let overrideLastLabel: string | undefined;
  if (!isKnownRoute) {
    const res = await fetcher(adminModule, {
      path: "/{id}",
      method: "get",
      module: "admin/users",
      args: {
        params: { id },
      },
    });

    if (res.ok) {
      overrideLastLabel = (await res.json()).name;
    }
  }

  return (
    <BreadcrumbAdmin
      nav={nav}
      overrideLastLabel={overrideLastLabel}
      segments={segments}
      vitNodeConfig={vitNodeConfig}
    />
  );
};
