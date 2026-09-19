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
  allowedBlocks?: BlockAllowedSpec;
  as?: keyof JSX.IntrinsicElements;
  blocks?: null | readonly unknown[];
  className?: string;
  fallback?: BlockRenderFallback;
  id: string;
  max?: number;
  min?: number;
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
