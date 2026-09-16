import type { ReactElement } from "react";

import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import type { BlockPickerTarget } from "../context";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { useVisualEditor } from "../context";
import { createBlockInstanceFor } from "../instance/defaults";
import { blockCatalogFor, groupBlockCatalog } from "./catalog";

export const BlockPickerDialog = ({
  onOpenChange,
  open,
  target,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: BlockPickerTarget | null;
}): ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch, state } = useVisualEditor();
  const [query, setQuery] = useState("");

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setQuery("");
  }

  const zone = target ? state.zones[target.zoneId] : undefined;

  const registry = useMemo(
    () =>
      open && target
        ? (zone?.registry ?? getDefaultBlockRegistry())
        : undefined,
    [open, target, zone?.registry],
  );

  const entries = useMemo(
    () => (registry ? blockCatalogFor(registry, zone?.allowedBlocks) : []),
    [registry, zone?.allowedBlocks],
  );

  const groups = groupBlockCatalog({ entries, query });

  const insertBlock = (type: string) => {
    const entry = registry?.get(type);
    if (!entry || !target) return;

    const instance = createBlockInstanceFor(entry);

    dispatch({
      index: target.index,
      instance,
      type: "insert",
      zoneId: target.zoneId,
    });
    dispatch({ blockId: instance.id, type: "select" });
    onOpenChange(false);
  };

  return (
    <CommandDialog
      description={t("picker.desc")}
      onOpenChange={onOpenChange}
      open={open}
      title={t("picker.title")}
    >
      <Command label={t("picker.title")} shouldFilter={false}>
        <CommandInput
          autoFocus
          onValueChange={setQuery}
          placeholder={t("picker.search")}
          value={query}
        />

        <CommandList>
          {entries.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm leading-relaxed text-balance">
              {t("picker.empty")}
            </p>
          )}

          {entries.length > 0 && groups.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm leading-relaxed text-balance">
              {t("picker.no_results")}
            </p>
          )}

          {groups.map(group => (
            <CommandGroup heading={group.namespace} key={group.namespace}>
              {group.entries.map(entry => (
                <CommandItem
                  key={entry.type}
                  onSelect={() => insertBlock(entry.type)}
                  value={entry.type}
                >
                  <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                    <span className="truncate font-medium">{entry.name}</span>

                    {!!entry.description && (
                      <span className="text-muted-foreground truncate text-xs leading-relaxed">
                        {entry.description}
                      </span>
                    )}

                    <span className="text-muted-foreground truncate text-xs">
                      {entry.type}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
