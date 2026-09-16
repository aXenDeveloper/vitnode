import type { ReactElement } from "react";

import type { BlockCatalogEntry } from "./catalog";

export const BlockCatalogEntryCard = ({
  entry,
}: {
  entry: BlockCatalogEntry;
}): ReactElement => (
  <span className="flex min-w-0 flex-col gap-0.5">
    <span className="truncate text-sm leading-relaxed font-medium">
      {entry.name}
    </span>

    {entry.description === undefined ? null : (
      <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed text-pretty">
        {entry.description}
      </span>
    )}

    <span className="text-muted-foreground truncate text-xs leading-relaxed">
      {entry.type}
    </span>
  </span>
);
