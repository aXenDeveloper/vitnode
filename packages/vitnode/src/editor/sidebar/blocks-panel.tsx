import type { ReactElement } from "react";

import { cn } from "cn";
import {
  Columns2Icon,
  CrosshairIcon,
  GripVerticalIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import type {
  AreaCatalogEntry,
  BlockCatalogEntry,
} from "../block-picker/catalog";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { BlockGlyph } from "../block-picker/block-glyph";
import {
  blockCatalogNotice,
  groupBlockCatalog,
  mergeBlockCatalogs,
} from "../block-picker/catalog";
import {
  BLOCK_CATALOG_CARD_CLASS,
  BlockCatalogEntryCard,
} from "../block-picker/entry-card";
import { useVisualEditor } from "../context";
import {
  useAreaCatalogDraggable,
  useCatalogDraggable,
} from "../dnd/use-catalog-draggable";
import { refusesRootNode } from "../state/bounds";
import { zoneDisplayName } from "../zones/zone-name";
import { insertTargetScope } from "./insert-target";
import { EditorPanelHeader } from "./panel-header";

const CATALOG_ITEM_CLASS = cn(
  BLOCK_CATALOG_CARD_CLASS,
  "group/entry focus-visible:border-ring focus-visible:ring-ring/50 enabled:hover:bg-muted/40 enabled:hover:border-input data-dragging:border-primary/50 cursor-grab border-solid transition-[background-color,border-color,opacity] duration-150 ease-out outline-none focus-visible:ring-3 enabled:active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 data-dragging:border-dashed data-dragging:opacity-50 motion-reduce:transition-none",
);

const DragHint = (): ReactElement => (
  <GripVerticalIcon
    aria-hidden="true"
    className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity duration-150 group-focus-visible/entry:opacity-100 group-enabled/entry:group-hover/entry:opacity-100"
  />
);

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

  return (
    <button
      {...handleProps}
      aria-label={t("picker.add", { name: entry.name })}
      className={CATALOG_ITEM_CLASS}
      data-dragging={dragging ? "" : undefined}
      disabled={!canInsertBlock(entry.type)}
      onClick={() => {
        insertBlock({ type: entry.type });
      }}
      ref={setNodeRef}
      type="button"
    >
      <BlockCatalogEntryCard
        entry={entry}
        icon={<BlockGlyph icon={entry.icon} />}
      />
      <DragHint />
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
  const { dragging, handleProps, setNodeRef } = useAreaCatalogDraggable();
  const zoneId = insertTarget?.zoneId ?? state.order[0];

  return (
    <button
      {...handleProps}
      aria-label={t("picker.add_area")}
      className={CATALOG_ITEM_CLASS}
      data-dragging={dragging ? "" : undefined}
      disabled={refusesRootNode(
        zoneId === undefined ? undefined : state.zones[zoneId],
      )}
      onClick={() => {
        insertArea({});
      }}
      ref={setNodeRef}
      type="button"
    >
      <BlockCatalogEntryCard entry={area} icon={<Columns2Icon />} />
      <DragHint />
    </button>
  );
};

const InsertTargetChip = (): null | ReactElement => {
  const t = useTranslations("core.editor");
  const { insertTarget, setInsertTarget } = useVisualEditor();
  const scope = insertTargetScope(insertTarget);

  if (insertTarget === null || scope === null) return null;

  return (
    <div className="bg-primary/10 text-primary animate-in fade-in slide-in-from-top-1 flex items-center gap-2 rounded-md py-1 ps-2.5 pe-1 duration-150 ease-out motion-reduce:animate-none">
      <CrosshairIcon aria-hidden="true" className="size-3.5 shrink-0" />

      <span className="min-w-0 flex-1 truncate text-xs leading-relaxed font-medium">
        {scope === "area"
          ? t("insert_for_area", { zone: zoneDisplayName(insertTarget.zoneId) })
          : t("insert_for", { zone: zoneDisplayName(insertTarget.zoneId) })}
      </span>

      <Button
        aria-label={t("insert_clear")}
        className="text-primary hover:bg-primary/15 hover:text-primary"
        onClick={() => {
          setInsertTarget(null);
        }}
        size="icon-xs"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </div>
  );
};

export const AvailableBlocksPanel = (): ReactElement => {
  const t = useTranslations("core.editor");
  const { insertTarget, state } = useVisualEditor();
  const [query, setQuery] = useState("");
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    <div className="flex flex-col">
      <EditorPanelHeader
        description={t("picker.hint")}
        title={t("available_blocks")}
      >
        <InsertTargetChip />
      </EditorPanelHeader>

      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor={searchId}>
            {t("picker.search")}
          </label>

          <InputGroup>
            <InputGroupInput
              className="[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              id={searchId}
              onChange={event => {
                setQuery(event.target.value);
              }}
              placeholder={t("picker.search")}
              ref={inputRef}
              type="search"
              value={query}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            {query.length > 0 && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={t("picker.clear")}
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  size="icon-xs"
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {groups.length > 0 ? (
          <div className="flex flex-col gap-5">
            {groups.map(group => (
              <section className="flex flex-col gap-2" key={group.id}>
                <h3 className="text-muted-foreground text-xs leading-relaxed font-medium tracking-wider uppercase">
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
    </div>
  );
};
