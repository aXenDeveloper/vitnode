"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  StaffModuleGroup,
  StaffPermissionItem,
  StaffPluginGroup,
} from "@/views/admin/views/core/staff/staff-model";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  countGrantedStaffPermissions,
  isStaffPermissionLocked,
  setStaffPermissionsChecked,
  staffPermissionDependents,
  staffPermissionItems,
  staffPermissionsForSubmit,
  toggleStaffPermission,
} from "@/views/admin/views/core/staff/staff-model";

import { SelectableCard } from "../selectable-card";

/**
 * Choosing what a staff entry may do.
 *
 * Every rule this form applies - which permissions exist, what depends on what,
 * what a toggle cascades to, and what is finally sent - lives in
 * `staff-model.ts` and is tested there without React. What is left here is the
 * screen: two modes, a plugin sidebar, collapsible modules, and a save.
 *
 * ## Unrestricted is a mode, not a checkbox
 *
 * "Unrestricted" means *everything, including permissions that do not exist
 * yet* - a plugin installed tomorrow is covered without anybody revisiting this
 * entry. That is why it replaces the tree rather than sitting above it, and why
 * a save in that mode sends no permission list at all.
 *
 * ## What the API does to the same set
 *
 * `update-permissions.route.ts` drops anything not in the catalog and anything
 * whose dependencies are missing, repeatedly, until the set is stable.
 * `staffPermissionsForSubmit` applies exactly those two rules before sending, so
 * an administrator is never shown one thing and given another.
 */

export interface EditStaffFormProps {
  /**
   * The keys this entry already holds, as `plugin:module:permission`.
   *
   * Handed in rather than folded into `plugins`, because the two answer
   * different questions: `plugins` is what the *installation* declares, and this
   * is what the *entry* was granted. A permission the entry holds that the
   * catalog no longer declares is therefore simply absent from the tree - it
   * cannot be re-granted by rendering, and the save drops it, which is exactly
   * what the API would do with it anyway.
   */
  grantedKeys: readonly string[];
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

const PermissionRow = ({
  checked,
  labelByKey,
  onToggle,
  permission,
  t,
}: {
  checked: Set<string>;
  labelByKey: Map<string, string>;
  onToggle: (key: string, value: boolean) => void;
  permission: StaffPermissionItem;
  t: Translate;
}) => {
  const isChecked = checked.has(permission.key);
  const locked = isStaffPermissionLocked(permission, checked);
  const requires = permission.dependsOn
    .map(dependency => labelByKey.get(dependency) ?? dependency)
    .join(", ");

  return (
    <label
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        !locked && "hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md transition-colors",
          locked
            ? "bg-muted text-muted-foreground"
            : isChecked
              ? "bg-primary text-primary-foreground"
              : "border-input border",
        )}
      >
        {locked ? (
          <LockIcon className="size-3" />
        ) : isChecked ? (
          <CheckIcon className="size-3.5" />
        ) : null}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-none",
            locked && "text-muted-foreground",
          )}
        >
          {permission.label}
        </p>
        {locked ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {t("requires", { permission: requires })}
          </p>
        ) : null}
      </div>

      <Switch
        checked={isChecked}
        disabled={locked}
        onCheckedChange={value => {
          onToggle(permission.key, value);
        }}
      />
    </label>
  );
};

const ModuleSection = ({
  checked,
  labelByKey,
  module,
  onOpenChange,
  onToggle,
  onToggleModule,
  open,
  t,
}: {
  checked: Set<string>;
  labelByKey: Map<string, string>;
  module: StaffModuleGroup;
  onOpenChange: (value: boolean) => void;
  onToggle: (key: string, value: boolean) => void;
  onToggleModule: (module: StaffModuleGroup, value: boolean) => void;
  open: boolean;
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
              key={permission.key}
              labelByKey={labelByKey}
              onToggle={onToggle}
              permission={permission}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const EditStaffFormContent = ({
  grantedKeys,
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

  /**
   * What is granted right now.
   *
   * Seeded once, from the entry. Re-deriving it from `grantedKeys` on every
   * render would throw away every toggle the administrator has made since the
   * page loaded.
   */
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(grantedKeys),
  );

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
    setIsLoading(true);

    const result = await onSave({
      id,
      permissions: staffPermissionsForSubmit({
        checked,
        items: allItems,
        unrestricted,
      }),
      type,
      unrestricted,
    });

    if ("error" in result) {
      setIsLoading(false);
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
                        key={moduleKey}
                        labelByKey={labelByKey}
                        module={module}
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
    </div>
  );
};
