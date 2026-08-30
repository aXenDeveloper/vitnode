"use client";

import React from "react";

import { HeaderContent } from "@/components/ui/header-content";

import type { ContentAdminRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";

export interface ContentAdminRouteProps extends ContentAdminRouteData {
  /**
   * Controls for the heading - the list's create button, and nothing else so
   * far.
   *
   * A slot rather than a prop the shell fills in, because what belongs there is
   * a property of *which* screen this is: a list offers "Create", and the two
   * form screens offer their actions inside the form rather than beside the
   * title.
   */
  actions?: React.ReactNode;
  /**
   * The screen itself.
   *
   * The list table, the create form and the edit form are mounted by the host's
   * route from `@vitnode/core/tanstack/admin/content/*`; this module owns the
   * chrome they sit in - the provider, the heading, the layout - which is what
   * every content type shares whichever of the three it is showing.
   */
  children?: React.ReactNode;
}

/**
 * The Content Engine screen's shell.
 *
 * `RouteMessages` mounts exactly the namespaces the loader warmed, so nothing
 * suspends on the first paint. The heading is the content type's own noun,
 * resolved through the same ICU plural the sidebar entry uses - so the crumb,
 * the menu item and this title read identically in every language.
 */
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
