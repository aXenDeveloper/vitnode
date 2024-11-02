import { AutoFormComponentProps } from '@/components/form/auto-form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/helpers/classnames';
import { useTranslations } from 'next-intl';
import React from 'react';
import { PermissionsStaffObj } from 'vitnode-shared/admin/staff.dto';

interface PermissionState {
  groups: {
    id: string;
    permissions: string[];
  }[];
  plugin_code: string;
}

export function PermissionsField({
  permissions: permissionsFromProps,
  field,
}: {
  permissions: PermissionsStaffObj[];
} & AutoFormComponentProps) {
  const permissions = permissionsFromProps.filter(
    plugin => plugin.groups.length > 0,
  );
  const [activeTab, setActiveTab] = React.useState(permissions[0].plugin_code);
  const values: PermissionState[] = Array.isArray(field.value)
    ? field.value
    : [];
  const t = useTranslations();

  return (
    <>
      <Tabs>
        {permissions.map(permission => (
          <TabsTrigger
            active={activeTab === permission.plugin_code}
            id={permission.plugin_code}
            key={permission.plugin_code}
            onClick={() => {
              setActiveTab(permission.plugin_code);
            }}
          >
            {permission.plugin}
          </TabsTrigger>
        ))}
      </Tabs>

      {permissions.map(plugin => {
        const valuePlugin = values.find(
          value => value.plugin_code === plugin.plugin_code,
        );

        return (
          <div
            className={cn(
              activeTab === plugin.plugin_code ? 'block' : 'hidden',
            )}
            key={plugin.plugin_code}
          >
            {plugin.groups.map(permission => {
              const groupValue = valuePlugin?.groups.find(
                p => p.id === permission.id,
              );
              const langKey = `admin_${plugin.plugin_code}.admin_permissions.${permission.id}`;

              return (
                <div className="py-2 sm:p-4" key={permission.id}>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={groupValue?.permissions.length === 0}
                      id={`${plugin.plugin_code}-${permission.id}`}
                      onCheckedChange={checked => {
                        const otherValues = values.filter(
                          value => value.plugin_code !== plugin.plugin_code,
                        );

                        if (checked) {
                          const newGroups = valuePlugin
                            ? [
                                ...valuePlugin.groups.filter(
                                  p => p.id !== permission.id,
                                ),
                                { id: permission.id, permissions: [] },
                              ]
                            : [{ id: permission.id, permissions: [] }];

                          const updatedValue = {
                            plugin_code: plugin.plugin_code,
                            groups: newGroups,
                          };

                          field.onChange([...otherValues, updatedValue]);
                        } else {
                          if (!valuePlugin) return;

                          const newGroups = valuePlugin.groups.filter(
                            p => p.id !== permission.id,
                          );

                          if (newGroups.length > 0) {
                            const updatedValue = {
                              ...valuePlugin,
                              groups: newGroups,
                            };

                            field.onChange([...otherValues, updatedValue]);
                          } else {
                            field.onChange(otherValues);
                          }
                        }
                      }}
                    />

                    <Label
                      className="text-md truncate"
                      htmlFor={`${plugin.plugin_code}-${permission.id}`}
                    >
                      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                      {/* @ts-expect-error */}
                      {t.has(langKey) ? t(langKey) : langKey}
                    </Label>
                  </div>

                  {permission.permissions.length > 0 && (
                    <ul className="ml-4 mt-2 space-y-2 sm:ml-8">
                      {permission.permissions.map(child => {
                        const childValue = groupValue?.permissions.find(
                          c => c === child,
                        );
                        const childLangKey = `admin_${plugin.plugin_code}.admin_permissions.${child}`;

                        return (
                          <li
                            className="flex items-center gap-2"
                            key={`${plugin.plugin_code}-${permission.id}-${child}`}
                          >
                            <Switch
                              checked={
                                !!childValue ||
                                groupValue?.permissions.length === 0
                              }
                              id={`${plugin.plugin_code}-${permission.id}-${child}`}
                              onCheckedChange={checked => {
                                if (checked) {
                                  const valueToChange: PermissionState[] = [
                                    ...values.filter(
                                      value =>
                                        value.plugin_code !==
                                        plugin.plugin_code,
                                    ),
                                    {
                                      plugin_code: plugin.plugin_code,
                                      groups: valuePlugin
                                        ? [
                                            ...valuePlugin.groups.filter(
                                              p => p.id !== permission.id,
                                            ),
                                            {
                                              id: permission.id,
                                              permissions: groupValue
                                                ? [
                                                    ...groupValue.permissions,
                                                    child,
                                                  ]
                                                : [child],
                                            },
                                          ]
                                        : [
                                            {
                                              id: permission.id,
                                              permissions: [child],
                                            },
                                          ],
                                    },
                                  ];
                                  field.onChange(valueToChange);

                                  return;
                                }

                                if (!valuePlugin) return;

                                const valueToChange: PermissionState[] = [
                                  ...values.filter(
                                    value =>
                                      value.plugin_code !== plugin.plugin_code,
                                  ),
                                  {
                                    ...valuePlugin,
                                    groups: valuePlugin.groups.map(p => {
                                      if (p.id !== permission.id) return p;

                                      return {
                                        ...p,
                                        permissions: childValue
                                          ? p.permissions.filter(
                                              c => c !== child,
                                            )
                                          : permission.permissions.filter(
                                              c => c !== child,
                                            ),
                                      };
                                    }),
                                  },
                                ];

                                const returnValue: PermissionState[] =
                                  valueToChange.map(item => {
                                    if (
                                      item.plugin_code === plugin.plugin_code
                                    ) {
                                      const group = item.groups.find(
                                        group => group.id === permission.id,
                                      );

                                      return {
                                        ...item,
                                        groups: [
                                          ...item.groups.filter(
                                            group => group.id !== permission.id,
                                          ),
                                          group?.permissions.length === 0
                                            ? undefined
                                            : group,
                                        ].filter(Boolean) as {
                                          id: string;
                                          permissions: string[];
                                        }[],
                                      };
                                    }

                                    return item;
                                  });

                                field.onChange(returnValue);
                              }}
                            />
                            <Label
                              className="text-muted-foreground truncate"
                              htmlFor={`${plugin.plugin_code}-${permission.id}-${child}`}
                            >
                              {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                              {/* @ts-expect-error */}
                              {t.has(childLangKey)
                                ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                  // @ts-expect-error
                                  t(childLangKey)
                                : childLangKey}
                            </Label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
