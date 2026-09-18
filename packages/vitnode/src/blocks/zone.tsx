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
import { assertContentZoneId, contentZoneAttributes } from "./zone-meta";
import { ContentZoneOutlet } from "./zone-outlet";

export interface ContentZoneProps {
  allowedBlocks?: BlockAllowedSpec;
  as?: keyof JSX.IntrinsicElements;
  blocks?: null | readonly unknown[];
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
  const page = useEditablePage();

  assertContentZoneId(id);

  const declared = blocks === undefined ? page?.resolveZone(id) : undefined;
  const nodes = blocks === undefined ? declared?.blocks : blocks;
  const allowed = allowedBlocks ?? declared?.allowedBlocks;

  if (editRuntime) {
    return createElement(ContentZoneOutlet, {
      mount: {
        allowedBlocks: allowed,
        as,
        blocks: nodes,
        className,
        fallback,
        id,
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
