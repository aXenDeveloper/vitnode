import type { ReactElement, ReactNode } from "react";

export const BLOCK_CATALOG_CARD_CLASS =
  "border-border bg-card text-card-foreground flex w-full items-center gap-3 rounded-lg border p-2 text-start";

export interface BlockCatalogCardEntry {
  description?: string | undefined;
  name: string;
}

export const BlockCatalogEntryCard = ({
  entry,
  icon,
}: {
  entry: BlockCatalogCardEntry;
  icon: ReactNode;
}): ReactElement => (
  <>
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground group-enabled/entry:group-hover/entry:bg-primary/10 group-enabled/entry:group-hover/entry:text-primary flex size-9 shrink-0 items-center justify-center rounded-sm transition-colors duration-150 [&_svg]:size-4"
    >
      {icon}
    </span>

    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm leading-relaxed font-medium">
        {entry.name}
      </span>

      {entry.description === undefined ? null : (
        <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed text-pretty">
          {entry.description}
        </span>
      )}
    </span>
  </>
);
