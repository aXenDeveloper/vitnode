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
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CornerDownRightIcon,
  CornerLeftUpIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PanelTopIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiIcon } from "@/components/ui/emoji-icon";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Loader } from "@/components/ui/loader";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { parseEmojiIcon } from "@/lib/emoji-icon";
import { navigationItemLabels } from "@/lib/navigation";
import { ADMIN_NAVIGATION_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminNavigationFormProps } from "./navigation-form-content";
import type { AdminNavigationItem } from "./navigation-query";
import type {
  FlattenedNavigationItem,
  NavigationDepth,
  NavigationOrderBody,
} from "./navigation-tree";

import { NavigationCreateDialog } from "./navigation-create-dialog";
import {
  useNavigationItemLabels,
  useNavigationTranslate,
} from "./navigation-labels";
import {
  applyNavigationDrop,
  childrenOfNavigation,
  flattenNavigationItems,
  moveNavigationItem,
  NAVIGATION_INDENTATION_PX,
  navigationItemIcon,
  navigationItemsFrom,
  navigationOrderBody,
  projectNavigationDrop,
  restoreCollapsedChildren,
  sameNavigationOrder,
  shiftNavigationItem,
  withoutNavigationChildrenOf,
} from "./navigation-tree";

export { usedNavigationPresetKeys } from "./navigation-create-dialog";

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

interface NavigationRowPermissions {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
}

interface NavigationRowActions {
  onAddChild: (parentId: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
  onMove: (id: number, parentId: null | number) => void;
  onShift: (id: number, step: -1 | 1) => void;
  onToggle: (id: number) => void;
}

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

const useNavigationItemName = (item: AdminNavigationItem) => {
  const { title } = useNavigationItemLabels(item);
  const href = item.kind === "preset" ? item.preset?.href : item.href;

  return title !== "" ? title : (href ?? String(item.id));
};

const NavigationItemGlyph = ({
  className,
  item,
}: {
  className?: string;
  item: AdminNavigationItem;
}) => {
  const icon = navigationItemIcon(item);
  if (icon) {
    return (
      <EmojiIcon
        className={cn("size-4", className)}
        value={parseEmojiIcon(icon)}
      />
    );
  }

  return item.kind === "preset" ? (
    <LayoutTemplateIcon aria-hidden className={cn("size-4", className)} />
  ) : (
    <LinkIcon aria-hidden className={cn("size-4", className)} />
  );
};

const NavigationSourceTag = ({ item }: { item: AdminNavigationItem }) => {
  const t = useTranslations("admin.navigation.list");

  if (item.kind === "custom") {
    return <span className="text-muted-foreground text-xs">{t("custom")}</span>;
  }
  if (item.preset === null) {
    return (
      <TooltipWithContent text={t("missing")}>
        <Badge variant="destructive">{t("pluginMissing")}</Badge>
      </TooltipWithContent>
    );
  }

  return <span className="text-muted-foreground text-xs">{item.pluginId}</span>;
};

const NavigationRowMenu = ({
  actions,
  entry,
  hasChildren,
  name,
  parents,
  permissions,
  siblingIndex,
  siblingsCount,
}: {
  actions: NavigationRowActions;
  entry: FlattenedNavigationItem;
  hasChildren: boolean;
  name: string;
  parents: AdminNavigationItem[];
  permissions: NavigationRowPermissions;
  siblingIndex: number;
  siblingsCount: number;
}) => {
  const t = useTranslations("admin.navigation.list");
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const { id } = entry.item;
  const canAddChild = permissions.canCreate && entry.depth === 0;
  const targets = parents.filter(parent => parent.id !== id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("actions", { name })}
            className="pointer-coarse:size-10"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {permissions.canEdit ? (
          <DropdownMenuItem
            onClick={() => {
              actions.onEdit(id);
            }}
          >
            <PencilIcon />
            {t("edit")}
          </DropdownMenuItem>
        ) : null}
        {canAddChild ? (
          <DropdownMenuItem
            onClick={() => {
              actions.onAddChild(id);
            }}
          >
            <PlusIcon />
            {t("addChild")}
          </DropdownMenuItem>
        ) : null}

        {permissions.canEdit ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={siblingIndex === 0}
              onClick={() => {
                actions.onShift(id, -1);
              }}
            >
              <ArrowUpIcon />
              {t("moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={siblingIndex === siblingsCount - 1}
              onClick={() => {
                actions.onShift(id, 1);
              }}
            >
              <ArrowDownIcon />
              {t("moveDown")}
            </DropdownMenuItem>
            {entry.depth === 1 ? (
              <DropdownMenuItem
                onClick={() => {
                  actions.onMove(id, null);
                }}
              >
                <CornerLeftUpIcon />
                {t("moveToTop")}
              </DropdownMenuItem>
            ) : hasChildren || targets.length === 0 ? null : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CornerDownRightIcon />
                  {t("moveInside")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {targets.map(parent => (
                    <DropdownMenuItem
                      key={parent.id}
                      onClick={() => {
                        actions.onMove(id, parent.id);
                      }}
                    >
                      <NavigationItemGlyph
                        className="text-muted-foreground"
                        item={parent}
                      />
                      <span className="truncate">
                        {[
                          navigationItemLabels({
                            item: parent,
                            locale,
                            translate,
                          }).title,
                          parent.href,
                        ].find(
                          (value): value is string =>
                            typeof value === "string" && value !== "",
                        ) ?? String(parent.id)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          </>
        ) : null}

        {permissions.canDelete ? (
          <>
            {permissions.canEdit || canAddChild ? (
              <DropdownMenuSeparator />
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                actions.onDelete(id);
              }}
              variant="destructive"
            >
              <Trash2Icon />
              {t("delete")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SortableNavigationRow = ({
  actions,
  childCount,
  depth,
  disabled,
  entry,
  isCollapsed,
  parents,
  permissions,
  siblingIndex,
  siblingsCount,
}: {
  actions: NavigationRowActions;
  childCount: number;
  depth: NavigationDepth;
  disabled: boolean;
  entry: FlattenedNavigationItem;
  isCollapsed: boolean;
  parents: AdminNavigationItem[];
  permissions: NavigationRowPermissions;
  siblingIndex: number;
  siblingsCount: number;
}) => {
  const t = useTranslations("admin.navigation.list");
  const name = useNavigationItemName(entry.item);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: !permissions.canEdit || disabled,
    id: entry.item.id,
  });

  const { item } = entry;
  const isPreset = item.kind === "preset";
  const isMissing = isPreset && item.preset === null;
  const href = isPreset ? item.preset?.href : item.href;
  const hasMenu =
    permissions.canEdit ||
    permissions.canDelete ||
    (permissions.canCreate && entry.depth === 0);

  const label = (
    <>
      <NavigationItemGlyph
        className="text-muted-foreground shrink-0"
        item={item}
      />
      <span
        className={cn(
          "truncate text-sm font-medium",
          isMissing && "text-muted-foreground",
        )}
      >
        {name}
      </span>
      {isCollapsed && childCount > 0 ? (
        <Badge className="tabular-nums" variant="secondary">
          {childCount}
        </Badge>
      ) : null}
      {item.isOpenInNewTab && !isMissing ? (
        <ExternalLinkIcon
          aria-label={t("opensInNewTab")}
          className="text-muted-foreground size-3.5 shrink-0"
          role="img"
        />
      ) : null}
      <span className="text-muted-foreground ms-auto hidden max-w-xs min-w-0 truncate ps-4 font-mono text-xs lg:block">
        {isMissing ? "—" : href}
      </span>
    </>
  );

  return (
    <li
      className="flex"
      data-depth={depth}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {depth === 1 ? (
        <span
          aria-hidden
          className="border-border ms-5 me-3 shrink-0 self-stretch border-s"
        />
      ) : null}

      <div
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg ps-1 pe-1.5 transition-colors duration-150",
          isDragging
            ? "border-primary/40 bg-primary/5 border border-dashed *:opacity-0"
            : "hover:bg-muted/50",
        )}
        data-testid={`navigation-item-${String(item.id)}`}
      >
        {permissions.canEdit ? (
          <Button
            aria-label={t("dragHandle", { name })}
            className="text-muted-foreground cursor-grab touch-none active:cursor-grabbing pointer-coarse:size-10"
            ref={setActivatorNodeRef}
            size="icon-sm"
            type="button"
            variant="ghost"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon />
          </Button>
        ) : null}

        {childCount > 0 ? (
          <Button
            aria-expanded={!isCollapsed}
            aria-label={t(isCollapsed ? "showChildren" : "hideChildren", {
              name,
            })}
            className="text-muted-foreground aria-expanded:bg-transparent pointer-coarse:size-10"
            onClick={() => {
              actions.onToggle(item.id);
            }}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <ChevronRightIcon
              className={cn(
                "transition-transform duration-150 motion-reduce:transition-none",
                !isCollapsed && "rotate-90",
              )}
            />
          </Button>
        ) : depth === 0 ? (
          <span aria-hidden className="size-6 shrink-0" />
        ) : null}

        {permissions.canEdit ? (
          <button
            className="focus-visible:ring-ring/50 flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-start outline-none focus-visible:ring-3"
            onClick={() => {
              actions.onEdit(item.id);
            }}
            type="button"
          >
            <span className="sr-only">{t("edit")}</span>
            {label}
          </button>
        ) : (
          <span className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-1.5">
            {label}
          </span>
        )}

        <span className="hidden w-32 shrink-0 truncate text-end sm:block">
          <NavigationSourceTag item={item} />
        </span>

        {hasMenu ? (
          <NavigationRowMenu
            actions={actions}
            entry={entry}
            hasChildren={childCount > 0}
            name={name}
            parents={parents}
            permissions={permissions}
            siblingIndex={siblingIndex}
            siblingsCount={siblingsCount}
          />
        ) : null}
      </div>
    </li>
  );
};

const NavigationDragChip = ({
  childCount,
  depth,
  item,
}: {
  childCount: number;
  depth: NavigationDepth;
  item: AdminNavigationItem;
}) => {
  const name = useNavigationItemName(item);

  return (
    <div className="flex cursor-grabbing">
      {depth === 1 ? (
        <span
          aria-hidden
          className="ms-5 me-3 shrink-0 self-stretch border-s border-transparent"
        />
      ) : null}

      <div className="bg-card text-card-foreground flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg ps-1 pe-1.5 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        <span
          aria-hidden
          className="text-muted-foreground flex size-8 shrink-0 items-center justify-center pointer-coarse:size-10"
        >
          <GripVerticalIcon className="size-4" />
        </span>
        {depth === 0 ? <span aria-hidden className="size-6 shrink-0" /> : null}
        <span className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5">
          <NavigationItemGlyph
            className="text-muted-foreground shrink-0"
            item={item}
          />
          <span className="truncate text-sm font-medium">{name}</span>
          {childCount > 0 ? (
            <Badge className="tabular-nums" variant="secondary">
              +{childCount}
            </Badge>
          ) : null}
        </span>
      </div>
    </div>
  );
};

const NavigationEditSheetBody = ({
  item,
  items,
  onSave,
  onSaved,
  presets,
}: {
  item: AdminNavigationItem;
  items: AdminNavigationItem[];
  onSave: AdminNavigationFormProps["onSave"];
  onSaved?: () => void;
  presets: NavigationPreset[];
}) => {
  const t = useTranslations("admin.navigation.edit");
  const name = useNavigationItemName(item);

  return (
    <>
      <SheetHeader className="border-b pe-12">
        <SheetTitle className="text-balance">{t("title")}</SheetTitle>
        <SheetDescription className="truncate">{name}</SheetDescription>
      </SheetHeader>

      <React.Suspense fallback={<Loader />}>
        <AdminNavigationFormContent
          data={item}
          items={items}
          onSave={onSave}
          onSaved={onSaved}
          presets={presets}
          surface="sheet"
        />
      </React.Suspense>
    </>
  );
};

const NavigationEditSheet = ({
  formKey,
  item,
  items,
  onOpenChange,
  onSave,
  onSaved,
  open,
  presets,
}: {
  formKey: number;
  item: AdminNavigationItem | undefined;
  items: AdminNavigationItem[];
  onOpenChange: (open: boolean) => void;
  onSave: AdminNavigationFormProps["onSave"];
  onSaved?: () => void;
  open: boolean;
  presets: NavigationPreset[];
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <SheetContent
      className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      side="right"
    >
      {item ? (
        <NavigationEditSheetBody
          item={item}
          items={items}
          key={formKey}
          onSave={onSave}
          onSaved={onSaved}
          presets={presets}
        />
      ) : null}
    </SheetContent>
  </Dialog>
);

const NavigationDeleteBody = ({
  childCount,
  item,
  onDelete,
  onOpenChange,
  onSaved,
}: {
  childCount: number;
  item: AdminNavigationItem;
  onDelete: NavigationAdminListProps["onDelete"];
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) => {
  const t = useTranslations("admin.navigation.delete");
  const tError = useTranslations("core.global.errors");
  const name = useNavigationItemName(item);
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
      onOpenChange(false);
      onSaved?.();
    });
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("title")}</AlertDialogTitle>
        <AlertDialogDescription className="text-pretty">
          {childCount > 0
            ? t("descWithChildren", { count: childCount, name })
            : t("desc", { name })}
        </AlertDialogDescription>
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
    </>
  );
};

const NavigationDeleteDialog = ({
  childCount,
  item,
  onOpenChange,
  open,
  ...props
}: Omit<React.ComponentProps<typeof NavigationDeleteBody>, "item"> & {
  item: AdminNavigationItem | undefined;
  open: boolean;
}) => (
  <AlertDialog onOpenChange={onOpenChange} open={open}>
    <AlertDialogContent>
      {item ? (
        <NavigationDeleteBody
          childCount={childCount}
          item={item}
          key={item.id}
          onOpenChange={onOpenChange}
          {...props}
        />
      ) : null}
    </AlertDialogContent>
  </AlertDialog>
);

const useOverlayTarget = (items: readonly AdminNavigationItem[]) => {
  const [target, setTarget] = React.useState<{
    id: null | number;
    item?: AdminNavigationItem;
    session: number;
  }>({ id: null, session: 0 });
  const [open, setOpen] = React.useState(false);

  return {
    item: items.find(candidate => candidate.id === target.id) ?? target.item,
    open,
    set: (id: number) => {
      setTarget(current => ({
        id,
        item: items.find(candidate => candidate.id === id),
        session: current.session + 1,
      }));
      setOpen(true);
    },
    setOpen,
    target,
  };
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
  const canCreate = useAdminStaffPermission(
    ADMIN_NAVIGATION_PERMISSIONS.create,
  );
  const canEdit = useAdminStaffPermission(ADMIN_NAVIGATION_PERMISSIONS.edit);
  const canDelete = useAdminStaffPermission(
    ADMIN_NAVIGATION_PERMISSIONS.delete,
  );
  const permissions = { canCreate, canDelete, canEdit };

  const [ordered, setOrdered] = React.useState(items);
  const [synced, setSynced] = React.useState(items);
  if (synced !== items) {
    setSynced(items);
    setOrdered(items);
  }

  const [collapsed, setCollapsed] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [activeId, setActiveId] = React.useState<null | number>(null);
  const [overId, setOverId] = React.useState<null | number>(null);
  const [offsetLeft, setOffsetLeft] = React.useState(0);
  const [isSaving, startSaving] = React.useTransition();
  const editing = useOverlayTarget(ordered);
  const deleting = useOverlayTarget(ordered);
  const creating = useOverlayTarget(ordered);

  const flattened = React.useMemo(
    () => flattenNavigationItems(ordered),
    [ordered],
  );
  const hidden = React.useMemo(() => {
    const map = new Map<number, FlattenedNavigationItem[]>();
    for (const id of collapsed) {
      const children = childrenOfNavigation(flattened, id);
      if (children.length > 0) map.set(id, children);
    }

    return map;
  }, [collapsed, flattened]);
  const shown = React.useMemo(
    () =>
      flattened.filter(
        entry => entry.parentId === null || !hidden.has(entry.parentId),
      ),
    [flattened, hidden],
  );
  const visible = React.useMemo(
    () =>
      activeId === null ? shown : withoutNavigationChildrenOf(shown, activeId),
    [activeId, shown],
  );

  const childCountOf = (id: number) =>
    childrenOfNavigation(flattened, id).length;
  const parents = flattened
    .filter(entry => entry.depth === 0)
    .map(entry => entry.item);
  const parentIds = parents
    .filter(parent => childCountOf(parent.id) > 0)
    .map(parent => parent.id);
  const nestedCount = flattened.length - parents.length;

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

  const commit = (next: FlattenedNavigationItem[]) => {
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
    const children = hidden.has(activeId ?? -1) ? [] : activeChildren;
    reset();

    if (!over || !target || source === undefined) return;

    commit(
      restoreCollapsedChildren(
        applyNavigationDrop({
          activeId: source.item.id,
          children,
          flattened: visible,
          overId: Number(over.id),
          projection: target,
        }),
        hidden,
      ),
    );
  };

  const expand = (id: number) => {
    setCollapsed(current => {
      const next = new Set(current);
      next.delete(id);

      return next;
    });
  };

  const actions: NavigationRowActions = {
    onAddChild: parentId => {
      expand(parentId);
      creating.set(parentId);
    },
    onDelete: deleting.set,
    onEdit: editing.set,
    onMove: (id, parentId) => {
      if (parentId !== null) expand(parentId);
      commit(moveNavigationItem({ flattened, id, parentId }));
    },
    onShift: (id, step) => {
      commit(shiftNavigationItem({ flattened, id, step }));
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
    <>
      <section
        aria-label={t("label")}
        className="bg-card grid grid-cols-1 overflow-hidden rounded-xl border"
      >
        <header className="flex min-h-11 items-center justify-between gap-2 border-b px-4 py-1.5">
          <p className="text-muted-foreground text-sm tabular-nums">
            {t("summary", {
              dropdowns: nestedCount,
              header: parents.length,
            })}
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
              {collapsed.size > 0 ? t("expandAll") : t("collapseAll")}
            </Button>
          ) : null}
        </header>

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
            <ul className="flex flex-col gap-0.5 p-1.5">
              {visible.map(entry => {
                const siblings = flattened.filter(
                  candidate => candidate.parentId === entry.parentId,
                );

                return (
                  <SortableNavigationRow
                    actions={actions}
                    childCount={childCountOf(entry.item.id)}
                    depth={
                      entry.item.id === activeId && projection
                        ? projection.depth
                        : entry.depth
                    }
                    disabled={isSaving}
                    entry={entry}
                    isCollapsed={collapsed.has(entry.item.id)}
                    key={entry.item.id}
                    parents={parents}
                    permissions={permissions}
                    siblingIndex={siblings.findIndex(
                      candidate => candidate.item.id === entry.item.id,
                    )}
                    siblingsCount={siblings.length}
                  />
                );
              })}
            </ul>
          </SortableContext>

          <DragOverlay
            dropAnimation={{
              duration: 180,
              easing: "cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {activeEntry ? (
              <NavigationDragChip
                childCount={activeChildren.length}
                depth={activeEntry.depth}
                item={activeEntry.item}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>

      <NavigationEditSheet
        formKey={editing.target.session}
        item={editing.item}
        items={ordered}
        onOpenChange={editing.setOpen}
        onSave={onSave}
        onSaved={onSaved}
        open={editing.open}
        presets={presets}
      />

      <NavigationCreateDialog
        items={ordered}
        onOpenChange={creating.setOpen}
        onSave={onSave}
        onSaved={onSaved}
        open={creating.open}
        parentId={creating.target.id}
        presets={presets}
        session={creating.target.session}
      />

      <NavigationDeleteDialog
        childCount={deleting.item ? childCountOf(deleting.item.id) : 0}
        item={deleting.item}
        onDelete={onDelete}
        onOpenChange={deleting.setOpen}
        onSaved={onSaved}
        open={deleting.open}
      />
    </>
  );
};
