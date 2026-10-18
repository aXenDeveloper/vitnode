import type { ContentId } from "./ids";

import { contentIdKey } from "./ids";

/**
 * One record a public action points at, such as the item a `ReportButton`
 * reports. The same three values identify the record on the API, so build it
 * with `contentTarget` instead of passing them around one by one.
 *
 * A custom report target (`defineReportTarget`) uses the same shape, with its
 * own `type`.
 */
export interface ContentTarget {
  /** The record's id, as the API reads it from a path. */
  id: string;
  /** The plugin that registered the content type - its `manifest.id`. */
  pluginId: string;
  /** The content type id, e.g. `"forum.comment"`. */
  type: string;
}

/**
 * Builds the `ContentTarget` of one record from the content type definition,
 * so the type id never drifts from the one the API registered. Browser-safe:
 * a content definition holds no server code.
 *
 * @example
 * ```tsx
 * import { contentTarget } from "@vitnode/core/content";
 *
 * import { commentContentType } from "@/content/comment";
 * import { manifest } from "@/manifest.gen";
 *
 * const target = contentTarget(manifest.id, commentContentType, comment.id);
 * ```
 */
export const contentTarget = (
  pluginId: string,
  definition: { id: string },
  id: ContentId,
): ContentTarget => ({
  id: contentIdKey(id),
  pluginId,
  type: definition.id,
});
