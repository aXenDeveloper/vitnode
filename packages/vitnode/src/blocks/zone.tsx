import type { ElementType, ReactElement } from "react";

import { createElement } from "react";

import type {
  BlockAllowedSpec,
  BlockRegistry,
  BlockRenderFallback,
  BlockValidationMode,
  ContentZoneField,
} from "./types";

import { ContentRenderer } from "./renderer";
import { assertContentZoneId, contentZoneAttributes } from "./zone-meta";

export interface ContentZoneProps {
  allowedBlocks?: BlockAllowedSpec;
  as?: ElementType;
  blocks: null | readonly unknown[] | undefined;
  className?: string;
  fallback?: BlockRenderFallback;
  field?: ContentZoneField;
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
  field,
  id,
  registry,
  validate,
}: ContentZoneProps): null | ReactElement => {
  assertContentZoneId(id);

  if (!blocks || blocks.length === 0) return null;

  const allowed = allowedBlocks ?? field?.allowed;

  const rendered = createElement(ContentRenderer, {
    allowed,
    blocks,
    fallback,
    registry,
    validate,
  });

  if (as === undefined && className === undefined) return rendered;

  return createElement(
    as ?? "div",
    { className, ...contentZoneAttributes({ allowedBlocks: allowed, id }) },
    rendered,
  );
};
