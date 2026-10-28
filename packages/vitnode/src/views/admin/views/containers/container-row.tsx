import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CornerDownRightIcon,
  CornerLeftUpIcon,
  FolderIcon,
  GripVerticalIcon,
  LockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import type { AdminContentContainer } from "./container-request";

import { containerGuideLevels } from "./container-select";

export interface ContainerRowPermissions {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canMove: boolean;
}

export interface ContainerRowActions {
  /** Opens the access rules; absent when the collection has no access rules. */
  onAccess?: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
  onMoveInside: (id: number, parentId: number) => void;
  onMoveToRoot: (id: number) => void;
  /** Opens the publishing rules; absent when the collection has no policies. */
  onPolicies?: (id: number) => void;
  onShift: (id: number, step: -1 | 1) => void;
  onToggle: (id: number) => void;
}

export interface ContainerRowMoves {
  canAddChild: boolean;
  canMoveDown: boolean;
  canMoveToRoot: boolean;
  canMoveUp: boolean;
  parents: readonly AdminContentContainer[];
}

const IndentGuides = ({ depth }: { depth: number }) =>
  containerGuideLevels(depth).map(level => (
    <span
      aria-hidden
      className="border-border ms-3 w-3 shrink-0 self-stretch border-s"
      key={level}
    />
  ));

const ContainerGlyph = ({ icon }: { icon?: React.ReactNode }) => (
  <span
    aria-hidden
    className="text-muted-foreground flex shrink-0 items-center [&_svg]:size-4"
  >
    {icon ?? <FolderIcon />}
  </span>
);

const ContainerRowMenu = ({
  actions,
  container,
  moves,
  permissions,
}: {
  actions: ContainerRowActions;
  container: AdminContentContainer;
  moves: ContainerRowMoves;
  permissions: ContainerRowPermissions;
}) => {
  const t = useTranslations("core.containers.list");
  const tPolicies = useTranslations("core.containers.policies");
  const tAccess = useTranslations("core.access.admin");
  const { id, name } = container;
  const { onAccess, onPolicies } = actions;
  const showMoves =
    permissions.canMove &&
    (moves.canMoveUp ||
      moves.canMoveDown ||
      moves.canMoveToRoot ||
      moves.parents.length > 0);

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
        {permissions.canEdit && onPolicies ? (
          <DropdownMenuItem
            onClick={() => {
              onPolicies(id);
            }}
          >
            <ShieldCheckIcon />
            {tPolicies("action")}
          </DropdownMenuItem>
        ) : null}
        {permissions.canEdit && onAccess ? (
          <DropdownMenuItem
            onClick={() => {
              onAccess(id);
            }}
          >
            <LockIcon />
            {tAccess("action")}
          </DropdownMenuItem>
        ) : null}
        {moves.canAddChild ? (
          <DropdownMenuItem
            onClick={() => {
              actions.onAddChild(id);
            }}
          >
            <PlusIcon />
            {t("addChild")}
          </DropdownMenuItem>
        ) : null}

        {showMoves ? (
          <>
            {permissions.canEdit || moves.canAddChild ? (
              <DropdownMenuSeparator />
            ) : null}
            {moves.canMoveUp || moves.canMoveDown ? (
              <>
                <DropdownMenuItem
                  disabled={!moves.canMoveUp}
                  onClick={() => {
                    actions.onShift(id, -1);
                  }}
                >
                  <ArrowUpIcon />
                  {t("moveUp")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!moves.canMoveDown}
                  onClick={() => {
                    actions.onShift(id, 1);
                  }}
                >
                  <ArrowDownIcon />
                  {t("moveDown")}
                </DropdownMenuItem>
              </>
            ) : null}
            {moves.canMoveToRoot ? (
              <DropdownMenuItem
                onClick={() => {
                  actions.onMoveToRoot(id);
                }}
              >
                <CornerLeftUpIcon />
                {t("moveToTop")}
              </DropdownMenuItem>
            ) : null}
            {moves.parents.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CornerDownRightIcon />
                  {t("moveInside")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
                  {moves.parents.map(parent => (
                    <DropdownMenuItem
                      key={parent.id}
                      onClick={() => {
                        actions.onMoveInside(id, parent.id);
                      }}
                    >
                      <IndentGuides depth={parent.depth} />
                      <span className="truncate">{parent.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
          </>
        ) : null}

        {permissions.canDelete ? (
          <>
            {permissions.canEdit || moves.canAddChild || showMoves ? (
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

const ContainerRowExpander = ({
  childCount,
  isCollapsed,
  name,
  onToggle,
}: {
  childCount: number;
  isCollapsed: boolean;
  name: string;
  onToggle: () => void;
}) => {
  const t = useTranslations("core.containers.list");

  if (childCount === 0) {
    return <span aria-hidden className="size-6 shrink-0" />;
  }

  return (
    <Button
      aria-expanded={!isCollapsed}
      aria-label={t(isCollapsed ? "showChildren" : "hideChildren", { name })}
      className="text-muted-foreground aria-expanded:bg-transparent pointer-coarse:size-10"
      onClick={onToggle}
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
  );
};

const ContainerRowLabel = ({
  childCount,
  container,
  icon,
  isCollapsed,
}: {
  childCount: number;
  container: AdminContentContainer;
  icon?: React.ReactNode;
  isCollapsed: boolean;
}) => (
  <>
    <ContainerGlyph icon={icon} />
    <span className="truncate text-sm font-medium">{container.name}</span>
    {isCollapsed && childCount > 0 ? (
      <Badge className="tabular-nums" variant="secondary">
        +{childCount}
      </Badge>
    ) : null}
    <span className="text-muted-foreground ms-auto hidden max-w-xs min-w-0 truncate ps-4 font-mono text-xs sm:block">
      {container.slug}
    </span>
  </>
);

export const SortableContainerRow = ({
  actions,
  childCount,
  container,
  depth,
  disabled,
  icon,
  isCollapsed,
  isInvalidDrop,
  moves,
  permissions,
}: {
  actions: ContainerRowActions;
  childCount: number;
  container: AdminContentContainer;
  depth: number;
  disabled: boolean;
  icon?: React.ReactNode;
  isCollapsed: boolean;
  isInvalidDrop: boolean;
  moves: ContainerRowMoves;
  permissions: ContainerRowPermissions;
}) => {
  const t = useTranslations("core.containers.list");
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: !permissions.canMove || disabled,
    id: container.id,
  });
  const showMenu =
    permissions.canEdit ||
    permissions.canDelete ||
    moves.canAddChild ||
    permissions.canMove;

  return (
    <li
      className="flex"
      data-depth={depth}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <IndentGuides depth={depth} />

      <div
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg ps-1 pe-1.5 transition-colors duration-150",
          isDragging
            ? cn(
                "border border-dashed *:opacity-0",
                isInvalidDrop
                  ? "border-destructive bg-destructive/10"
                  : "border-primary/40 bg-primary/5",
              )
            : "hover:bg-muted/50",
        )}
        data-testid={`container-item-${String(container.id)}`}
      >
        {permissions.canMove ? (
          <Button
            aria-label={t("dragHandle", { name: container.name })}
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

        <ContainerRowExpander
          childCount={childCount}
          isCollapsed={isCollapsed}
          name={container.name}
          onToggle={() => {
            actions.onToggle(container.id);
          }}
        />

        {permissions.canEdit ? (
          <button
            className="focus-visible:ring-ring/50 flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-start outline-none focus-visible:ring-3"
            onClick={() => {
              actions.onEdit(container.id);
            }}
            type="button"
          >
            <span className="sr-only">{t("edit")}</span>
            <ContainerRowLabel
              childCount={childCount}
              container={container}
              icon={icon}
              isCollapsed={isCollapsed}
            />
          </button>
        ) : (
          <span className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-1.5">
            <ContainerRowLabel
              childCount={childCount}
              container={container}
              icon={icon}
              isCollapsed={isCollapsed}
            />
          </span>
        )}

        {showMenu ? (
          <ContainerRowMenu
            actions={actions}
            container={container}
            moves={moves}
            permissions={permissions}
          />
        ) : null}
      </div>
    </li>
  );
};

export const ContainerDragChip = ({
  container,
  depth,
  descendants,
  icon,
  isInvalidDrop,
}: {
  container: AdminContentContainer;
  depth: number;
  descendants: number;
  icon?: React.ReactNode;
  isInvalidDrop: boolean;
}) => (
  <div className="flex cursor-grabbing">
    {containerGuideLevels(depth).map(level => (
      <span aria-hidden className="ms-3 w-3 shrink-0" key={level} />
    ))}
    <div
      className={cn(
        "bg-card text-card-foreground flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg border ps-1 pe-1.5 shadow-lg",
        isInvalidDrop ? "border-destructive" : "border-primary/40",
      )}
    >
      <span
        aria-hidden
        className="text-muted-foreground flex size-8 shrink-0 items-center justify-center pointer-coarse:size-10"
      >
        <GripVerticalIcon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5">
        <ContainerGlyph icon={icon} />
        <span className="truncate text-sm font-medium">{container.name}</span>
        {descendants > 0 ? (
          <Badge className="tabular-nums" variant="secondary">
            +{descendants}
          </Badge>
        ) : null}
      </span>
    </div>
  </div>
);
