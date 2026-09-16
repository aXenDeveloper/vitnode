import type { JSX, ReactElement } from "react";

import { createContext, use } from "react";

import type { BlockAllowedSpec, BlockRegistry } from "./types";

export interface ContentZoneMount {
  allowedBlocks: BlockAllowedSpec | undefined;
  as: keyof JSX.IntrinsicElements | undefined;
  blocks: null | readonly unknown[] | undefined;
  className: string | undefined;
  id: string;
  registry: BlockRegistry | undefined;
}

export interface ContentEditRuntime {
  renderZone: (mount: ContentZoneMount) => null | ReactElement;
}

export const ContentEditContext = createContext<ContentEditRuntime | null>(
  null,
);

export const useContentEditRuntime = (): ContentEditRuntime | null =>
  use(ContentEditContext);
