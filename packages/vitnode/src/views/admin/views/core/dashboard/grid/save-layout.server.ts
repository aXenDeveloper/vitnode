"use server";

import { revalidatePath } from "next/cache";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import type { DashboardLayoutItem } from "../widgets/types";

export const saveDashboardLayoutMutation = async ({
  managed,
  widgets,
}: {
  /** Stored ids this board spoke for - see `zodDashboardLayout`. */
  managed: string[];
  widgets: DashboardLayoutItem[];
}) => {
  const res = await fetcher(adminModule, {
    path: "/layout",
    method: "put",
    module: "admin/dashboard",
    args: {
      body: {
        managed,
        widgets: widgets.map(({ id, span, rows }) => ({ id, span, rows })),
      },
    },
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  revalidatePath("/[locale]/admin", "layout");
};
