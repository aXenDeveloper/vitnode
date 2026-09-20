import type {
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
} from "@dnd-kit/core";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import {
  ExternalLinkIcon,
  GripVerticalIcon,
  LayoutTemplateIcon,
  LinkIcon,
  PanelTopIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { NavigationPreset } from "@/lib/navigation";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmojiIcon } from "@/components/ui/emoji-icon";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Loader } from "@/components/ui/loader";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { parseEmojiIcon } from "@/lib/emoji-icon";
import { navigationPresetKey } from "@/lib/navigation";
import { ADMIN_NAVIGATION_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminNavigationFormProps } from "./navigation-form-content";
import type { AdminNavigationItem } from "./navigation-query";
import type {
  FlattenedNavigationItem,
  NavigationDepth,
  NavigationOrderBody,
} from "./navigation-tree";

import { useNavigationItemLabels } from "./navigation-labels";
import {
  applyNavigationDrop,
  childrenOfNavigation,
  flattenNavigationItems,
  NAVIGATION_INDENTATION_PX,
  navigationItemIcon,
  navigationItemsFrom,
  navigationOrderBody,
  projectNavigationDrop,
  sameNavigationOrder,
  withoutNavigationChildrenOf,
} from "./navigation-tree";

const AdminNavigationFormContent = React.lazy(async () =>
  import("./navigation-form-content").then(module => ({
    default: module.AdminNavigationFormContent,
  })),
);

export interface NavigationAdminListProps {
  items: AdminNavigationItem[];
  onDelete: (id: number) => Promise<AdminMutationResult<unknown>>;
  onReorder: (
    body: NavigationOrderBody,
  ) => Promise<AdminMutationResult<unknown>>;
  onSave: AdminNavigationFormProps["onSave"];
  onSaved?: () => void;
  presets: NavigationPreset[];
}

export const usedNavigationPresetKeys = (
  items: readonly AdminNavigationItem[],
  except?: number,
): string[] =>
  items.flatMap(item =>
    item.kind === "preset" &&
    item.pluginId &&
    item.presetId &&
    item.id !== except
      ? [navigationPresetKey(item.pluginId, item.presetId)]
      : [],
  );

const navigationKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  args,
) => {
  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    event.preventDefault();
    const shift =
      event.code === "ArrowRight"
        ? NAVIGATION_INDENTATION_PX
        : -NAVIGATION_INDENTATION_PX;

    return {
      x: args.currentCoordinates.x + shift,
      y: args.currentCoordinates.y,
    };
  }

  return sortableKeyboardCoordinates(event, args);
};

const DeleteNavigationAction = ({
  item,
  name,
  onDelete,
  onSaved,
}: {
  item: AdminNavigationItem;
  name: string;
  onDelete: NavigationAdminListProps["onDelete"];
  onSaved?: () => void;
}) => {
  const t = useTranslations("admin.navigation.delete");
  const tError = useTranslations("core.global.errors");
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const result = await onDelete(item.id);

      if ("error" in result) {
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }

      toast.success(t("success"), { description: t("successDesc", { name }) });
      setOpen(false);
      onSaved?.();
    });
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <TooltipWithContent text={t("title")}>
        <AlertDialogTrigger
          render={
            <Button aria-label={t("title")} size="icon" variant="destructive" />
          }
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      </TooltipWithContent>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("desc", { name })}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <Button
            isLoading={isPending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const EditNavigationAction = ({
  item,
  items,
  onSave,
  onSaved,
  presets,
}: {
  item: AdminNavigationItem;
  items: AdminNavigationItem[];
  onSave: NavigationAdminListProps["onSave"];
  onSaved?: () => void;
  presets: NavigationPreset[];
}) => {
  const t = useTranslations("admin.navigation.edit");

  return (
    <Dialog>
      <TooltipWithContent text={t("title")}>
        <DialogTrigger
          render={
            <Button aria-label={t("title")} size="icon" variant="ghost" />
          }
        >
          <PencilIcon />
        </DialogTrigger>
      </TooltipWithContent>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <AdminNavigationFormContent
            data={item}
            onSave={onSave}
            onSaved={onSaved}
            presets={presets}
            usedPresetKeys={usedNavigationPresetKeys(items, item.id)}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

export const CreateNavigationAction = ({
  items,
  onSave,
  onSaved,
  presets,
}: {
  items: AdminNavigationItem[];
  onSave: NavigationAdminListProps["onSave"];
  onSaved?: () => void;
  presets: NavigationPreset[];
}) => {
  const t = useTranslations("admin.navigation.create");

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        {t("title")}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <AdminNavigationFormContent
            onSave={onSave}
            onSaved={onSaved}
            presets={presets}
            usedPresetKeys={usedNavigationPresetKeys(items)}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

/** The grip, as the row under the cursor wears it: seen, not grabbed again. */
const NavigationDragHandleGhost = () => (
  <span
    aria-hidden
    className="text-muted-foreground -ms-2 flex size-9 shrink-0 cursor-grabbing items-center justify-center"
  >
    <GripVerticalIcon className="size-4" />
  </span>
);

const NavigationRowContent = ({
  actions,
  handle,
  item,
}: {
  actions?: React.ReactNode;
  handle?: React.ReactNode;
  item: AdminNavigationItem;
}) => {
  const t = useTranslations("admin.navigation.list");
  const { description, title } = useNavigationItemLabels(item);

  const isPreset = item.kind === "preset";
  const isMissing = isPreset && item.preset === null;
  const href = isPreset ? item.preset?.href : item.href;
  const name = title !== "" ? title : (href ?? String(item.id));
  const icon = navigationItemIcon(item);

  return (
    <Item
      className="bg-card"
      data-testid={`navigation-item-${String(item.id)}`}
      role="listitem"
      variant="outline"
    >
      {handle}

      <ItemMedia variant="icon">
        {icon ? (
          <EmojiIcon className="size-4" value={parseEmojiIcon(icon)} />
        ) : isPreset ? (
          <LayoutTemplateIcon />
        ) : (
          <LinkIcon />
        )}
      </ItemMedia>

      <ItemContent>
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <span className={isMissing ? "text-muted-foreground" : undefined}>
            {name}
          </span>
          {isMissing ? (
            <Badge variant="destructive">{t("prebuilt")}</Badge>
          ) : null}
          {isPreset ? null : <Badge variant="secondary">{t("custom")}</Badge>}
          {isPreset && item.pluginId ? (
            <span className="text-muted-foreground text-xs">
              {t("from", { plugin: item.pluginId })}
            </span>
          ) : null}
        </ItemTitle>

        {description ? (
          <ItemDescription className="text-pretty">
            {description}
          </ItemDescription>
        ) : null}

        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-xs">
          <span className="truncate">{isMissing ? t("missing") : href}</span>
          {item.isOpenInNewTab && !isMissing ? (
            <TooltipWithContent text={t("opensInNewTab")}>
              <ExternalLinkIcon
                aria-label={t("opensInNewTab")}
                className="size-3.5 shrink-0"
                role="img"
              />
            </TooltipWithContent>
          ) : null}
        </span>
      </ItemContent>

      {actions ? <ItemActions>{actions}</ItemActions> : null}
    </Item>
  );
};

const rowName = (item: AdminNavigationItem, title: string): string => {
  const href = item.kind === "preset" ? item.preset?.href : item.href;

  return title !== "" ? title : (href ?? String(item.id));
};

const SortableNavigationRow = ({
  canDelete,
  canEdit,
  depth,
  disabled,
  entry,
  items,
  onDelete,
  onSave,
  onSaved,
  presets,
}: {
  canDelete: boolean;
  canEdit: boolean;
  depth: NavigationDepth;
  disabled: boolean;
  entry: FlattenedNavigationItem;
  items: AdminNavigationItem[];
  onDelete: NavigationAdminListProps["onDelete"];
  onSave: NavigationAdminListProps["onSave"];
  onSaved?: () => void;
  presets: NavigationPreset[];
}) => {
  const t = useTranslations("admin.navigation.list");
  const { title } = useNavigationItemLabels(entry.item);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled: !canEdit || disabled, id: entry.item.id });

  const name = rowName(entry.item, title);

  return (
    <div
      className={cn(depth === 1 && "ms-10", isDragging && "opacity-40")}
      data-depth={depth}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <NavigationRowContent
        actions={
          canEdit || canDelete ? (
            <>
              {canEdit ? (
                <EditNavigationAction
                  item={entry.item}
                  items={items}
                  onSave={onSave}
                  onSaved={onSaved}
                  presets={presets}
                />
              ) : null}
              {canDelete ? (
                <DeleteNavigationAction
                  item={entry.item}
                  name={name}
                  onDelete={onDelete}
                  onSaved={onSaved}
                />
              ) : null}
            </>
          ) : undefined
        }
        handle={
          canEdit ? (
            <Button
              aria-label={t("dragHandle", { name })}
              className="text-muted-foreground -ms-2 shrink-0 cursor-grab touch-none active:cursor-grabbing"
              disabled={disabled}
              ref={setActivatorNodeRef}
              size="icon"
              type="button"
              variant="ghost"
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon />
            </Button>
          ) : undefined
        }
        item={entry.item}
      />
    </div>
  );
};

export const NavigationAdminListContent = ({
  items,
  onDelete,
  onReorder,
  onSave,
  onSaved,
  presets,
}: NavigationAdminListProps) => {
  const t = useTranslations("admin.navigation.list");
  const tError = useTranslations("core.global.errors");
  const canEdit = useAdminStaffPermission(ADMIN_NAVIGATION_PERMISSIONS.edit);
  const canDelete = useAdminStaffPermission(
    ADMIN_NAVIGATION_PERMISSIONS.delete,
  );

  const [ordered, setOrdered] = React.useState(items);
  const [synced, setSynced] = React.useState(items);
  if (synced !== items) {
    setSynced(items);
    setOrdered(items);
  }

  const [activeId, setActiveId] = React.useState<null | number>(null);
  const [overId, setOverId] = React.useState<null | number>(null);
  const [offsetLeft, setOffsetLeft] = React.useState(0);
  const [isSaving, startSaving] = React.useTransition();

  const flattened = React.useMemo(
    () => flattenNavigationItems(ordered),
    [ordered],
  );
  const visible = React.useMemo(
    () =>
      activeId === null
        ? flattened
        : withoutNavigationChildrenOf(flattened, activeId),
    [activeId, flattened],
  );
  const activeEntry =
    activeId === null
      ? undefined
      : flattened.find(entry => entry.item.id === activeId);
  const activeChildren =
    activeId === null ? [] : childrenOfNavigation(flattened, activeId);

  const projectionFor = (target: null | number) =>
    activeId !== null && target !== null
      ? projectNavigationDrop({
          activeHasChildren: activeChildren.length > 0,
          activeId,
          flattened: visible,
          indentationWidth: NAVIGATION_INDENTATION_PX,
          offsetLeft,
          overId: target,
        })
      : null;
  const projection = projectionFor(overId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: navigationKeyboardCoordinates,
    }),
  );

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
    const target = over ? projectionFor(Number(over.id)) : null;
    const source = activeEntry;
    const children = activeChildren;
    reset();

    if (!over || !target || source === undefined) return;

    const next = applyNavigationDrop({
      activeId: source.item.id,
      children,
      flattened: visible,
      overId: Number(over.id),
      projection: target,
    });
    const body = navigationOrderBody(next);
    if (sameNavigationOrder(body, navigationOrderBody(flattened))) return;

    const previous = ordered;
    setOrdered(navigationItemsFrom(next));

    startSaving(async () => {
      const result = await onReorder(body);

      if ("error" in result) {
        setOrdered(previous);
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }

      toast.success(t("reorderSuccess"), {
        description: t("reorderSuccessDesc"),
      });
      onSaved?.();
    });
  };

  if (ordered.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PanelTopIcon />
          </EmptyMedia>
          <EmptyTitle>{t("noResults.title")}</EmptyTitle>
          <EmptyDescription>{t("noResults.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext
        collisionDetection={closestCenter}
        id="admin-navigation"
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragCancel={reset}
        onDragEnd={onDragEnd}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        <SortableContext
          items={visible.map(entry => entry.item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ItemGroup className="gap-2">
            {visible.map(entry => (
              <SortableNavigationRow
                canDelete={canDelete}
                canEdit={canEdit}
                depth={
                  entry.item.id === activeId && projection
                    ? projection.depth
                    : entry.depth
                }
                disabled={isSaving}
                entry={entry}
                items={ordered}
                key={entry.item.id}
                onDelete={onDelete}
                onSave={onSave}
                onSaved={onSaved}
                presets={presets}
              />
            ))}
          </ItemGroup>
        </SortableContext>

        <DragOverlay>
          {activeEntry ? (
            <NavigationRowContent
              handle={<NavigationDragHandleGhost />}
              item={activeEntry.item}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
