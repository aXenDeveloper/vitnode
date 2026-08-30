"use client";

import React from "react";

import { Link, usePathname, useRouter } from "@/lib/navigation";

import type { ContentFormNavigation } from "./navigation";
import type { ContentFormTransport } from "./transport";

import { useNextContentEditorialTransport } from "../actions/editorial-host-next";
import { ContentEditorialTransportProvider } from "../actions/editorial-transport";
import {
  createContentAction,
  createLocalizedContentAction,
  editContentAction,
  editLocalizedContentAction,
  loadContentOptionsAction,
  publishContentAction,
  reloadContentRowAction,
  unpublishContentAction,
} from "../actions/mutation-api.server";
import { listContentTranslationsAction } from "../actions/translation-api.server";
import { ContentFormNavigationProvider } from "./navigation";
import { ContentFormTransportProvider } from "./transport";

/**
 * The Content Engine's two seams, wired to Next.js.
 *
 * The whole of the framework coupling the content screens used to spread across
 * the form, the create button, the row's edit button and the form page, in one
 * place. `ContentAdminView` mounts this once, above the list and both page-mode
 * screens, so every existing screen keeps exactly the behaviour it had.
 *
 * `NextDataTableNavigation` is the same arrangement one layer over, and the
 * naming follows it: a `*-next` module is the only thing in a content screen's
 * graph that is allowed to name Next.js.
 *
 * ## The transport is the Server Actions, unchanged
 *
 * Every member below is the action it always was, with the arguments it always
 * took. That is deliberate and it is what makes this migration reviewable: the
 * Next.js path did not move to a new transport, it grew an interface in front of
 * the one it had. `revalidatePath`, the public-locale cache diffing and the
 * `revalidateContent` tag arithmetic all still happen inside those actions,
 * server-side, before they answer - none of which a browser could do, and none
 * of which the form ever knew about.
 *
 * The object is `useMemo`'d over nothing rather than declared at module scope
 * because a Server Action reference is stable for the life of the bundle: the
 * memo is here so the identity is stable across renders, which is what keeps the
 * `React.useEffect`s in the form - the translation read and the collection
 * reload - from re-running on every keystroke.
 */
const useNextContentFormTransport = (): ContentFormTransport =>
  React.useMemo(
    () => ({
      create: createContentAction,
      createLocalized: createLocalizedContentAction,
      edit: editContentAction,
      editLocalized: editLocalizedContentAction,
      listTranslations: listContentTranslationsAction,
      loadOptions: loadContentOptionsAction,
      publish: publishContentAction,
      reloadRow: reloadContentRowAction,
      unpublish: unpublishContentAction,
    }),
    [],
  );

/**
 * `push(pathname)` is how an App Router page refetches its own RSC payload, and
 * that is what `refresh` has always meant on these screens - a list that has to
 * show the row that was just created, a page-mode edit whose heading has to show
 * the title that was just saved.
 *
 * `usePathname` is `next-intl`'s rather than `next/navigation`'s, on purpose:
 * the latter returns `/pl/admin/content/blog/articles`, and pushing that through
 * a router that prefixes the locale again gives `/pl/pl/…`.
 */
const useNextContentFormNavigation = (): ContentFormNavigation => {
  const { push } = useRouter();
  const pathname = usePathname();

  return React.useMemo(
    () => ({
      LinkComponent: Link,
      navigate: href => {
        push(href);
      },
      refresh: () => {
        push(pathname);
      },
    }),
    [pathname, push],
  );
};

/**
 * All three of the Content Engine's seams, mounted once above every screen.
 *
 * The editorial one joins the other two here rather than in the row menu, and
 * for the same reason the form's did: `ContentAdminView` is the single place the
 * list, the create page and the edit page meet, and the editorial panels are
 * opened from a row of the first of those. Mounting it per panel would create
 * one transport per dialog, which is a new object identity every time somebody
 * opens a menu.
 */
export const NextContentFormHost = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const transport = useNextContentFormTransport();
  const editorial = useNextContentEditorialTransport();
  const navigation = useNextContentFormNavigation();

  return (
    <ContentFormTransportProvider value={transport}>
      <ContentEditorialTransportProvider value={editorial}>
        <ContentFormNavigationProvider value={navigation}>
          {children}
        </ContentFormNavigationProvider>
      </ContentEditorialTransportProvider>
    </ContentFormTransportProvider>
  );
};
