import type { ReactElement, ReactNode } from "react";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export const ZoneSortable = ({
  blockIds,
  children,
}: {
  blockIds: readonly string[];
  children: ReactNode;
}): ReactElement => (
  <SortableContext items={[...blockIds]} strategy={verticalListSortingStrategy}>
    {children}
  </SortableContext>
);
