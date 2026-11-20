import { useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";

import { AutoFormDesc } from "@/components/form/common/desc";
import { AutoFormLabel } from "@/components/form/common/label";
import { resolveRoleName } from "@/components/role-name";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage, useFormApi } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminIdentity } from "@/tanstack/admin/identity";

import { LimitInput } from "./limit-input";
import { adminReactionRolesQueryOptions } from "./reactions-query";

/** One role's rule in the form: whether it may use the reaction, and its limit. */
export interface ReactionRoleRule {
  dailyLimit: null | number;
  roleId: number;
}

/**
 * The per-role table of a reaction: "Can use" (locked on while every role
 * may) and a daily limit with Unlimited. Stores the roles that have a rule.
 */
export const ReactionRolesField = ({
  description,
  field,
  label,
}: ItemAutoFormComponentProps) => {
  const { form } = useFormApi();
  const allRoles = useSelector(
    form.store,
    state => (state.values as { allRoles?: boolean }).allRoles !== false,
  );
  const t = useTranslations("admin.reactions.form");
  const locale = useLocale();
  const roles = useQuery(adminReactionRolesQueryOptions(useAdminIdentity()));
  const value = (
    Array.isArray(field.value) ? field.value : []
  ) as ReactionRoleRule[];
  const ruleOf = (roleId: number) => value.find(rule => rule.roleId === roleId);

  const setRule = (roleId: number, rule: null | ReactionRoleRule) => {
    const others = value.filter(item => item.roleId !== roleId);
    field.onChange(rule ? [...others, rule] : others);
  };

  return (
    <>
      {label ? <AutoFormLabel>{label}</AutoFormLabel> : null}
      {roles.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : roles.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {t("roles_load_error")}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {roles.data.map(role => {
            const name = resolveRoleName(role, locale);
            const rule = ruleOf(role.id);
            const canUse = allRoles || rule !== undefined;

            return (
              <li
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                key={role.id}
              >
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    aria-label={t("role_can_use", { role: name })}
                    checked={canUse}
                    disabled={allRoles}
                    onCheckedChange={checked => {
                      setRule(
                        role.id,
                        checked ? { dailyLimit: null, roleId: role.id } : null,
                      );
                    }}
                  />
                  <span style={role.color ? { color: role.color } : undefined}>
                    {name}
                  </span>
                </label>
                <LimitInput
                  disabled={!canUse}
                  label={`${name}: ${t("role_limit")}`}
                  onChange={next => {
                    if (allRoles && next === null) {
                      setRule(role.id, null);

                      return;
                    }
                    setRule(role.id, { dailyLimit: next, roleId: role.id });
                  }}
                  orLabel={t("role_or")}
                  unitLabel={t("role_per_day")}
                  unlimitedLabel={t("role_unlimited")}
                  value={rule?.dailyLimit ?? null}
                />
              </li>
            );
          })}
        </ul>
      )}
      {description ? <AutoFormDesc>{description}</AutoFormDesc> : null}
      <FormMessage />
    </>
  );
};
