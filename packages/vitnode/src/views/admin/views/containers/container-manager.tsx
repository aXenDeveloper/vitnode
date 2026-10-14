import type {
  Announcements,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
  UniqueIdentifier,
} from "@dnd-kit/core";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "cn";
import { FolderTreeIcon, PlusIcon, RotateCwIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentContainerLabels } from "@/content/admin/containers";
import type { AnyContentContainerDefinition } from "@/content/containers/types";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { planContentContainerCreate } from "@/content/containers/tree";
import { DragLift } from "@/lib/dnd/drag-lift";
import {
  DRAG_OVERLAY_LIFT_CLASS,
  LIFTED_DROP_ANIMATION,
} from "@/lib/dnd/drag-motion";
import { FinePointerSensor } from "@/lib/dnd/sensors";
import { isAdminRequestError } from "@/views/admin/admin-request";

import type { ContentContainerSave } from "./container-form-content";
import type { ContentContainerPoliciesSave } from "./container-policies-form";
import type {
  AdminContentContainer,
  ContentContainerMutationResult,
} from "./container-request";
import type { ContainerDropProjection } from "./container-tree";

import {
  ContentContainerDeleteDialog,
  ContentContainerPoliciesSheet,
  ContentContainerSheet,
} from "./container-dialogs";
import { contentContainerErrorKey } from "./container-query";
import {
  ContainerDragChip,
  type ContainerRowActions,
  type ContainerRowMoves,
  SortableContainerRow,
} from "./container-row";
import {
  applyContainerPlacements,
  canRearrangeContainers,
  checkContainerMove,
  CONTAINER_INDENTATION_PX,
  containerChildCounts,
  containerDescendants,
  containerParentTargets,
  containerSiblings,
  containerTreeRules,
  projectContainerDrop,
  rootContainerMove,
  shiftContainerMove,
  visibleContainers,
} from "./container-tree";

export interface ContentContainerManagerProps {
  definition: AnyContentContainerDefinition;
  error?: unknown;
  icon?: React.ReactNode;
  isPending: boolean;
  labels: ContentContainerLabels;
  onDelete: (id: number) => Promise<ContentContainerMutationResult<null>>;
  onMove: (move: {
    id: number;
    parentId: null | number;
    position: number;
  }) => Promise<ContentContainerMutationResult<null>>;
  onRetry: () => void;
  onSave: ContentContainerSave;
  onSavePolicies?: ContentContainerPoliciesSave;
  pluginId: string;
  records: AdminContentContainer[] | undefined;
}

const containerKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  args,
) => {
  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    event.preventDefault();

    return {
      x:
        args.currentCoordinates.x +
        (event.code === "ArrowRight"
          ? CONTAINER_INDENTATION_PX
          : -CONTAINER_INDENTATION_PX),
      y: args.currentCoordinates.y,
    };
  }

  return sortableKeyboardCoordinates(event, args);
};

const subscribeToNothing = () => () => undefined;
const getAnnouncementContainer = () => document.body;
const getNoAnnouncementContainer = () => null;

const ContainerListSkeleton = () => (
  <div
    aria-hidden
    className="bg-card flex flex-col gap-1.5 rounded-xl border p-1.5"
  >
    {["w-48", "w-40", "w-56", "w-36"].map((width, index) => (
      <div className="flex h-11 items-center gap-3 px-2" key={width}>
        {index % 2 === 1 ? <span className="w-6 shrink-0" /> : null}
        <Skeleton className="size-4 rounded" />
        <Skeleton className={cn("h-4", width)} />
      </div>
    ))}
  </div>
);

const ContainerListError = ({
  error,
  onRetry,
  plural,
}: {
  error: unknown;
  onRetry: () => void;
  plural: string;
}) => {
  const t = useTranslations("core.containers.error");
  const forbidden = isAdminRequestError(error) && error.status === 403;

  return (
    <Empty className="border" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderTreeIcon />
        </EmptyMedia>
        <EmptyTitle>{t("title", { name: plural })}</EmptyTitle>
        <EmptyDescription>
          {t(forbidden ? "forbidden" : "desc")}
        </EmptyDescription>
      </EmptyHeader>
      {forbidden ? null : (
        <EmptyContent>
          <Button onClick={onRetry} variant="outline">
            <RotateCwIcon />
            {t("retry")}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
};

const useOverlay = () => {
  const [state, setState] = React.useState<{
    id: null | number;
    isOpen: boolean;
    parentId: null | number;
    session: number;
  }>({ id: null, isOpen: false, parentId: null, session: 0 });

  return {
    ...state,
    setOpen: (isOpen: boolean) => {
      setState(current => ({ ...current, isOpen }));
    },
    show: (next: { id?: number; parentId?: null | number }) => {
      setState(current => ({
        id: next.id ?? null,
        isOpen: true,
        parentId: next.parentId ?? null,
        session: current.session + 1,
      }));
    },
  };
};

export const ContentContainerManager = ({
  definition,
  error,
  icon,
  isPending,
  labels,
  onDelete,
  onMove,
  onRetry,
  onSave,
  onSavePolicies,
  pluginId,
  records,
}: ContentContainerManagerProps) => {
  const t = useTranslations("core.containers");
  const reduceMotion = useReducedMotion();
  const rules = containerTreeRules(definition);
  const permissionOf = (permission: string) => ({
    module: definition.admin.permissionModule,
    permission,
    plugin: pluginId,
  });
  const canCreate = useAdminStaffPermission(
    permissionOf(CONTENT_PERMISSIONS.create),
  );
  const canEdit = useAdminStaffPermission(
    permissionOf(CONTENT_PERMISSIONS.edit),
  );
  const canDelete = useAdminStaffPermission(
    permissionOf(CONTENT_PERMISSIONS.delete),
  );
  const canMove = canEdit && canRearrangeContainers(rules);
  const permissions = { canCreate, canDelete, canEdit, canMove };

  const [ordered, setOrdered] = React.useState(records ?? []);
  const [synced, setSynced] = React.useState(records);
  if (synced !== records) {
    setSynced(records);
    setOrdered(records ?? []);
  }

  const [collapsed, setCollapsed] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [activeId, setActiveId] = React.useState<null | number>(null);
  const [overId, setOverId] = React.useState<null | number>(null);
  const [offsetLeft, setOffsetLeft] = React.useState(0);
  const [isMoving, startMoving] = React.useTransition();
  const sheet = useOverlay();
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create");
  const deleting = useOverlay();
  const policies = useOverlay();
  const announcementContainer = React.useSyncExternalStore(
    subscribeToNothing,
    getAnnouncementContainer,
    getNoAnnouncementContainer,
  );

  const childCounts = React.useMemo(
    () => containerChildCounts(ordered),
    [ordered],
  );
  const shown = React.useMemo(
    () => visibleContainers(ordered, collapsed),
    [collapsed, ordered],
  );
  const activeDescendants = React.useMemo(
    () => (activeId === null ? [] : containerDescendants(ordered, activeId)),
    [activeId, ordered],
  );
  const visible = React.useMemo(() => {
    if (activeDescendants.length === 0) return shown;
    const travelling = new Set(activeDescendants.map(record => record.id));

    return shown.filter(record => !travelling.has(record.id));
  }, [activeDescendants, shown]);
  const parentIds = ordered
    .filter(record => (childCounts.get(record.id) ?? 0) > 0)
    .map(record => record.id);

  const activeRecord =
    activeId === null
      ? undefined
      : ordered.find(record => record.id === activeId);
  const nameOf = (id: UniqueIdentifier) =>
    ordered.find(record => record.id === Number(id))?.name ?? String(id);

  const projectionFor = (
    target: null | number,
  ): ContainerDropProjection | null =>
    activeId !== null && target !== null
      ? projectContainerDrop({
          activeId,
          offsetLeft,
          overId: target,
          records: ordered,
          rules,
          visible,
        })
      : null;
  const projection = projectionFor(overId);

  const sensors = useSensors(
    useSensor(FinePointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: containerKeyboardCoordinates,
    }),
  );

  const expand = (id: number) => {
    setCollapsed(current => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);

      return next;
    });
  };

  const commitMove = (move: {
    id: number;
    parentId: null | number;
    position: number;
  }) => {
    const name = nameOf(move.id);
    const check = checkContainerMove(ordered, move, rules);
    if (check.kind === "unchanged") return;
    if (check.kind === "invalid") {
      toast.error(t("list.moveFailed", { name }), {
        description: t(`errors.${check.code}`),
      });

      return;
    }

    const previous = ordered;
    setOrdered(applyContainerPlacements(ordered, check.placements, rules));
    if (move.parentId !== null) expand(move.parentId);

    startMoving(async () => {
      const result = await onMove(move);

      if ("error" in result) {
        setOrdered(previous);
        toast.error(t("list.moveFailed", { name }), {
          description: t(contentContainerErrorKey(result.error)),
        });

        return;
      }

      toast.success(t("list.moveSuccess"), {
        description: t("list.moveSuccessDesc", { name }),
      });
    });
  };

  const describeDrop = (
    kind: "dropped" | "over",
    id: UniqueIdentifier,
    target: null | number,
  ): string => {
    const name = nameOf(id);
    const drop = projectionFor(target);
    if (!drop || drop.check.kind === "unchanged") {
      return t("dnd.unchanged", { name });
    }
    if (drop.check.kind === "invalid") {
      return t(`dnd.${kind}Invalid`, {
        name,
        reason: t(`errors.${drop.check.code}`),
      });
    }

    const values = {
      name,
      position: drop.position + 1,
      sorted: String(rules.mode === "alphabetical"),
    };

    return drop.parentId === null
      ? t(`dnd.${kind}Root`, values)
      : t(`dnd.${kind}Inside`, { ...values, parent: nameOf(drop.parentId) });
  };

  const announcements: Announcements = {
    onDragCancel: ({ active }) =>
      t("dnd.cancelled", { name: nameOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? describeDrop("dropped", active.id, Number(over.id))
        : t("dnd.cancelled", { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? describeDrop("over", active.id, Number(over.id)) : undefined,
    onDragStart: ({ active }) => t("dnd.started", { name: nameOf(active.id) }),
  };

  const reset = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(Number(active.id));
    setOverId(Number(active.id));
    setOffsetLeft(0);
  };

  const onDragMove = ({ delta }: DragMoveEvent) => {
    setOffsetLeft(delta.x);
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? Number(over.id) : null);
  };

  const onDragEnd = ({ over }: DragEndEvent) => {
    const dragged = activeId;
    const drop = over ? projectionFor(Number(over.id)) : null;
    reset();

    if (dragged === null || !drop) return;
    if (drop.check.kind === "invalid") {
      toast.error(t("list.moveFailed", { name: nameOf(dragged) }), {
        description: t(`errors.${drop.check.code}`),
      });

      return;
    }

    commitMove({
      id: dragged,
      parentId: drop.parentId,
      position: drop.position,
    });
  };

  const actions: ContainerRowActions = {
    onAddChild: parentId => {
      expand(parentId);
      setSheetMode("create");
      sheet.show({ parentId });
    },
    onDelete: id => {
      deleting.show({ id });
    },
    onEdit: id => {
      setSheetMode("edit");
      sheet.show({ id });
    },
    onMoveInside: (id, parentId) => {
      commitMove({ id, parentId, position: childCounts.get(parentId) ?? 0 });
    },
    onMoveToRoot: id => {
      const move = rootContainerMove(ordered, id);
      if (move) commitMove(move);
    },
    onPolicies:
      definition.policies.enabled && onSavePolicies
        ? id => {
            policies.show({ id });
          }
        : undefined,
    onShift: (id, step) => {
      const move = shiftContainerMove(ordered, id, step);
      if (move) commitMove(move);
    },
    onToggle: id => {
      setCollapsed(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);

        return next;
      });
    },
  };

  const movesOf = (record: AdminContentContainer): ContainerRowMoves => {
    const canAddChild =
      canCreate &&
      planContentContainerCreate(
        ordered,
        { parentId: record.id, position: undefined },
        rules,
      ).ok;

    if (!canMove || isMoving) {
      return {
        canAddChild,
        canMoveDown: false,
        canMoveToRoot: false,
        canMoveUp: false,
        parents: [],
      };
    }

    const siblings = containerSiblings(ordered, record.parentId);
    const at = siblings.findIndex(entry => entry.id === record.id);
    const manual = rules.mode === "manual";

    return {
      canAddChild,
      canMoveDown: manual && at < siblings.length - 1,
      canMoveToRoot: rules.hierarchy && record.parentId !== null,
      canMoveUp: manual && at > 0,
      parents: containerParentTargets(ordered, record.id, rules),
    };
  };

  const openCreate = () => {
    setSheetMode("create");
    sheet.show({});
  };

  const createButton = canCreate ? (
    <Button onClick={openCreate}>
      <PlusIcon />
      {t("create.title", { name: labels.singular })}
    </Button>
  ) : null;

  const renderBody = () => {
    if (records === undefined && isPending) return <ContainerListSkeleton />;

    if (records === undefined) {
      return (
        <ContainerListError
          error={error}
          onRetry={onRetry}
          plural={labels.plural}
        />
      );
    }

    if (ordered.length === 0) {
      return (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderTreeIcon />
            </EmptyMedia>
            <EmptyTitle className="text-balance">
              {t("empty.title", { name: labels.plural })}
            </EmptyTitle>
            <EmptyDescription className="text-pretty">
              {t("empty.desc")}
            </EmptyDescription>
          </EmptyHeader>
          {createButton ? <EmptyContent>{createButton}</EmptyContent> : null}
        </Empty>
      );
    }

    return (
      <section
        aria-busy={isMoving}
        aria-label={t("list.label", { name: labels.plural })}
        className="bg-card grid grid-cols-1 overflow-hidden rounded-xl border"
      >
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b px-4 py-1.5">
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty tabular-nums">
            {[
              t("list.summary", { count: ordered.length }),
              rules.hierarchy
                ? t("list.depth", { max: rules.maxDepth })
                : t("list.flat"),
              ...(rules.mode === "alphabetical" ? [t("list.sorted")] : []),
            ].join(" · ")}
          </p>
          {parentIds.length > 0 ? (
            <Button
              onClick={() => {
                setCollapsed(
                  collapsed.size > 0 ? new Set() : new Set(parentIds),
                );
              }}
              size="sm"
              variant="ghost"
            >
              {collapsed.size > 0 ? t("list.expandAll") : t("list.collapseAll")}
            </Button>
          ) : null}
        </header>

        <DndContext
          accessibility={{
            announcements,
            container: announcementContainer ?? undefined,
            screenReaderInstructions: { draggable: t("dnd.instructions") },
          }}
          collisionDetection={closestCenter}
          id={`admin-containers-${definition.id}`}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragCancel={reset}
          onDragEnd={onDragEnd}
          onDragMove={onDragMove}
          onDragOver={onDragOver}
          onDragStart={onDragStart}
          sensors={sensors}
        >
          <SortableContext
            items={visible.map(record => record.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-0.5 p-1.5">
              {visible.map(record => {
                const isActive = record.id === activeId;

                return (
                  <SortableContainerRow
                    actions={actions}
                    childCount={childCounts.get(record.id) ?? 0}
                    container={record}
                    depth={
                      isActive && projection ? projection.depth : record.depth
                    }
                    disabled={isMoving}
                    icon={icon}
                    isCollapsed={collapsed.has(record.id)}
                    isInvalidDrop={
                      isActive && projection?.check.kind === "invalid"
                    }
                    key={record.id}
                    moves={movesOf(record)}
                    permissions={permissions}
                  />
                );
              })}
            </ul>
          </SortableContext>

          <DragOverlay
            dropAnimation={reduceMotion ? null : LIFTED_DROP_ANIMATION}
          >
            {activeRecord ? (
              <DragLift>
                <div className={cn("rounded-lg", DRAG_OVERLAY_LIFT_CLASS)}>
                  <ContainerDragChip
                    container={activeRecord}
                    depth={projection?.depth ?? activeRecord.depth}
                    descendants={activeDescendants.length}
                    icon={icon}
                    isInvalidDrop={projection?.check.kind === "invalid"}
                  />
                </div>
              </DragLift>
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>
    );
  };

  const sheetContainer =
    sheet.id === null
      ? undefined
      : ordered.find(record => record.id === sheet.id);
  const policiesContainer =
    policies.id === null
      ? undefined
      : ordered.find(record => record.id === policies.id);
  const deletingContainer =
    deleting.id === null
      ? undefined
      : ordered.find(record => record.id === deleting.id);

  return (
    <>
      <PageTitle desc={labels.desc} h1={labels.title}>
        {records === undefined || ordered.length === 0 ? null : createButton}
      </PageTitle>

      {renderBody()}

      <ContentContainerSheet
        container={sheetContainer}
        definition={definition}
        formKey={sheet.session}
        labels={labels}
        mode={sheetMode}
        onOpenChange={sheet.setOpen}
        onSave={onSave}
        open={sheet.isOpen}
        parentId={sheet.parentId}
        pluginId={pluginId}
        records={ordered}
        rules={rules}
      />

      {definition.policies.enabled && onSavePolicies ? (
        <ContentContainerPoliciesSheet
          container={policiesContainer}
          definition={definition}
          formKey={policies.session}
          onOpenChange={policies.setOpen}
          onSavePolicies={onSavePolicies}
          open={policies.isOpen}
          pluginId={pluginId}
          records={ordered}
          singular={labels.singular}
        />
      ) : null}

      <ContentContainerDeleteDialog
        childCount={
          deletingContainer ? (childCounts.get(deletingContainer.id) ?? 0) : 0
        }
        container={deletingContainer}
        onDelete={onDelete}
        onOpenChange={deleting.setOpen}
        open={deleting.isOpen}
        singular={labels.singular}
      />
    </>
  );
};
