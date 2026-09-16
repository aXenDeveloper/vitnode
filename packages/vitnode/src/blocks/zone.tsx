import type { JSX, ReactElement } from "react";

import { createElement } from "react";

import type {
  BlockAllowedSpec,
  BlockRegistry,
  BlockRenderFallback,
  BlockValidationMode,
} from "./types";

import { useContentEditRuntime } from "./edit-context";
import { ContentRenderer } from "./renderer";
import { assertContentZoneId, contentZoneAttributes } from "./zone-meta";

export interface ContentZoneProps {
  allowedBlocks?: BlockAllowedSpec;
  as?: keyof JSX.IntrinsicElements;
  blocks: null | readonly unknown[] | undefined;
  className?: string;
  fallback?: BlockRenderFallback;
  id: string;
  registry?: BlockRegistry;
  validate?: BlockValidationMode;
}

export const ContentZone = ({
  allowedBlocks,
  as,
  blocks,
  className,
  fallback,
  id,
  registry,
  validate,
}: ContentZoneProps): null | ReactElement => {
  const editRuntime = useContentEditRuntime();

  assertContentZoneId(id);

  if (editRuntime) {
    return editRuntime.renderZone({
      allowedBlocks,
      as,
      blocks,
      className,
      id,
      registry,
    });
  }

  if (!blocks || blocks.length === 0) return null;

  const rendered = createElement(ContentRenderer, {
    allowed: allowedBlocks,
    blocks,
    fallback,
    registry,
    validate,
  });

  if (as === undefined && className === undefined) return rendered;

  return createElement(
    as ?? "div",
    {
      className,
      ...contentZoneAttributes({ allowedBlocks, id }),
    },
    rendered,
  );
};
