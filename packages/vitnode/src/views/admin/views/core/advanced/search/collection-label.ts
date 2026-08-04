import { getFrontendContentTypes } from "@/content/admin/config";

/**
 * Human labels for the collections a Content Engine content type contributes.
 *
 * A generated indexer uses the content type id as its item type
 * (`example.article`), and the renderer registry in `views/search/registry` is a
 * hardcoded core map - so without this every content collection would read
 * "Content". Resolved from the frontend registry, which is why this is called
 * from the server component and not from the shared table.
 */
export const getContentCollectionLabels = (): Map<string, string> =>
  new Map(
    getFrontendContentTypes().map(({ definition }) => [
      definition.id,
      definition.admin.label.plural,
    ]),
  );
