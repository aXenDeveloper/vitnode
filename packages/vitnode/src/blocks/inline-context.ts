import type { ReactNode } from "react";

import { createContext, use } from "react";

export interface BlockInlineFieldRequest {
  children: ReactNode;
  name: string;
  placeholder?: string;
}

export interface BlockInlineRuntime {
  render: (request: BlockInlineFieldRequest) => ReactNode;
}

export const BlockInlineContext = createContext<BlockInlineRuntime | null>(
  null,
);

export const useBlockInlineRuntime = (): BlockInlineRuntime | null =>
  use(BlockInlineContext);
