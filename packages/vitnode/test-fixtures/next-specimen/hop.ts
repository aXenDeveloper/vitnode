/** The second hop: everything the scanners forbid, one edge from the entry. */
import "server-only";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

export const viaHop = async () => {
  // A dynamic import, which a static-only scan would miss entirely - and which
  // is how `next/dynamic` reached a shared module through a confirm dialog.
  const { redirect } = await import("next/navigation");
  const t = await getTranslations("core.global");

  return { cookies, redirect, title: t("previous") };
};
