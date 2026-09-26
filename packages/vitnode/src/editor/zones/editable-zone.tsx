import type { ReactElement } from "react";

import { cn } from "cn";
import { BanIcon, PlusIcon } from "lucide-react";
import { createElement, useEffect, useMemo } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { ContentZoneMount } from "../../blocks/edit-context";
import type {
  AnyBlockInstance,
  BlockRegistry,
  ContentNode,
  RegisteredBlock,
} from "../../blocks/types";
import type { EditorZoneMount } from "../state/types";
import type { ZoneDropTone } from "./drop-state";

import { isBlockAreaInstance } from "../../blocks/area";
import { resolveBlockRegistry } from "../../blocks/registry";
import { ContentRenderer } from "../../blocks/renderer";
import { EditableBlockShell } from "../block-shell/block-shell";
import { useVisualEditor } from "../context";
import { ContainerSortable } from "../dnd/container-sortable";
import { useZoneDroppable } from "../dnd/use-container-droppable";
import {
  fitsRootNodeCap,
  fitsZoneMax,
  zoneBlockCount,
  zoneRootNodeCount,
} from "../state/bounds";
import { EditableAreaFrame } from "./area-frame";
import {
  InvalidBlock,
  UnknownBlock,
  UnknownVariantBlock,
} from "./block-placeholder";
import { editableBlockRender } from "./block-render";
import { classifyZoneEntries } from "./classify";
import { zoneDropState, zoneDropTone } from "./drop-state";
import { InvalidZoneEntries } from "./invalid-entries";
import { DROP_TARGET_CLASSES } from "./node-chrome";
import { ZONE_REJECTION_LABELS } from "./rejection-labels";
import { zoneDisplayName } from "./zone-name";

const ZONE_CLASSES = {
  blocked: "outline-input opacity-50",
  idle: "outline-input hover:outline-muted-foreground/50",
  inserting: "bg-primary/3 outline-primary/70",
  over: "bg-primary/5 outline-primary",
  rejected: "bg-destructive/5 outline-destructive/70",
  targeting: "bg-primary/3 outline-primary/50",
} as const satisfies Record<ZoneDropTone, string>;

const HIGHLIGHTED_TONES: ReadonlySet<ZoneDropTone> = new Set([
  "inserting",
  "over",
  "targeting",
]);

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

  if (render.kind === "unknown-variant") {
    return <UnknownVariantBlock variant={render.variant} />;
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
    variant: render.variant,
  });
};

const EditableBlock = ({
  areaId,
  index,
  instance,
  registry,
  zoneId,
}: {
  areaId: null | string;
  index: number;
  instance: AnyBlockInstance;
  registry: BlockRegistry | undefined;
  zoneId: string;
}): ReactElement => {
  const entry = registry?.get(instance.type);

  return (
    <EditableBlockShell
      areaId={areaId}
      index={index}
      instance={instance}
      zoneId={zoneId}
    >
      <EditableBlockBody entry={entry} index={index} instance={instance} />
    </EditableBlockShell>
  );
};

export const EditableZone = ({
  mount,
}: {
  mount: ContentZoneMount;
}): null | ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch, insertTarget, preview, setInsertTarget, setPanel, state } =
    useVisualEditor();
  const { active, over, rejection, setNodeRef } = useZoneDroppable({
    zoneId: mount.id,
  });
  const { id } = mount;

  const incoming = useMemo((): EditorZoneMount => {
    const { invalid, nodes } = classifyZoneEntries(mount.blocks);

    return {
      allowedBlocks: mount.allowedBlocks,
      id: mount.id,
      invalid,
      max: mount.max,
      min: mount.min,
      nodes,
      registry: mount.registry,
    };
  }, [
    mount.allowedBlocks,
    mount.blocks,
    mount.id,
    mount.max,
    mount.min,
    mount.registry,
  ]);

  useEffect(() => {
    dispatch({ type: "mount", zone: incoming });
  }, [dispatch, incoming]);

  useEffect(
    () => () => {
      dispatch({ type: "unmount", zoneId: id });
    },
    [dispatch, id],
  );

  const zone = state.zones[mount.id];
  const nodes: readonly ContentNode[] = zone?.nodes ?? incoming.nodes;
  const invalid = zone?.invalid ?? incoming.invalid;

  if (preview) {
    return createElement(ContentRenderer, {
      allowed: mount.allowedBlocks,
      blocks: nodes,
      fallback: mount.fallback,
      registry: mount.registry,
      validate: mount.validate,
    });
  }

  const registry =
    nodes.length === 0
      ? undefined
      : resolveBlockRegistry(zone?.registry ?? mount.registry);
  const inserting = insertTarget?.zoneId === mount.id;
  const tone = zoneDropTone(
    zoneDropState({ active, inserting, over, rejected: rejection !== null }),
    over,
  );
  const highlighted = HIGHLIGHTED_TONES.has(tone);
  const full =
    !fitsZoneMax(mount.max, zoneBlockCount(nodes) + 1) ||
    !fitsRootNodeCap(zoneRootNodeCount(nodes) + 1);

  const addBlock = (
    <Button
      onClick={() => {
        setInsertTarget({
          areaId: null,
          index: nodes.length,
          zoneId: mount.id,
        });
        setPanel();
      }}
      size="sm"
      variant="outline"
    >
      <PlusIcon />
      {t("zone.add_block")}
    </Button>
  );

  const addAction = full ? (
    <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
      {t("zone.full")}
    </p>
  ) : (
    addBlock
  );

  const notAllowed = (
    <p className="text-destructive flex items-center gap-1.5 text-xs leading-relaxed text-pretty">
      <BanIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {t(
        rejection === null ? "zone.rejected" : ZONE_REJECTION_LABELS[rejection],
      )}
    </p>
  );

  return (
    <div
      className={cn(
        "relative rounded-md outline-1 outline-offset-4 transition-[outline-color,background-color,opacity] duration-150 ease-out outline-dashed motion-reduce:transition-none",
        ZONE_CLASSES[tone],
      )}
      data-editor-zone={tone}
      ref={setNodeRef}
    >
      <span
        className={cn(
          "bg-card pointer-events-none absolute start-3 -top-3.5 z-10 flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-relaxed font-medium shadow-xs transition-colors duration-150",
          highlighted
            ? "border-primary/50 text-primary"
            : "border-border text-muted-foreground",
        )}
      >
        <span className="sr-only">{t("zone.label")} </span>
        {zoneDisplayName(mount.id)}
        {inserting ? (
          <span className="sr-only"> {t("zone.targeted")}</span>
        ) : null}
      </span>

      {invalid.length === 0 ? null : (
        <InvalidZoneEntries entries={invalid} zoneId={mount.id} />
      )}

      {nodes.length === 0 ? (
        <div
          className={cn(
            "flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center transition-colors duration-150 md:min-h-40",
            DROP_TARGET_CLASSES[tone],
          )}
        >
          {tone === "rejected" ? (
            notAllowed
          ) : (
            <>
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full transition-colors duration-150",
                  highlighted
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                <PlusIcon aria-hidden="true" className="size-5" />
              </span>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {t("zone.drop_here")}
              </p>
              {addAction}
            </>
          )}
        </div>
      ) : (
        <>
          <ContainerSortable
            container={{ areaId: null, zoneId: mount.id }}
            nodes={nodes}
          >
            {nodes.map((node, index) =>
              isBlockAreaInstance(node) ? (
                <EditableAreaFrame
                  area={node}
                  index={index}
                  key={node.id}
                  zoneId={mount.id}
                >
                  <ContainerSortable
                    columns={node.layout.columns}
                    container={{ areaId: node.id, zoneId: mount.id }}
                    nodes={node.children}
                  >
                    {node.children.map((child, childIndex) => (
                      <EditableBlock
                        areaId={node.id}
                        index={childIndex}
                        instance={child}
                        key={child.id}
                        registry={registry}
                        zoneId={mount.id}
                      />
                    ))}
                  </ContainerSortable>
                </EditableAreaFrame>
              ) : (
                <EditableBlock
                  areaId={null}
                  index={index}
                  instance={node}
                  key={node.id}
                  registry={registry}
                  zoneId={mount.id}
                />
              ),
            )}
          </ContainerSortable>

          <div className="flex justify-center py-4">
            {tone === "rejected" ? notAllowed : addAction}
          </div>
        </>
      )}
    </div>
  );
};
