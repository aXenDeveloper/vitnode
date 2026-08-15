import { getTranslations } from "next-intl/server";

import { getFrontendContentTypes } from "@/content/admin/config";
import {
  type ContentLabelTranslator,
  contentNouns,
} from "@/content/admin/labels";

/**
 * Human labels for the collections a Content Engine content type contributes.
 *
 * A generated indexer uses the content type id as its item type
 * (`example.article`), and the renderer registry in `views/search/registry` is a
 * hardcoded core map - so without this every content collection would read
 * "Content". Resolved from the frontend registry, which is why this is called
 * from the server component and not from the shared table.
 *
 * The label is the plural noun the sidebar and the list heading show, resolved
 * the same way: a collection reading "Articles" in a Polish AdminCP would name a
 * screen that calls itself "Artykuły".
 */
export const getContentCollectionLabels = async (): Promise<
  Map<string, string>
> => {
  const t = (await getTranslations()) as unknown as ContentLabelTranslator;

  return new Map(
    getFrontendContentTypes().map(({ definition, pluginId }) => [
      definition.id,
      contentNouns(definition, pluginId, t).title,
    ]),
  );
};
