"use client";

import { useTranslations } from "use-intl";

import { ErrorContent } from "@/views/error/error-content";

/**
 * A URL this application does not serve.
 *
 * The message, and only the message: a code, the two strings that explain it,
 * and a slot for the way out. What a host mounts it *inside* is the host's -
 * see below, because the two places it is used answer that differently.
 *
 * ## Where it belongs on a route tree
 *
 * On the **root** route, which is what makes it the answer for every URL nothing
 * matched. Without a `notFoundComponent` there (or a router-level
 * `defaultNotFoundComponent`) TanStack Router falls back to its own bare
 * `<p>Not Found</p>` and warns about it on every such navigation - which is what
 * a hand-typed `/blog/post-30`, `/admin/contents` or any other unrouted path
 * used to get.
 *
 * A nested route declares its own only when the answer differs in kind rather
 * than in wording. `AdminNotFound` is the one that does: it renders this same
 * message, but the route that mounts it has to put the AdminCP shell back
 * around it, because a `notFoundComponent` renders *instead of* its route's
 * component and the panel would otherwise disappear.
 *
 * ## Why the strings are read here and the buttons are not
 *
 * `core.global` carries `errors.404.title` and `errors.404.desc`, and every
 * VitNode host provides it above every route - `VitNodeRootProviders` mounts
 * `RouteMessages` with exactly that namespace - so this can translate itself
 * wherever it is mounted.
 *
 * `actions` cannot work the same way. "Go back" and "go home" are navigation,
 * and during the strangler migration `/` is served by the Next.js application on
 * some installs and by this one on others - a fact only the host's route tree
 * knows. So it is a slot, filled with `ErrorActions` bound to whatever link
 * component that host uses. The same split `ErrorContent` itself makes, one
 * layer down.
 */
export const NotFound = ({ actions }: { actions?: React.ReactNode }) => {
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
