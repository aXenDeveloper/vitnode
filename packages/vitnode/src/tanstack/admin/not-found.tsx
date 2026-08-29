"use client";

import { useTranslations } from "use-intl";

import { ErrorContent } from "@/views/error/error-content";

/**
 * The AdminCP's 404 - the answer a screen this administrator may not open gets,
 * which {@link requireAdminPermission} produces with `notFound()`.
 *
 * ## Mount it inside the shell, not beside it
 *
 * The host puts this in the `notFoundComponent` of the route that guards the
 * AdminCP, and that route has to render its shell around it *here as well*. A
 * `notFoundComponent` renders instead of the component of the route that
 * handles the error, so the shell that route mounts is exactly what is missing
 * by the time this renders - and a refusal with no sidebar, no header and no
 * palette leaves an administrator on a dead page with the browser's back button
 * for a way out. The Next.js AdminCP keeps the panel: its `not-found.tsx` sits
 * under `admin/(auth)/layout.tsx`. `apps/web/src/routes/_admin.tsx` shows the
 * two lines that match it.
 *
 * This component deliberately does not mount the shell itself. It is the
 * message, and the shell needs a link component and a user lookup that only a
 * host can supply.
 *
 * `core.global` carries the two strings below. Both the host's root and the
 * shell provide it, so this renders correctly either way.
 *
 * `actions` is a slot for the same reason `ErrorContent` takes one: "go back"
 * and "go home" are navigation, and during the migration only the host knows
 * which application serves `/`.
 */
export const AdminNotFound = ({ actions }: { actions?: React.ReactNode }) => {
  const t = useTranslations("core.global");

  return (
    <ErrorContent
      actions={actions}
      code={404}
      description={t("errors.404.desc")}
      title={t("errors.404.title")}
    />
  );
};
