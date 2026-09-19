import type { JSX } from "react";

import { createContext, use } from "react";

import type {
  BlockAllowedSpec,
  BlockRegistry,
  BlockRenderFallback,
  BlockValidationMode,
} from "./types";

export interface ContentZoneMount {
  allowedBlocks: BlockAllowedSpec | undefined;
  as: keyof JSX.IntrinsicElements | undefined;
  blocks: null | readonly unknown[] | undefined;
  className: string | undefined;
  fallback: BlockRenderFallback | undefined;
  id: string;
  max: number | undefined;
  min: number | undefined;
  registry: BlockRegistry | undefined;
  validate: BlockValidationMode | undefined;
}

export interface ContentZoneOutletEntry {
  mount: ContentZoneMount;
  node: HTMLElement;
}

export interface ContentEditRuntime {
  preview: boolean;
  registerZone: (entry: ContentZoneOutletEntry) => void;
  releaseZone: (id: string) => void;
}

export const ContentEditContext = createContext<ContentEditRuntime | null>(
  null,
);

export const useContentEditRuntime = (): ContentEditRuntime | null =>
  use(ContentEditContext);

export type { ContentEditorShellMode } from "./editor-shell";

export const sameContentZoneMount = (
  left: ContentZoneMount,
  right: ContentZoneMount,
): boolean =>
  left.id === right.id &&
  left.as === right.as &&
  left.className === right.className &&
  left.allowedBlocks === right.allowedBlocks &&
  left.blocks === right.blocks &&
  left.max === right.max &&
  left.min === right.min &&
  left.fallback === right.fallback &&
  left.registry === right.registry &&
  left.validate === right.validate;
