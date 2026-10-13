import { cn } from "cn";
import {
  ChevronRightIcon,
  GlobeIcon,
  ListChecksIcon,
  LockIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type {
  PermissionsStaffArgs,
  PermissionStaffScope,
  PermissionStaffType,
} from "@/api/lib/permission-staff";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  StaffModuleGroup,
  StaffPermissionItem,
  StaffPluginGroup,
  StaffScopeFamily,
  StaffScopeIssue,
} from "@/views/admin/views/core/staff/staff-model";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  countGrantedStaffPermissions,
  isStaffPermissionLocked,
  setStaffPermissionsChecked,
  staffPermissionDependents,
  staffPermissionItems,
  staffPermissionsForSubmit,
  staffScopeIssues,
  toggleStaffPermission,
} from "@/views/admin/views/core/staff/staff-model";

import { SelectableCard } from "../selectable-card";

const StaffScopeDialogContent = React.lazy(
  async () => await import("./scope/scope-dialog"),
);

export interface StaffRowIssue {
  dependency?: string;
  type: string;
}

const issuesFromResponse = (message: string | undefined): StaffScopeIssue[] => {
  if (!message) return [];
  try {
    const body: unknown = JSON.parse(message);
    if (
      typeof body === "object" &&
      body !== null &&
      "issues" in body &&
      Array.isArray(body.issues)
    ) {
      return body.issues as StaffScopeIssue[];
    }
  } catch {
    return [];
  }

  return [];
};

export interface EditStaffFormProps {
  families: StaffScopeFamily[];
  grantedKeys: readonly string[];
  grantedScopes?: Readonly<Record<string, PermissionStaffScope>>;
  id: string;
  /** Performs the write. */
  onSave: (args: {
    id: string;
    permissions: PermissionsStaffArgs[];
    type: PermissionStaffType;
    unrestricted: boolean;
  }) => Promise<AdminMutationResult<unknown>>;
  /** Called after a save the API accepted - navigation, cache, or both. */
  onSaved: () => Promise<void> | void;
  plugins: StaffPluginGroup[];
  type: PermissionStaffType;
  unrestricted: boolean;
}

type Translate = ReturnType<typeof useTranslations<"admin.staff.edit">>;

const CountBadge = ({ granted, total }: { granted: number; total: number }) => {
  const isFull = total > 0 && granted === total;

  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        isFull
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {granted}/{total}
    </span>
  );
};

const ScopeSummary = ({
  issues,
  labelByKey,
  onEdit,
  permission,
  scope,
  t,
}: {
  issues: StaffRowIssue[];
  labelByKey: Map<string, string>;
  onEdit: () => void;
  permission: StaffPermissionItem;
  scope: PermissionStaffScope | undefined;
  t: Translate;
}) => {
  const issueText = (issue: StaffRowIssue) =>
    t(`scope.issues.${issue.type}` as "scope.issues.missing_scope", {
      dependency: issue.dependency
        ? (labelByKey.get(issue.dependency) ?? issue.dependency)
        : "",
      permission: permission.label,
    });

  return (
    <div className="flex flex-col gap-2 ps-11 pe-4 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        {scope ? (
          <span className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium">
            {scope.mode === "all" ? (
              <GlobeIcon aria-hidden className="size-3.5" />
            ) : (
              <ListChecksIcon aria-hidden className="size-3.5" />
            )}
            {scope.mode === "all"
              ? t("scope.all")
              : t("scope.selected", { count: scope.ids.length })}
          </span>
        ) : null}
        <Button onClick={onEdit} size="xs" variant="outline">
          {scope ? t("scope.change") : t("scope.choose")}
        </Button>
      </div>
      {issues.map(issue => (
        <p
          className="text-destructive flex items-start gap-1.5 text-xs leading-relaxed"
          key={`${issue.type}:${issue.dependency ?? ""}`}
          role="alert"
        >
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {issueText(issue)}
        </p>
      ))}
    </div>
  );
};

const PermissionRow = ({
  checked,
  issues,
  labelByKey,
  onEditScope,
  onToggle,
  permission,
  scope,
  t,
}: {
  checked: Set<string>;
  issues: StaffRowIssue[];
  labelByKey: Map<string, string>;
  onEditScope: (permission: StaffPermissionItem) => void;
  onToggle: (key: string, value: boolean) => void;
  permission: StaffPermissionItem;
  scope: PermissionStaffScope | undefined;
  t: Translate;
}) => {
  const isChecked = checked.has(permission.key);
  const locked = isStaffPermissionLocked(permission, checked);
  const requires = permission.dependsOn
    .map(dependency => labelByKey.get(dependency) ?? dependency)
    .join(", ");

  return (
    <div>
      <label
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors",
          !locked && "hover:bg-muted/40",
        )}
      >
        <Checkbox
          checked={isChecked}
          disabled={locked}
          onCheckedChange={value => {
            onToggle(permission.key, value);
          }}
        />

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "flex items-center gap-1.5 text-sm leading-none",
              locked && "text-muted-foreground",
            )}
          >
            {locked ? (
              <LockIcon aria-hidden className="size-3.5 shrink-0" />
            ) : null}
            {permission.label}
          </p>
          {locked ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {t("requires", { permission: requires })}
            </p>
          ) : null}
        </div>
      </label>
      {isChecked && permission.scopeFamily ? (
        <ScopeSummary
          issues={issues}
          labelByKey={labelByKey}
          onEdit={() => {
            onEditScope(permission);
          }}
          permission={permission}
          scope={scope}
          t={t}
        />
      ) : null}
    </div>
  );
};

const ModuleSection = ({
  checked,
  issuesByKey,
  labelByKey,
  module,
  onEditScope,
  onOpenChange,
  onToggle,
  onToggleModule,
  open,
  scopes,
  t,
}: {
  checked: Set<string>;
  issuesByKey: Map<string, StaffRowIssue[]>;
  labelByKey: Map<string, string>;
  module: StaffModuleGroup;
  onEditScope: (permission: StaffPermissionItem) => void;
  onOpenChange: (value: boolean) => void;
  onToggle: (key: string, value: boolean) => void;
  onToggleModule: (module: StaffModuleGroup, value: boolean) => void;
  open: boolean;
  scopes: Readonly<Record<string, PermissionStaffScope | undefined>>;
  t: Translate;
}) => {
  const granted = countGrantedStaffPermissions(module.permissions, checked);
  const total = module.permissions.length;
  const isFull = total > 0 && granted === total;

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 p-3 sm:gap-3 sm:px-4">
        <button
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
          onClick={() => {
            onOpenChange(!open);
          }}
          type="button"
        >
          <ChevronRightIcon
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="truncate text-sm font-semibold sm:text-base">
            {module.label}
          </span>
        </button>

        <CountBadge granted={granted} total={total} />
        <Switch
          checked={isFull}
          onCheckedChange={value => {
            onToggleModule(module, value);
          }}
        />
      </div>

      {open ? (
        <div className="divide-y border-t">
          {module.permissions.map(permission => (
            <PermissionRow
              checked={checked}
              issues={issuesByKey.get(permission.key) ?? []}
              key={permission.key}
              labelByKey={labelByKey}
              onEditScope={onEditScope}
              onToggle={onToggle}
              permission={permission}
              scope={scopes[permission.key]}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const EditStaffFormContent = ({
  families,
  grantedKeys,
  grantedScopes = {},
  id,
  onSave,
  onSaved,
  plugins,
  type,
  unrestricted: defaultUnrestricted,
}: EditStaffFormProps) => {
  const t = useTranslations("admin.staff.edit");
  const tError = useTranslations("core.global.errors");
  const [mode, setMode] = React.useState<"restricted" | "unrestricted">(
    defaultUnrestricted ? "unrestricted" : "restricted",
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedPluginId, setSelectedPluginId] = React.useState(
    () => plugins[0]?.pluginId ?? "",
  );
  const [openModules, setOpenModules] = React.useState<Set<string>>(
    () => new Set(),
  );

  const allItems = React.useMemo(
    () => staffPermissionItems(plugins),
    [plugins],
  );

  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(grantedKeys),
  );
  const [scopes, setScopes] = React.useState<
    Record<string, PermissionStaffScope | undefined>
  >(() => ({ ...grantedScopes }));
  const [editingScope, setEditingScope] =
    React.useState<null | StaffPermissionItem>(null);
  const [showIssues, setShowIssues] = React.useState(false);
  const [serverIssues, setServerIssues] = React.useState<StaffScopeIssue[]>([]);

  const labelByKey = React.useMemo(
    () => new Map(allItems.map(item => [item.key, item.label] as const)),
    [allItems],
  );
  const dependents = React.useMemo(
    () => staffPermissionDependents(allItems),
    [allItems],
  );

  const filteredPlugins = React.useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return plugins;

    return plugins.filter(
      plugin =>
        plugin.label.toLowerCase().includes(value) ||
        plugin.pluginId.toLowerCase().includes(value),
    );
  }, [plugins, query]);

  const selectedPlugin =
    filteredPlugins.find(plugin => plugin.pluginId === selectedPluginId) ??
    filteredPlugins[0];

  const scopeIssues = React.useMemo(
    () => staffScopeIssues({ checked, items: allItems, scopes }),
    [allItems, checked, scopes],
  );
  const issuesByKey = React.useMemo(() => {
    const map = new Map<string, StaffRowIssue[]>();
    const visible = [...(showIssues ? scopeIssues : []), ...serverIssues];
    for (const issue of visible) {
      const list = map.get(issue.key) ?? [];
      if (
        !list.some(
          existing =>
            existing.type === issue.type &&
            existing.dependency ===
              ("dependency" in issue ? issue.dependency : undefined),
        )
      ) {
        list.push({
          dependency: "dependency" in issue ? issue.dependency : undefined,
          type: issue.type,
        });
      }
      map.set(issue.key, list);
    }

    return map;
  }, [scopeIssues, serverIssues, showIssues]);

  const familyById = React.useMemo(
    () => new Map(families.map(family => [family.id, family] as const)),
    [families],
  );
  const editingFamily = editingScope?.scopeFamily
    ? (familyById.get(editingScope.scopeFamily) ?? {
        description: null,
        id: editingScope.scopeFamily,
        label: editingScope.scopeFamily,
      })
    : null;
  const editingModuleScoped = editingScope
    ? allItems.filter(
        item =>
          item.plugin === editingScope.plugin &&
          item.module === editingScope.module &&
          item.scopeFamily === editingScope.scopeFamily,
      )
    : [];

  const onToggle = (key: string, value: boolean) => {
    setChecked(previous =>
      toggleStaffPermission({ checked: previous, dependents, key, value }),
    );
  };

  const setKeysChecked = (keys: string[], value: boolean) => {
    setChecked(previous =>
      setStaffPermissionsChecked({ checked: previous, keys, value }),
    );
  };

  const onSubmit = async () => {
    const unrestricted = mode === "unrestricted";
    setServerIssues([]);

    if (!unrestricted && scopeIssues.length > 0) {
      setShowIssues(true);
      toast.error(t("scope.issues.title"), {
        description: t(
          `scope.issues.${scopeIssues[0].type}` as "scope.issues.missing_scope",
          {
            dependency:
              "dependency" in scopeIssues[0]
                ? (labelByKey.get(scopeIssues[0].dependency) ??
                  scopeIssues[0].dependency)
                : "",
            permission:
              labelByKey.get(scopeIssues[0].key) ?? scopeIssues[0].key,
          },
        ),
      });

      return;
    }

    setIsLoading(true);

    const result = await onSave({
      id,
      permissions: staffPermissionsForSubmit({
        checked,
        items: allItems,
        scopes,
        unrestricted,
      }),
      type,
      unrestricted,
    });

    if ("error" in result) {
      setIsLoading(false);
      const issues =
        result.error.status === 400
          ? issuesFromResponse(result.error.message)
          : [];
      if (issues.length > 0) {
        setServerIssues(issues);
        toast.error(t("scope.issues.title"), {
          description: t(
            `scope.issues.${issues[0].type}` as "scope.issues.missing_scope",
            {
              dependency:
                "dependency" in issues[0]
                  ? (labelByKey.get(issues[0].dependency) ??
                    issues[0].dependency)
                  : "",
              permission: labelByKey.get(issues[0].key) ?? issues[0].key,
            },
          ),
        });

        return;
      }
      toast.error(t("error"), {
        description:
          result.error.status === 403
            ? t("self")
            : tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("success"));
    await onSaved();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t("mode.label")}
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          <SelectableCard
            description={t("mode.unrestricted.desc")}
            icon={
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <SparklesIcon className="size-5" />
              </span>
            }
            onSelect={() => {
              setMode("unrestricted");
            }}
            selected={mode === "unrestricted"}
            title={t("mode.unrestricted.label")}
          />
          <SelectableCard
            description={t("mode.restricted.desc")}
            icon={
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <ShieldCheckIcon className="size-5" />
              </span>
            }
            onSelect={() => {
              setMode("restricted");
            }}
            selected={mode === "restricted"}
            title={t("mode.restricted.label")}
          />
        </div>
      </div>

      {mode === "restricted" &&
        (plugins.length === 0 ? (
          <p className="text-muted-foreground">{t("no_permissions")}</p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:w-72 lg:shrink-0 lg:self-start">
              <div className="relative">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  className="ps-8"
                  onChange={event => {
                    setQuery(event.target.value);
                  }}
                  placeholder={t("search_plugins")}
                  value={query}
                />
              </div>

              <div className="flex flex-col gap-1">
                {filteredPlugins.map(plugin => {
                  const isSelected =
                    plugin.pluginId === selectedPlugin?.pluginId;
                  const total = plugin.modules.reduce(
                    (sum, module) => sum + module.permissions.length,
                    0,
                  );
                  const granted = plugin.modules.reduce(
                    (sum, module) =>
                      sum +
                      countGrantedStaffPermissions(module.permissions, checked),
                    0,
                  );

                  return (
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors outline-none",
                        isSelected
                          ? "border-primary/40 bg-primary/4"
                          : "hover:bg-muted/50 border-transparent",
                      )}
                      key={plugin.pluginId}
                      onClick={() => {
                        setSelectedPluginId(plugin.pluginId);
                      }}
                      type="button"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold uppercase",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {plugin.label.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {plugin.label}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t("granted", { granted, total })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 flex-1 space-y-3">
              {selectedPlugin ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        {selectedPlugin.label}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {selectedPlugin.pluginId}
                      </p>
                    </div>

                    <div className="text-muted-foreground flex items-center gap-1 text-sm">
                      <button
                        className="hover:text-foreground font-medium transition-colors"
                        onClick={() => {
                          setKeysChecked(
                            staffPermissionItems([selectedPlugin]).map(
                              item => item.key,
                            ),
                            true,
                          );
                        }}
                        type="button"
                      >
                        {t("select_all")}
                      </button>
                      <span aria-hidden>·</span>
                      <button
                        className="hover:text-foreground font-medium transition-colors"
                        onClick={() => {
                          setKeysChecked(
                            staffPermissionItems([selectedPlugin]).map(
                              item => item.key,
                            ),
                            false,
                          );
                        }}
                        type="button"
                      >
                        {t("clear_all")}
                      </button>
                    </div>
                  </div>

                  {selectedPlugin.modules.map(module => {
                    const moduleKey = `${selectedPlugin.pluginId}:${module.module}`;

                    return (
                      <ModuleSection
                        checked={checked}
                        issuesByKey={issuesByKey}
                        key={moduleKey}
                        labelByKey={labelByKey}
                        module={module}
                        onEditScope={setEditingScope}
                        onOpenChange={value => {
                          setOpenModules(previous => {
                            const next = new Set(previous);
                            if (value) {
                              next.add(moduleKey);
                            } else {
                              next.delete(moduleKey);
                            }

                            return next;
                          });
                        }}
                        onToggle={onToggle}
                        onToggleModule={(target, value) => {
                          setKeysChecked(
                            target.permissions.map(
                              permission => permission.key,
                            ),
                            value,
                          );
                        }}
                        open={openModules.has(moduleKey)}
                        scopes={scopes}
                        t={t}
                      />
                    );
                  })}
                </>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t("search_empty")}
                </p>
              )}
            </div>
          </div>
        ))}

      <div className="flex justify-end">
        <Button isLoading={isLoading} onClick={onSubmit}>
          {t("save")}
        </Button>
      </div>

      <Dialog
        onOpenChange={open => {
          if (!open) setEditingScope(null);
        }}
        open={editingScope !== null}
      >
        <DialogContent className="sm:max-w-lg">
          {editingScope && editingFamily ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-balance">
                  {t("scope.title", { permission: editingScope.label })}
                </DialogTitle>
                <DialogDescription className="text-pretty">
                  {editingFamily.description ??
                    t("scope.desc", { family: editingFamily.label })}
                </DialogDescription>
              </DialogHeader>
              <React.Suspense
                fallback={
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                }
              >
                <StaffScopeDialogContent
                  family={editingFamily}
                  moduleScopedCount={editingModuleScoped.length}
                  onApply={(scope, applyToModule) => {
                    const keys = applyToModule
                      ? editingModuleScoped.map(item => item.key)
                      : [editingScope.key];
                    setScopes(previous => {
                      const next = { ...previous };
                      for (const key of keys) next[key] = scope;

                      return next;
                    });
                    setServerIssues([]);
                    setEditingScope(null);
                  }}
                  onCancel={() => {
                    setEditingScope(null);
                  }}
                  value={scopes[editingScope.key]}
                />
              </React.Suspense>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
