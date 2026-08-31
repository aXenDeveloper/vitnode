"use client";

import React from "react";

import type { ContentFrontendRegistry } from "@/content/index";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import type { AdminTableNavigate } from "../table-search";
import type { ContentFormScreenData } from "./form";
import type { ContentAdminRouteData } from "./route";
import type {
  ContentListRouteSearch,
  UncheckedContentListSearch,
} from "./route-search";

import "./editorial";
import { ContentFormScreen } from "./form";
import { ContentListActions, ContentListScreen } from "./list";
import { ContentAdminRouteContent } from "./route-screen";

/**
 * `/admin/content/*` - the whole screen, whichever of the three it is.
 *
 * The composition point, so a host's route file stays topology: it hands over
 * the loader data, the registry, the navigate and the search, and this decides
 * whether that URL is a list, a create form or an edit form. The choice is made
 * from the already-resolved `action` rather than from a second reading of the
 * path, so there is one answer to "which screen is this".
 *
 * ## Why it imports the form namespace
 *
 * Two reasons, and the second is the one worth stating. The first is ordinary:
 * a create or edit URL renders `ContentFormScreen`, which is that namespace's.
 *
 * The second is that importing `./form` is what *registers the dialog*. The
 * list's create button and its rows' pencils render through
 * `contentAdminSlots().FormDialog`, and an unregistered slot renders nothing -
 * so a dialog-mode content type would silently have no way to open a form. The
 * registration is a side effect of that module being imported, and this is the
 * one module that can guarantee it: anything that can show a content list goes
 * through here.
 *
 * `./editorial` is imported for that reason alone - it exports nothing this
 * module names. It registers the four `⋯` panels the same way, and without it a
 * row would offer publish, edit and delete and nothing else: the menu asks
 * `registeredContentRowPanels` what this host can open, so an unimported panel
 * is an absent action rather than an entry that opens nothing.
 *
 * `children` still wins when a host passes one, which is what lets an
 * application mount a form screen of its own without forking this.
 */
export interface ContentAdminScreenProps
  extends ContentAdminRouteData, ContentFormScreenData {
  /**
   * A create or edit screen of the host's own, instead of the generated one.
   *
   * Rare, and the escape hatch rather than the path: an application that wants
   * its own editor for one content type mounts it here. Absent - the normal
   * case - renders `ContentFormScreen`.
   */
  children?: React.ReactNode;
  /** How a path becomes a navigation. Defaults to the router's own link. */
  LinkComponent?: AuthLinkComponent;
  /** How a table control changes the URL - the Stage 7 seam. */
  navigate: AdminTableNavigate<ContentListRouteSearch>;
  /** This installation's content types, with their override components. */
  registry: ContentFrontendRegistry;
  /** The route's search, as the router hands it back on every navigation. */
  search: UncheckedContentListSearch;
}

export const ContentAdminScreenContent = ({
  children,
  LinkComponent,
  navigate,
  registry,
  search,
  ...routeData
}: ContentAdminScreenProps) => {
  const isList = routeData.action === "list";

  return (
    <ContentAdminRouteContent
      {...routeData}
      actions={
        isList ? (
          <ContentListActions
            contentTypeId={routeData.contentTypeId}
            LinkComponent={LinkComponent}
            registry={registry}
          />
        ) : undefined
      }
    >
      {isList ? (
        <ContentListScreen
          contentTypeId={routeData.contentTypeId}
          LinkComponent={LinkComponent}
          navigate={navigate}
          params={routeData.listParams}
          registry={registry}
          search={search}
        />
      ) : (
        (children ?? (
          <ContentFormScreen
            {...routeData}
            LinkComponent={LinkComponent}
            registry={registry}
          />
        ))
      )}
    </ContentAdminRouteContent>
  );
};
