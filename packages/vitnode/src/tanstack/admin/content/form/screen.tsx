"use client";

import React from "react";

import type { ContentFrontendRegistry } from "@/content/index";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import type { ContentAdminRouteData } from "../route";
import type { ContentFormScreenData } from "./route";

import { ContentFormHost } from "./host";
import { ContentFormPageSkeleton } from "./page-skeleton";

const ContentFormPageBody = React.lazy(async () =>
  import("./page-body").then(module => ({
    default: module.ContentFormPageBody,
  })),
);

export interface ContentFormScreenProps
  extends ContentAdminRouteData, ContentFormScreenData {
  /** How a path becomes a navigation. Defaults to the router's own link. */
  LinkComponent?: AuthLinkComponent;
  /** This installation's content types, with their override components. */
  registry: ContentFrontendRegistry;
}

export const ContentFormScreen = ({
  LinkComponent,
  registry,
  ...route
}: ContentFormScreenProps) => {
  const entry = registry.byId(route.contentTypeId);

  if (route.action === "list" || !entry) return null;

  return (
    <ContentFormHost LinkComponent={LinkComponent}>
      {/*
       * The boundary the lazy body suspends against.
       *
       * The form's own placeholder, matching what `ContentFormDialog` shows
       * while the dialog body arrives - the two are the same form reached two
       * ways, and they should not wait differently. It is also the boundary the
       * edit screen's two `useSuspenseQuery` reads would fall to, though in
       * practice they do not suspend: the route's loader warmed both entries
       * with the identical options before this rendered.
       */}
      <React.Suspense
        fallback={
          <ContentFormPageSkeleton
            entry={entry}
            formTitle={route.formTitle}
            labels={route.labels}
            mode={route.action}
          />
        }
      >
        <ContentFormPageBody
          action={route.action}
          entry={entry}
          itemId={route.itemId ?? 0}
          title={route.formTitle ?? ""}
        />
      </React.Suspense>
    </ContentFormHost>
  );
};
