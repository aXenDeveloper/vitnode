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

export interface ContentAdminScreenProps
  extends ContentAdminRouteData, ContentFormScreenData {
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
