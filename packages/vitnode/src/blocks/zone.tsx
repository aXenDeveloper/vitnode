import type { JSX, ReactElement } from "react";

import { createElement } from "react";

import type {
  BlockAllowedSpec,
  BlockRegistry,
  BlockRenderFallback,
  BlockValidationMode,
} from "./types";

import { useContentEditRuntime } from "./edit-context";
import { useEditablePage } from "./page-context";
import { ContentRenderer } from "./renderer";
import {
  assertContentZoneId,
  contentZoneAllowed,
  contentZoneAttributes,
  contentZoneBounds,
} from "./zone-meta";
import { ContentZoneOutlet } from "./zone-outlet";

export interface ContentZoneProps {
  /** What may be placed here. Under an editable page it may only narrow what the page allows. */
  allowedBlocks?: BlockAllowedSpec;
  /** HTML element to wrap the widgets in; without `as` or `className` nothing is added. */
  as?: keyof JSX.IntrinsicElements;
  /**
   * The instances to render; `null` and `[]` render nothing. Left out under an
   * `EditablePage`, the page's stored layout for this zone is used.
   */
  blocks?: null | readonly unknown[];
  /** Class for the wrapper; implies `as="div"`. */
  className?: string;
  /** What to render for a widget that is skipped; defaults to a development-only notice. */
  fallback?: BlockRenderFallback;
  /**
   * Stable name of this place on the page: `:`-separated segments of
   * lowercase letters, digits and single hyphens, up to 64 characters, e.g.
   * `"settings:before-profile"`. Saved layouts address zones by it.
   */
  id: string;
  /** Editor bounds on the number of widgets; may only tighten an editable page's own. */
  max?: number;
  min?: number;
  /** Defaults to the process default registry installed by `src/blocks.gen.ts`. */
  registry?: BlockRegistry;
  /** Defaults to `"development"`. */
  validate?: BlockValidationMode;
}

/**
 * A named place on a page where widgets render. Renders the instances it is
 * given through `ContentRenderer`, makes no request, and adds no element
 * unless `as` or `className` is set. In edit mode it registers itself with the
 * Visual Editor instead.
 *
 * @throws {BlockError} On an invalid `id`, or when two zones with one id are
 * mounted at the same time in edit mode.
 *
 * @example
 * ```tsx
 * import { ContentZone } from "@vitnode/core/widgets/zone";
 *
 * <ContentZone id="main" blocks={page.content} registry={blocksRegistry} />;
 * ```
 */
export const ContentZone = ({
  allowedBlocks,
  as,
  blocks,
  className,
  fallback,
  id,
  max,
  min,
  registry,
  validate,
}: ContentZoneProps): null | ReactElement => {
  const editRuntime = useContentEditRuntime();
  const page = useEditablePage();

  assertContentZoneId(id);

  const declared =
    page?.lookupZone(id) ??
    (page && blocks === undefined ? page.resolveZone(id) : undefined);
  const nodes = blocks === undefined ? declared?.blocks : blocks;
  const allowed = contentZoneAllowed({
    declared: declared?.allowedBlocks,
    explicit: allowedBlocks,
    id,
  });
  const bounds = contentZoneBounds({
    declared,
    explicit: { max, min },
    id,
  });

  if (editRuntime) {
    return createElement(ContentZoneOutlet, {
      mount: {
        allowedBlocks: allowed,
        as,
        blocks: nodes,
        className,
        fallback,
        id,
        max: bounds.max,
        min: bounds.min,
        registry,
        validate,
      },
      runtime: editRuntime,
    });
  }

  if (!nodes || nodes.length === 0) return null;

  const rendered = createElement(ContentRenderer, {
    allowed,
    blocks: nodes,
    fallback,
    registry,
    validate,
  });

  if (as === undefined && className === undefined) return rendered;

  return createElement(
    as ?? "div",
    {
      className,
      ...contentZoneAttributes({ allowedBlocks: allowed, id }),
    },
    rendered,
  );
};
