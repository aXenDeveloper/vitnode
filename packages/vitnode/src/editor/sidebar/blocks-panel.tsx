import type { ReactElement } from "react";

import { cn } from "cn";
import { Columns2Icon, PlusIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { Input } from "@/components/ui/input";

import type {
  AreaCatalogEntry,
  BlockCatalogEntry,
} from "../block-picker/catalog";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import {
  blockCatalogNotice,
  groupBlockCatalog,
  mergeBlockCatalogs,
} from "../block-picker/catalog";
import { BlockCatalogEntryCard } from "../block-picker/entry-card";
import { useVisualEditor } from "../context";
import { useCatalogDraggable } from "../dnd/use-catalog-draggable";
import { refusesRootNode } from "../state/bounds";

const CARD_CLASS =
  "border-border bg-card text-card-foreground hover:border-primary/60 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full items-start gap-2 rounded-md border p-2 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none";

const BlockCatalogItem = ({
  entry,
}: {
  entry: BlockCatalogEntry;
}): ReactElement => {
  const t = useTranslations("core.editor");
  const { canInsertBlock, insertBlock } = useVisualEditor();
  const { dragging, handleProps, setNodeRef } = useCatalogDraggable({
    type: entry.type,
  });
  const refused = !canInsertBlock(entry.type);

  return (
    <button
      {...handleProps}
      aria-label={t("picker.add", { name: entry.name })}
      className={cn(
        CARD_CLASS,
        "cursor-grab touch-none active:cursor-grabbing",
        dragging ? "opacity-50" : "opacity-100",
        refused && "cursor-not-allowed opacity-50",
      )}
      disabled={refused}
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

const AreaCatalogItem = ({
  area,
}: {
  area: AreaCatalogEntry;
}): ReactElement => {
  const t = useTranslations("core.editor");
  const { insertArea, insertTarget, state } = useVisualEditor();
  const zoneId = insertTarget?.zoneId ?? state.order[0];
  const refused = refusesRootNode(
    zoneId === undefined ? undefined : state.zones[zoneId],
  );

  return (
    <button
      aria-label={t("picker.add_area")}
      className={cn(
        CARD_CLASS,
        refused ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
      disabled={refused}
      onClick={() => {
        insertArea({});
      }}
      type="button"
    >
      <Columns2Icon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      <BlockCatalogEntryCard entry={area} />
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

  const groups = groupBlockCatalog({
    entries: catalog.entries,
    layout:
      insertTarget?.areaId === undefined || insertTarget.areaId === null
        ? {
            area: { description: t("area.description"), name: t("area.name") },
            label: t("picker.layout_group"),
          }
        : undefined,
    query,
  });

  const notice = blockCatalogNotice({
    installed: catalog.installed,
    matched: groups.reduce(
      (total, group) =>
        group.kind === "namespace" ? total + group.entries.length : total,
      0,
    ),
    offered: catalog.entries.length,
  });

  return (
    <div className="flex flex-col gap-4 p-4">
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

      {groups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <section className="flex flex-col gap-2" key={group.id}>
              <h3 className="text-muted-foreground text-xs leading-relaxed font-medium">
                {group.label}
              </h3>

              <ul className="flex flex-col gap-2">
                {group.kind === "layout" ? (
                  <li>
                    <AreaCatalogItem area={group.area} />
                  </li>
                ) : (
                  group.entries.map(entry => (
                    <li key={entry.type}>
                      <BlockCatalogItem entry={entry} />
                    </li>
                  ))
                )}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {notice === null ? null : (
        <p
          className="text-muted-foreground py-6 text-center text-sm leading-relaxed text-balance"
          role="status"
        >
          {t(`picker.${notice}`)}
        </p>
      )}
    </div>
  );
};
