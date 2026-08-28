import { notFound } from "next/navigation";

import { userFilesModule } from "@/api/modules/users/files/files.module";
import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { fetcher } from "@/lib/fetcher";

import type { RawMyFilesParams } from "./my-files-query";

import {
  deleteMyFileAction,
  deleteMyFilesAction,
} from "./actions/delete-action.server";
import { myFilesRequest, normalizeMyFilesParams } from "./my-files-query";
import { MyFilesTableContent } from "./my-files-table-content";

/**
 * The Next.js half of `/files`: read the page, then hand it to the shared table.
 *
 * Everything Next.js about the feature is in this file. It is a Server
 * Component, so it fetches with `fetcher()` - which reads the visitor's cookies
 * through `next/headers` - and answers a refusal with `notFound()`, which only
 * exists here. The two delete callbacks are the server actions, unchanged: they
 * end in `revalidatePath`, which is how a Next.js page refreshes and is the one
 * step that cannot be shared.
 *
 * The request itself is *not* Next.js's. `normalizeMyFilesParams` and
 * `myFilesRequest` are the same two functions the TanStack Start loader calls,
 * so a URL means the same thing in both apps rather than in two places that
 * merely look alike.
 *
 * `NextDataTableNavigation` is mounted here rather than inherited from
 * `DataTable`, because the shared table renders `ContentDataTable` - the half
 * that has no idea how to change a URL. This is the same provider `DataTable`
 * mounts, so sorting, paging and searching behave exactly as they did.
 */
export const MyFilesTableView = async ({
  searchParams,
}: {
  /**
   * `RawMyFilesParams` rather than `SearchParamsDataTable`, which is what this
   * used to say and which has no `search` key - the search box has always
   * written one, and it reached the API only because Next.js hands the whole
   * query string over at runtime whatever the type claims.
   */
  searchParams: Promise<RawMyFilesParams>;
}) => {
  const params = normalizeMyFilesParams(await searchParams);
  const res = await fetcher(userFilesModule, myFilesRequest(params));

  if (res.status !== 200) {
    return notFound();
  }

  const data = await res.json();

  return (
    <NextDataTableNavigation>
      <MyFilesTableContent
        data={data}
        onDeleteFile={deleteMyFileAction}
        onDeleteFiles={deleteMyFilesAction}
      />
    </NextDataTableNavigation>
  );
};
