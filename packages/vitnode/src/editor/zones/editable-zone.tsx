import type { ReactElement } from "react";

import { cn } from "cn";
import { PlusIcon } from "lucide-react";
import { createElement, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { ContentZoneMount } from "../../blocks/edit-context";
import type { EditorZoneMount } from "../state/types";

import { isBlockInstance } from "../../blocks/instance";
import { resolveBlockRegistry } from "../../blocks/registry";
import { ContentRenderer } from "../../blocks/renderer";
import { contentZoneAttributes } from "../../blocks/zone-meta";
import { EditableBlockShell } from "../block-shell/block-shell";
import { useVisualEditor } from "../context";
import { useZoneDroppable } from "../dnd/use-zone-droppable";
import { ZoneSortable } from "../dnd/zone-sortable";
import { UnknownBlock } from "./unknown-block";

type ZoneDropState = "idle" | "over" | "rejected" | "targeting";

const DROP_CLASSES = {
  idle: "outline-border/60 hover:outline-border",
  over: "outline-primary ring-primary/40 ring-2",
  rejected: "outline-destructive/60 bg-destructive/5",
  targeting: "outline-border",
} as const satisfies Record<ZoneDropState, string>;

const dropState = ({
  active,
  over,
  rejected,
}: {
  active: boolean;
  over: boolean;
  rejected: boolean;
}): ZoneDropState => {
  if (rejected) return "rejected";
  if (over) return "over";

  return active ? "targeting" : "idle";
};

interface IncomingZone {
  signature: string;
  zone: EditorZoneMount;
}

export const EditableZone = (mount: ContentZoneMount): null | ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch, openPicker, preview, state } = useVisualEditor();
  const { active, over, rejected, setNodeRef } = useZoneDroppable({
    zoneId: mount.id,
  });
  const registeredRef = useRef<IncomingZone | null>(null);

  const incoming = useMemo((): IncomingZone => {
    const blocks = (mount.blocks ?? []).filter(isBlockInstance);

    return {
      signature: JSON.stringify({
        allowedBlocks: mount.allowedBlocks ?? null,
        blocks,
      }),
      zone: {
        allowedBlocks: mount.allowedBlocks,
        blocks,
        id: mount.id,
        registry: mount.registry,
      },
    };
  }, [mount.allowedBlocks, mount.blocks, mount.id, mount.registry]);

  useEffect(() => {
    const last = registeredRef.current;

    if (
      last?.signature === incoming.signature &&
      last.zone.registry === incoming.zone.registry
    ) {
      return;
    }

    registeredRef.current = incoming;
    dispatch({ type: "mount", zone: incoming.zone });
  }, [dispatch, incoming]);

  const zone = state.zones[mount.id];
  const blocks = zone?.blocks ?? incoming.zone.blocks;

  if (preview) {
    if (blocks.length === 0) return null;

    const rendered = createElement(ContentRenderer, {
      allowed: mount.allowedBlocks,
      blocks,
      registry: mount.registry,
    });

    if (mount.as === undefined && mount.className === undefined) {
      return rendered;
    }

    return createElement(
      mount.as ?? "div",
      {
        className: mount.className,
        ...contentZoneAttributes({
          allowedBlocks: mount.allowedBlocks,
          id: mount.id,
        }),
      },
      rendered,
    );
  }

  const registry =
    blocks.length === 0
      ? undefined
      : resolveBlockRegistry(zone?.registry ?? mount.registry);
  const dropping = dropState({ active, over, rejected });

  const addBlock = (
    <Button
      onClick={() => {
        openPicker({ index: blocks.length, zoneId: mount.id });
      }}
      size="sm"
      variant="outline"
    >
      <PlusIcon />
      {t("zone.add_block")}
    </Button>
  );

  const notAllowed = (
    <p className="text-destructive text-xs leading-relaxed text-pretty">
      {t("zone.rejected")}
    </p>
  );

  const label = (
    <span className="border-border bg-background text-muted-foreground pointer-events-none absolute start-2 -top-2.5 z-10 rounded-md border px-1.5 text-xs leading-relaxed">
      <span className="sr-only">{t("zone.label")} </span>
      {mount.id}
    </span>
  );

  const body =
    blocks.length === 0 ? (
      <div className="border-border text-muted-foreground flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4">
        <p className="text-xs leading-relaxed text-pretty">{t("zone.empty")}</p>
        {rejected ? notAllowed : addBlock}
      </div>
    ) : (
      <ZoneSortable blockIds={blocks.map(instance => instance.id)}>
        {blocks.map((instance, index) => {
          const entry = registry?.get(instance.type);

          return (
            <EditableBlockShell
              index={index}
              instance={instance}
              key={instance.id}
              zoneId={mount.id}
            >
              {entry
                ? createElement(entry.definition.component, {
                    blockId: instance.id,
                    data: instance.data,
                    index,
                    type: instance.type,
                  })
                : createElement(UnknownBlock, { type: instance.type })}
            </EditableBlockShell>
          );
        })}
      </ZoneSortable>
    );

  const footer =
    blocks.length === 0 ? null : (
      <div className="flex justify-center pt-2">
        {rejected ? notAllowed : addBlock}
      </div>
    );

  return createElement(
    mount.as ?? "div",
    {
      ...contentZoneAttributes({
        allowedBlocks: mount.allowedBlocks,
        id: mount.id,
      }),
      className: cn(
        "relative rounded-md outline-1 outline-offset-4 transition-colors outline-dashed",
        DROP_CLASSES[dropping],
        mount.className,
      ),
      "data-editor-zone": dropping,
      ref: setNodeRef,
    },
    label,
    body,
    footer,
  );
};
