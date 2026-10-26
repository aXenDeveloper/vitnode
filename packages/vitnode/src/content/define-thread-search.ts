import type {
  ContentFieldMap,
  ContentSearchConfig,
  ResolvedContentDeliveryConfig,
  ResolvedContentPublicApiConfig,
  ResolvedContentPublicWriteConfig,
  ResolvedContentThreadConfig,
} from "./types";

import {
  CONTENT_SEARCH_SLUG_PLACEHOLDER,
  CONTENT_SEARCH_TEXT_KINDS,
} from "./const";

const DELIVERY_SLUG_SEGMENT = ":slug";

const searchTextKinds: ReadonlySet<string> = new Set(CONTENT_SEARCH_TEXT_KINDS);

const rootIsSearchable = (fields: ContentFieldMap, rootField: string) => {
  const root = fields[rootField];
  if (root?.kind !== "relation" || root.self) return false;

  try {
    return root.target().search.enabled;
  } catch {
    return false;
  }
};

export const defaultThreadSearch = ({
  delivery,
  fields,
  publicApi,
  publicWrite,
  thread,
}: {
  delivery: ResolvedContentDeliveryConfig;
  fields: ContentFieldMap;
  publicApi: ResolvedContentPublicApiConfig;
  publicWrite: ResolvedContentPublicWriteConfig;
  thread: ResolvedContentThreadConfig;
}): ContentSearchConfig | undefined => {
  if (!thread.enabled || !delivery.enabled || !publicApi.enabled) {
    return undefined;
  }
  if (!rootIsSearchable(fields, thread.rootField)) return undefined;

  const exposed = new Set<string>(publicApi.fields);
  const contentFields = Object.entries(fields)
    .filter(
      ([name, descriptor]) =>
        exposed.has(name) &&
        name !== publicApi.slugField &&
        searchTextKinds.has(descriptor.kind),
    )
    .map(([name]) => name);
  const [firstContentField, ...otherContentFields] = contentFields;
  if (firstContentField === undefined) return undefined;

  const pathTemplate = delivery.path
    .split("/")
    .map(segment =>
      segment === DELIVERY_SLUG_SEGMENT
        ? CONTENT_SEARCH_SLUG_PLACEHOLDER
        : segment,
    )
    .join("/");

  const owner = publicWrite.ownerField;
  const search: ContentSearchConfig = {
    contentFields: [firstContentField, ...otherContentFields],
    pathTemplate,
    titleField: thread.rootField,
  };

  return owner !== null && fields[owner]?.kind === "user"
    ? { ...search, authorField: owner }
    : search;
};
