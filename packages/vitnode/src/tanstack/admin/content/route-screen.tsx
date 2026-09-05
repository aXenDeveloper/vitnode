"use client";

import React from "react";

import { HeaderContent } from "@/components/ui/header-content";

import type { ContentAdminRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";

export interface ContentAdminRouteProps extends ContentAdminRouteData {
  actions?: React.ReactNode;

  children?: React.ReactNode;
}

export const ContentAdminRouteContent = ({
  action,
  actions,
  children,
  description,
  namespaces,
  title,
}: ContentAdminRouteProps) => (
  <RouteMessages namespaces={namespaces}>
    <div className="p-4">
      {/*
       * The content type's own heading belongs to the **list**.
       *
       * A create or edit screen has a heading of its own - "New article", with a
       * back link to the list and the record's title under it - which the form
       * renders through `ContentFormHeader`, and which a plugin's custom layout
       * renders in whatever position that layout puts it. Rendering this one as
       * well would put two `h1`s on the page, the first of them naming the list
       * the person just left. The Next.js AdminCP has always shown exactly one:
       * `ContentListView` draws this heading and the two page views draw none.
       */}
      {action === "list" ? (
        <HeaderContent desc={description} h1={title}>
          {actions}
        </HeaderContent>
      ) : null}
      {children}
    </div>
  </RouteMessages>
);
