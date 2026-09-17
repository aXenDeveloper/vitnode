import type { ReactElement } from "react";

import { cn } from "cn";
import { PlusIcon } from "lucide-react";
import { createElement, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { ContentZoneMount } from "../../blocks/edit-context";
import type { AnyBlockInstance, RegisteredBlock } from "../../blocks/types";
import type { EditorZoneMount } from "../state/types";
import type { ZoneDropState } from "./drop-state";

import { resolveBlockRegistry } from "../../blocks/registry";
import { ContentRenderer } from "../../blocks/renderer";
import { contentZoneAttributes } from "../../blocks/zone-meta";
import { EditableBlockShell } from "../block-shell/block-shell";
import { useVisualEditor } from "../context";
import { useZoneDroppable } from "../dnd/use-zone-droppable";
import { ZoneSortable } from "../dnd/zone-sortable";
import { InvalidBlock, UnknownBlock } from "./block-placeholder";
import { editableBlockRender } from "./block-render";
import { classifyZoneEntries } from "./classify";
import { zoneDropState } from "./drop-state";
import { InvalidZoneEntries } from "./invalid-entries";

const ZONE_CLASSES = {
  idle: "bg-muted/20 outline-border/60 hover:outline-border",
  inserting: "bg-primary/5 outline-primary/70 ring-primary/20 ring-2",
  over: "bg-primary/5 outline-primary ring-primary/40 ring-2",
  rejected: "bg-destructive/5 outline-destructive/60",
  targeting: "bg-muted/20 outline-border",
} as const satisfies Record<ZoneDropState, string>;

const PLACEHOLDER_CLASSES = {
  idle: "border-border bg-muted/30",
  inserting: "border-primary/60 bg-primary/5",
  over: "border-primary bg-primary/10",
  rejected: "border-destructive/60 bg-destructive/5",
  targeting: "border-border bg-muted/30",
} as const satisfies Record<ZoneDropState, string>;

interface IncomingZone {
  signature: string;
  zone: EditorZoneMount;
}

interface EditableBlockBodyProps {
  entry: RegisteredBlock | undefined;
  index: number;
  instance: AnyBlockInstance;
}

const EditableBlockBody = ({
  entry,
  index,
  instance,
}: EditableBlockBodyProps): ReactElement => {
  const render = editableBlockRender({ entry, instance });

  if (render.kind === "unknown-type") {
    return <UnknownBlock type={instance.type} />;
  }

  if (render.kind === "invalid-data") {
    return (
      <InvalidBlock
        detail={render.detail}
        name={entry?.definition.name ?? instance.type}
      />
    );
  }

  return createElement(render.entry.definition.component, {
    blockId: instance.id,
    data: instance.data,
    index,
    type: instance.type,
  });
};

export const EditableZone = (mount: ContentZoneMount): null | ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch, insertTarget, preview, setInsertTarget, setPanel, state } =
    useVisualEditor();
  const { active, over, rejected, setNodeRef } = useZoneDroppable({
    zoneId: mount.id,
  });
  const registeredRef = useRef<IncomingZone | null>(null);

  const incoming = useMemo((): IncomingZone => {
    const { blocks, invalid } = classifyZoneEntries(mount.blocks);

    return {
      signature: JSON.stringify({
        allowedBlocks: mount.allowedBlocks ?? null,
        blocks,
        invalid: invalid.map(entry => entry.index),
      }),
      zone: {
        allowedBlocks: mount.allowedBlocks,
        blocks,
        id: mount.id,
        invalid,
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
  const invalid = zone?.invalid ?? incoming.zone.invalid;

  if (preview) {
    if (blocks.length === 0) return null;

    const rendered = createElement(ContentRenderer, {
      allowed: mount.allowedBlocks,
      blocks,
      fallback: mount.fallback,
      registry: mount.registry,
      validate: mount.validate,
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
  const inserting = insertTarget?.zoneId === mount.id;
  const dropping = zoneDropState({ active, inserting, over, rejected });

  const addBlock = (
    <Button
      onClick={() => {
        setInsertTarget({ index: blocks.length, zoneId: mount.id });
        setPanel("blocks");
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
    <span
      className={cn(
        "bg-background pointer-events-none absolute start-2 -top-2.5 z-10 rounded-md border px-1.5 text-xs leading-relaxed transition-colors",
        inserting
          ? "border-primary text-primary"
          : "border-border text-muted-foreground",
      )}
    >
      <span className="sr-only">{t("zone.label")} </span>
      {mount.id}
      {inserting ? (
        <span className="sr-only"> {t("zone.targeted")}</span>
      ) : null}
    </span>
  );

  const unreadable =
    invalid.length === 0 ? null : (
      <InvalidZoneEntries entries={invalid} zoneId={mount.id} />
    );

  const body =
    blocks.length === 0 ? (
      <div
        className={cn(
          "flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center transition-colors md:min-h-40",
          PLACEHOLDER_CLASSES[dropping],
        )}
      >
        {rejected ? (
          notAllowed
        ) : (
          <>
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full border border-dashed transition-colors",
                inserting || over
                  ? "border-primary/60 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              <PlusIcon aria-hidden="true" className="size-5" />
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("zone.drop_here")}
            </p>
            {addBlock}
          </>
        )}
      </div>
    ) : (
      <ZoneSortable blockIds={blocks.map(instance => instance.id)}>
        {blocks.map((instance, index) => (
          <EditableBlockShell
            index={index}
            instance={instance}
            key={instance.id}
            zoneId={mount.id}
          >
            <EditableBlockBody
              entry={registry?.get(instance.type)}
              index={index}
              instance={instance}
            />
          </EditableBlockShell>
        ))}
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
        ZONE_CLASSES[dropping],
        mount.className,
      ),
      "data-editor-zone": dropping,
      ref: setNodeRef,
    },
    label,
    unreadable,
    body,
    footer,
  );
};
