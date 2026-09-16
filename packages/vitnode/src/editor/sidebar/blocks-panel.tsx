import type { ReactElement } from "react";

import { cn } from "cn";
import { PlusIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { Input } from "@/components/ui/input";

import type { BlockCatalogEntry } from "../block-picker/catalog";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { groupBlockCatalog, mergeBlockCatalogs } from "../block-picker/catalog";
import { BlockCatalogEntryCard } from "../block-picker/entry-card";
import { useVisualEditor } from "../context";
import { useCatalogDraggable } from "../dnd/use-catalog-draggable";

const BlockCatalogItem = ({
  entry,
}: {
  entry: BlockCatalogEntry;
}): ReactElement => {
  const t = useTranslations("core.editor");
  const { insertBlock } = useVisualEditor();
  const { dragging, handleProps, setNodeRef } = useCatalogDraggable({
    type: entry.type,
  });

  return (
    <button
      {...handleProps}
      aria-label={t("picker.add", { name: entry.name })}
      className={cn(
        "border-border bg-card text-card-foreground hover:border-primary/60 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full cursor-grab touch-none items-start gap-2 rounded-md border p-2 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing",
        dragging ? "opacity-50" : "opacity-100",
      )}
      onClick={() => {
        insertBlock({ type: entry.type });
      }}
      ref={setNodeRef}
      type="button"
    >
      <PlusIcon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      <BlockCatalogEntryCard entry={entry} />
    </button>
  );
};

export const AvailableBlocksPanel = (): ReactElement => {
  const t = useTranslations("core.editor");
  const { insertTarget, state } = useVisualEditor();
  const [query, setQuery] = useState("");
  const searchId = useId();

  const catalog = useMemo(() => {
    const targeted = insertTarget
      ? [state.zones[insertTarget.zoneId]]
      : Object.values(state.zones);
    const zones = targeted.length > 0 ? targeted : [undefined];

    return mergeBlockCatalogs({
      fallback: getDefaultBlockRegistry(),
      sources: zones.map(zone => ({
        allowedBlocks: zone?.allowedBlocks,
        registry: zone?.registry,
      })),
    });
  }, [insertTarget, state.zones]);

  const groups = groupBlockCatalog({ entries: catalog.entries, query });

  const emptyMessage = (): null | string => {
    if (catalog.installed === 0) return t("picker.none_installed");
    if (catalog.entries.length === 0) return t("picker.empty");
    if (groups.length === 0) return t("picker.no_results");

    return null;
  };

  const empty = emptyMessage();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={searchId}>
          {t("picker.search")}
        </label>

        <Input
          id={searchId}
          onChange={event => {
            setQuery(event.target.value);
          }}
          placeholder={t("picker.search")}
          type="search"
          value={query}
        />

        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("picker.hint")}
        </p>
      </div>

      {empty === null ? (
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <section className="flex flex-col gap-2" key={group.namespace}>
              <h3 className="text-muted-foreground text-xs leading-relaxed font-medium">
                {group.namespace}
              </h3>

              <ul className="flex flex-col gap-2">
                {group.entries.map(entry => (
                  <li key={entry.type}>
                    <BlockCatalogItem entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p
          className="text-muted-foreground py-6 text-center text-sm leading-relaxed text-balance"
          role="status"
        >
          {empty}
        </p>
      )}
    </div>
  );
};
