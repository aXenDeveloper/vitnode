"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { MyFilesTableContent } from "@/views/files/my-files-table-content";

import type { MyFilesNavigate, MyFilesRouteData } from "./route";
import type { UncheckedMyFilesSearch } from "./route-search";

import { RouteMessages } from "../i18n/route-messages";
import { myFilesQuery, useMyFilesDeleteCallbacks } from "./query";
import { MY_FILES_NAMESPACES } from "./route";
import { myFilesSearchFrom, myFilesSearchParams } from "./route-search";

export interface MyFilesRouteProps extends MyFilesRouteData {
  navigate: MyFilesNavigate;
  search: UncheckedMyFilesSearch;
}

export const MyFilesRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
  userId,
}: MyFilesRouteProps) => {
  const { data } = useSuspenseQuery(myFilesQuery({ params, userId }));
  const { onDeleteFile, onDeleteFiles } = useMyFilesDeleteCallbacks(userId);

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: myFilesSearchFrom(nextSearch),
        });
      },
      searchParams: myFilesSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={MY_FILES_NAMESPACES}>
      <div className="container mx-auto flex flex-col gap-6 p-4">
        <HeaderContent desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          {/*
            The same component the Next.js page renders, handed the three things
            a shared table cannot resolve for itself: the page, and the two
            deletes. Both callbacks end in a query invalidation of the whole
            `files/me` family rather than in `revalidatePath`, and only when
            something actually went: a `409` leaves the file where it was and the
            dialog open, and a bulk run that deleted nothing must not drop the
            selection that is showing which rows were kept.
          */}
          <MyFilesTableContent
            data={data}
            onDeleteFile={onDeleteFile}
            onDeleteFiles={onDeleteFiles}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
