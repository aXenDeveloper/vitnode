export interface SearchSyncError {
  content: string;
  createdAt: Date | string;
  id: number;
  pluginId: string;
}

export interface ParsedSearchSyncError {
  contentTypeId: null | string;
  documentId: null | string;
  message: null | string;
  operation: null | string;
}

const asString = (value: unknown): null | string =>
  typeof value === "string" && value !== "" ? value : null;

export const parseSearchSyncError = (
  content: string,
): ParsedSearchSyncError => {
  const empty: ParsedSearchSyncError = {
    contentTypeId: null,
    documentId: null,
    message: null,
    operation: null,
  };

  const start = content.indexOf("{");
  if (start === -1) return empty;

  try {
    const parsed: unknown = JSON.parse(content.slice(start));
    if (typeof parsed !== "object" || parsed === null) return empty;

    const values = parsed as Record<string, unknown>;

    return {
      contentTypeId: asString(values.contentTypeId),
      documentId: asString(values.documentId),
      message: asString(values.error),
      operation: asString(values.operation),
    };
  } catch {
    return empty;
  }
};
