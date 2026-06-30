"use client";

import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/lib/navigation";

import { updateStaffPermissions } from "./mutation-api";

const listHref = (type: PermissionStaffType) =>
  type === "admin"
    ? "/admin/core/staff/admins"
    : "/admin/core/staff/moderators";

interface PermissionItem {
  checked: boolean;
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

  const allItems = React.useMemo(
    () =>
      plugins.flatMap(plugin =>
        plugin.modules.flatMap(module => module.permissions),
      ),
    [plugins],
  );

  const toggle = (key: string, value: boolean) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (value) {
        next.add(key);
      } else {
        next.delete(key);
      }

      return next;
    });
  };

  const setPluginChecked = (plugin: PluginGroup, value: boolean) => {
    const keys = plugin.modules.flatMap(module =>
      module.permissions.map(permission => permission.key),
    );
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

  const onSubmit = async () => {
    const unrestricted = mode === "unrestricted";
    setIsLoading(true);

    const permissions = unrestricted
      ? []
      : allItems
          .filter(item => checked.has(item.key))
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
      <div className="space-y-2">
        <h2 className="text-foreground text-sm font-semibold">
          {t("mode.label")}
        </h2>

        <RadioGroup
          onValueChange={value =>
            setMode(value as "restricted" | "unrestricted")
          }
          value={mode}
        >
          <Label className="flex items-start gap-3">
            <RadioGroupItem className="mt-0.5" value="unrestricted" />
            <span className="space-y-1">
              <span className="font-medium">
                {t("mode.unrestricted.label")}
              </span>
              <span className="text-muted-foreground block text-sm font-normal">
                {t("mode.unrestricted.desc")}
              </span>
            </span>
          </Label>

          <Label className="flex items-start gap-3">
            <RadioGroupItem className="mt-0.5" value="restricted" />
            <span className="space-y-1">
              <span className="font-medium">{t("mode.restricted.label")}</span>
              <span className="text-muted-foreground block text-sm font-normal">
                {t("mode.restricted.desc")}
              </span>
            </span>
          </Label>
        </RadioGroup>
      </div>

      {mode === "restricted" &&
        (plugins.length === 0 ? (
          <p className="text-muted-foreground">{t("no_permissions")}</p>
        ) : (
          <Tabs defaultValue={plugins[0]?.pluginId}>
            <TabsList>
              {plugins.map(plugin => (
                <TabsTrigger key={plugin.pluginId} value={plugin.pluginId}>
                  {plugin.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {plugins.map(plugin => (
              <TabsContent
                className="space-y-6"
                key={plugin.pluginId}
                value={plugin.pluginId}
              >
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPluginChecked(plugin, true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("select_all")}
                  </Button>
                  <Button
                    onClick={() => setPluginChecked(plugin, false)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("clear_all")}
                  </Button>
                </div>

                {plugin.modules.map(module => (
                  <div className="space-y-3" key={module.module}>
                    <h3 className="text-foreground text-sm font-semibold">
                      {module.label}
                    </h3>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {module.permissions.map(permission => (
                        <Label
                          className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-md border p-3"
                          key={permission.key}
                        >
                          <span className="font-normal">
                            {permission.label}
                          </span>
                          <Switch
                            checked={checked.has(permission.key)}
                            onCheckedChange={value =>
                              toggle(permission.key, value)
                            }
                          />
                        </Label>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        ))}

      <div className="flex justify-end">
        <Button isLoading={isLoading} onClick={onSubmit}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
};
