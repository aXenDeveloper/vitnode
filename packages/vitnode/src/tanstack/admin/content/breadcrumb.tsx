"use client";

import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import type { ContentBreadcrumbModel } from "./breadcrumb-model";
import type { ContentAdminRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";
import { contentBreadcrumbModel } from "./breadcrumb-model";

/**
 * The trail above a Content Engine screen.
 *
 * The Stage 12 AdminCP breadcrumb, unchanged: a route puts an element on
 * `staticData.breadcrumb` and the shell renders the deepest one. Nothing here
 * recreates the Next.js `@breadcrumb` parallel-route slot - it produces the same
 * trail from the same labels, which is the point.
 *
 * ## It mounts `RouteMessages` of its own
 *
 * The shell renders the breadcrumb *above* the route's component, so it is
 * outside the provider that component mounts. Without this the create and edit
 * crumbs would translate against the root's `core.global` alone and render raw
 * keys. Same reason the staff crumbs do it, and the namespaces are the loader's
 * own - the identical entry it already warmed, so nothing suspends.
 *
 * ## Where the labels come from
 *
 * The **list** crumb needs none: the sidebar already has an entry at
 * `/admin/content/{admin.path}` carrying this content type's noun, and
 * `AdminBreadcrumb` resolves labels from the navigation this administrator can
 * see. `overrideLastLabel` is passed anyway because the screen's heading may
 * legitimately differ from the sidebar's shorter name.
 *
 * The **form** crumbs need two: the parent, because the trail passes through the
 * list URL and the last segment (`create` / `edit`) is not a page the navigation
 * knows about at all.
 *
 * ## The route data is optional, and that is not defensiveness
 *
 * The shell renders this from `staticData` for every *matched* route, and a
 * match whose loader threw is still a match. So the host's
 * `Route.useLoaderData()` is `undefined` whenever the loader answered
 * `notFound()` - an unresolvable content path, a record that is gone, a
 * permission this administrator does not hold - and spreading `undefined`
 * hands this component no props at all.
 *
 * Typing them as required was a lie the crash made obvious: with `action`
 * undefined the ternary below fell to the form crumb, which read `labels.title`
 * off nothing and took down the whole server render - so the AdminCP's 404 was
 * replaced by an empty page, for exactly the URLs a 404 is *for*. The Stage 12
 * crumbs never hit it because they read the cache and the params instead
 * (`AdminUserBreadcrumbContent`'s `data?.name`), which are absent rather than
 * undefined-shaped.
 *
 * `null` is the right trail for a screen that does not exist: the shell's
 * not-found is a message, not a place, and naming a path that resolved to
 * nothing would be inventing one.
 */

export interface ContentAdminBreadcrumbProps extends Partial<
  Pick<ContentAdminRouteData, "action" | "adminPath" | "labels" | "namespaces">
> {
  LinkComponent?: AuthLinkComponent;
}

export const ContentAdminBreadcrumbContent = ({
  LinkComponent,
  namespaces,
  ...route
}: ContentAdminBreadcrumbProps) => {
  const model = contentBreadcrumbModel(route);

  // The loader did not resolve - see the note above. Nothing below this line
  // has a content type to name, and `RouteMessages` has no namespaces to mount.
  if (model.kind === "none") return null;

  return (
    <RouteMessages namespaces={namespaces ?? []}>
      {model.kind === "list" ? (
        <AdminBreadcrumb
          LinkComponent={LinkComponent}
          overrideLastLabel={model.title}
          segments={model.segments}
        />
      ) : (
        <ContentFormCrumb LinkComponent={LinkComponent} model={model} />
      )}
    </RouteMessages>
  );
};

/**
 * The create and edit trails, which are the only ones that translate anything.
 *
 * Its own component because `useTranslations` is a hook and the list branch has
 * no use for one. Everything it does not translate - the segments, the list href
 * it labels, the nouns - is {@link contentBreadcrumbModel}'s and arrives decided.
 */
const ContentFormCrumb = ({
  LinkComponent,
  model,
}: {
  LinkComponent?: AuthLinkComponent;
  model: Extract<ContentBreadcrumbModel, { kind: "form" }>;
}) => {
  const t = useTranslations("core.content");

  return (
    <AdminBreadcrumb
      labels={{ [model.listHref]: model.title }}
      LinkComponent={LinkComponent}
      overrideLastLabel={t(
        model.action === "create" ? "create.title" : "edit.title",
        { name: model.singular },
      )}
      segments={model.segments}
    />
  );
};
