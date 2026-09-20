import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { AnyEditablePageDefinition } from "@/content/editor";

import { EditablePage } from "@/blocks/page";
import { ContentZone } from "@/blocks/zone";
import { createContentEditorAdapter } from "@/content/editor";

import {
  holdsPagePermission,
  mergePageLayout,
  moderatorPermissionsQueryOptions,
  pageLayoutQueryOptions,
  savePageLayout,
} from "./query";
import { pageWidgetsRegistry } from "./registry";

/**
 * Everything a registered editable page needs to be editable, from the page
 * definition alone.
 *
 * Core owns the two routes a page layout is read and written through, so it
 * owns talking to them: a page wraps its zones in this and declares nothing
 * else - no query, no adapter, no permission check of its own.
 */
export const PageWidgets = ({
  children,
  openEditing,
  page,
}: {
  children: React.ReactNode;
  /** Arrive with edit mode asked for - what a `?edit=true` link hands you. */
  openEditing?: boolean;
  page: AnyEditablePageDefinition;
}) => {
  const queryClient = useQueryClient();
  const { data: layout } = useQuery(pageLayoutQueryOptions(page.id));
  const { data: held } = useQuery(moderatorPermissionsQueryOptions());

  const adapter = useMemo(
    () =>
      createContentEditorAdapter({
        page,
        save: async payload => {
          const stored = await savePageLayout(payload);

          queryClient.setQueryData(
            pageLayoutQueryOptions(page.id).queryKey,
            current => mergePageLayout(current, stored),
          );

          return stored;
        },
      }),
    [page, queryClient],
  );

  const permission = page.permission;
  const canEdit =
    // Never offered while the stored layout is unknown: the editor would open
    // on empty zones, and a Save from there is a Save that meant to write over
    // whatever is actually stored.
    layout != null &&
    permission.plugin !== undefined &&
    holdsPagePermission(held, {
      module: permission.module,
      permission: permission.permission,
      plugin: permission.plugin,
    });

  return (
    <EditablePage
      adapter={adapter}
      canEdit={canEdit}
      layout={layout ?? null}
      openEditing={openEditing}
      page={page}
    >
      {children}
    </EditablePage>
  );
};

/** One widget area of the page {@link PageWidgets} is rendering. */
export const PageWidgetsZone = ({
  className = "flex flex-col gap-6",
  id,
}: {
  className?: string;
  id: string;
}) => (
  <ContentZone className={className} id={id} registry={pageWidgetsRegistry()} />
);
