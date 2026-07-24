"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { SelectableCard } from "../selectable-card";
import { updateStaffPermissions } from "./mutation-api.server";

const listHref = (type: PermissionStaffType) =>
  type === "admin"
    ? "/admin/core/staff/admins"
    : "/admin/core/staff/moderators";

interface PermissionItem {
  checked: boolean;
  // Keys of the permissions this one depends on. The row stays locked until
  // every dependency is enabled (e.g. `can_create` depends on `can_view`).
  dependsOn: string[];
  key: string;
  label: string;
  module: string;
  permission: string;
  plugin: string;
}

interface ModuleGroup {
  label: string;
  module: string;
  permissions: PermissionItem[];
}

export interface PluginGroup {
  label: string;
  modules: ModuleGroup[];
  pluginId: string;
}

type Translate = ReturnType<typeof useTranslations<"admin.staff.edit">>;

const countGranted = (permissions: PermissionItem[], checked: Set<string>) =>
  permissions.reduce(
    (total, item) => total + (checked.has(item.key) ? 1 : 0),
    0,
  );

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
  permission,
  checked,
  labelByKey,
  onToggle,
  t,
}: {
  checked: Set<string>;
  labelByKey: Map<string, string>;
  onToggle: (key: string, value: boolean) => void;
  permission: PermissionItem;
  t: Translate;
}) => {
  const isChecked = checked.has(permission.key);
  const locked = !permission.dependsOn.every(dependency =>
    checked.has(dependency),
  );
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
        onCheckedChange={value => onToggle(permission.key, value)}
      />
    </label>
  );
};

const ModuleSection = ({
  module,
  checked,
  labelByKey,
  open,
  onOpenChange,
  onToggle,
  onToggleModule,
  t,
}: {
  checked: Set<string>;
  labelByKey: Map<string, string>;
  module: ModuleGroup;
  onOpenChange: (value: boolean) => void;
  onToggle: (key: string, value: boolean) => void;
  onToggleModule: (module: ModuleGroup, value: boolean) => void;
  open: boolean;
  t: Translate;
}) => {
  const granted = countGranted(module.permissions, checked);
  const total = module.permissions.length;
  const isFull = total > 0 && granted === total;

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 p-3 sm:gap-3 sm:px-4">
        <button
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
          onClick={() => onOpenChange(!open)}
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
          onCheckedChange={value => onToggleModule(module, value)}
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

export const EditStaffPermissionsForm = ({
  type,
  id,
  plugins,
  unrestricted: defaultUnrestricted,
}: {
  id: string;
  plugins: PluginGroup[];
  type: PermissionStaffType;
  unrestricted: boolean;
}) => {
  const t = useTranslations("admin.staff.edit");
  const router = useRouter();
  const [mode, setMode] = React.useState<"restricted" | "unrestricted">(
    defaultUnrestricted ? "unrestricted" : "restricted",
  );
  const [checked, setChecked] = React.useState<Set<string>>(
    () =>
      new Set(
        plugins.flatMap(plugin =>
          plugin.modules.flatMap(module =>
            module.permissions
              .filter(permission => permission.checked)
              .map(permission => permission.key),
          ),
        ),
      ),
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
    () =>
      plugins.flatMap(plugin =>
        plugin.modules.flatMap(module => module.permissions),
      ),
    [plugins],
  );

  // Resolve every permission key to its label so dependency hints ("Requires
  // …") can name the gates they wait on.
  const labelByKey = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allItems) map.set(item.key, item.label);

    return map;
  }, [allItems]);

  // Reverse index: permission key -> keys of the permissions that depend on it,
  // so turning a gate off can cascade to everything it unlocks.
  const dependentsByKey = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of allItems) {
      for (const dependency of item.dependsOn) {
        map.set(dependency, [...(map.get(dependency) ?? []), item.key]);
      }
    }

    return map;
  }, [allItems]);

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

  const toggle = (key: string, value: boolean) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (value) {
        next.add(key);

        return next;
      }

      // Removing a permission also removes anything that (transitively) depends
      // on it, so a hidden switch can never stay granted behind the scenes.
      const stack = [key];
      while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) break;
        next.delete(current);
        for (const dependent of dependentsByKey.get(current) ?? []) {
          if (next.has(dependent)) stack.push(dependent);
        }
      }

      return next;
    });
  };

  const setKeysChecked = (keys: string[], value: boolean) => {
    setChecked(prev => {
      const next = new Set(prev);
      for (const key of keys) {
        if (value) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }

      return next;
    });
  };

  const setPluginChecked = (plugin: PluginGroup, value: boolean) => {
    setKeysChecked(
      plugin.modules.flatMap(module =>
        module.permissions.map(permission => permission.key),
      ),
      value,
    );
  };

  const setModuleChecked = (module: ModuleGroup, value: boolean) => {
    setKeysChecked(
      module.permissions.map(permission => permission.key),
      value,
    );
  };

  const onSubmit = async () => {
    const unrestricted = mode === "unrestricted";
    setIsLoading(true);

    const permissions = unrestricted
      ? []
      : allItems
          .filter(
            item =>
              checked.has(item.key) &&
              item.dependsOn.every(dependency => checked.has(dependency)),
          )
          .map(({ plugin, module, permission }) => ({
            plugin,
            module,
            permission,
          }));

    const result = await updateStaffPermissions({
      type,
      id,
      unrestricted,
      permissions,
    });

    if (result.error) {
      setIsLoading(false);
      toast.error(t("error"));

      return;
    }

    toast.success(t("success"));
    router.push(listHref(type));
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
            onSelect={() => setMode("unrestricted")}
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
            onSelect={() => setMode("restricted")}
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
                  onChange={event => setQuery(event.target.value)}
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
                      sum + countGranted(module.permissions, checked),
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
                      onClick={() => setSelectedPluginId(plugin.pluginId)}
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
                        onClick={() => setPluginChecked(selectedPlugin, true)}
                        type="button"
                      >
                        {t("select_all")}
                      </button>
                      <span aria-hidden>·</span>
                      <button
                        className="hover:text-foreground font-medium transition-colors"
                        onClick={() => setPluginChecked(selectedPlugin, false)}
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
                        onOpenChange={value =>
                          setOpenModules(prev => {
                            const next = new Set(prev);
                            if (value) {
                              next.add(moduleKey);
                            } else {
                              next.delete(moduleKey);
                            }

                            return next;
                          })
                        }
                        onToggle={toggle}
                        onToggleModule={setModuleChecked}
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
