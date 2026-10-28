import { useSelector } from "@tanstack/react-form";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CircleCheckIcon,
  LockIcon,
  RotateCwIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { RoleOption } from "@/components/form/fields/roles";
import type {
  ContentAccessAction,
  ContentAccessAudience,
  ContentAccessOverrides,
} from "@/content/access/policy";
import type {
  ContentAccessAdminResponse,
  ContentAccessAdminRole,
} from "@/content/access/schemas";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormRoles } from "@/components/form/fields/input-roles";
import { roleOptionName } from "@/components/form/fields/roles";
import { AutoFormSelect } from "@/components/form/fields/select";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { useFormApi } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { CONTENT_ACCESS_ACTIONS } from "@/content/access/const";
import { zodContentAccessOverrides } from "@/content/access/policy";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";

import type { ContentAccessApiTarget } from "./access-request";

import {
  contentAccessQuery,
  previewContentAccess,
  saveContentAccess,
} from "./access-request";

const MODES = ["inherit", "everyone", "members", "roles"] as const;
type Mode = (typeof MODES)[number];

const PREVIEW_DELAY_MS = 300;

export interface ContentAccessFormProps {
  /** Called after a save, e.g. to refresh a list that shows access state. */
  onSaved?: () => Promise<void> | void;
  /** The scope being edited, as the admin knows it. */
  scopeId: string;
  /** Names of the family's scopes by id, to name where a rule comes from. */
  scopeNames: ReadonlyMap<string, string>;
  /** The scope's own display name. */
  scopeName: string;
  target: ContentAccessApiTarget;
}

const modeKey = (action: ContentAccessAction) => `${action}Mode`;
const rolesKey = (action: ContentAccessAction) => `${action}Roles`;

const buildFormSchema = (
  response: ContentAccessAdminResponse,
  { privateStorage }: { privateStorage: boolean },
) => {
  const shape: Record<string, z.ZodType> = {};
  for (const action of CONTENT_ACCESS_ACTIONS) {
    const own = response.report.overrides[action];
    const choices: [Mode, ...Mode[]] =
      action === "downloadAttachments" && !privateStorage
        ? ["inherit", "everyone"]
        : [...MODES];
    shape[modeKey(action)] = z
      .enum(choices)
      .default(
        own && choices.includes(own.mode) ? (own.mode as Mode) : "inherit",
      );
    shape[rolesKey(action)] = z
      .array(z.number().int().positive())
      .default(own?.mode === "roles" ? own.roleIds : []);
  }

  return z.object(shape).superRefine((values, ctx) => {
    for (const action of CONTENT_ACCESS_ACTIONS) {
      const roles = values[rolesKey(action)];
      if (
        values[modeKey(action)] === "roles" &&
        (!Array.isArray(roles) || roles.length === 0)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Pick at least one role.",
          path: [rolesKey(action)],
        });
      }
    }
  });
};

/** The overrides the form's values describe. `roles` with none picked is left out. */
const overridesOf = (values: Record<string, unknown>): ContentAccessOverrides => {
  const overrides: ContentAccessOverrides = {};
  for (const action of CONTENT_ACCESS_ACTIONS) {
    const mode = values[modeKey(action)];
    const roles = values[rolesKey(action)];
    if (mode === "everyone" || mode === "members") {
      overrides[action] = { mode };
    } else if (mode === "roles" && Array.isArray(roles) && roles.length > 0) {
      overrides[action] = {
        mode: "roles",
        roleIds: roles.filter((id): id is number => typeof id === "number"),
      };
    }
  }

  return overrides;
};

const useAudienceText = (roles: readonly ContentAccessAdminRole[]) => {
  const t = useTranslations("core.access.admin");
  const locale = useLocale();

  return (audience: ContentAccessAudience): string => {
    switch (audience.mode) {
      case "everyone":
        return t("audience.everyone");
      case "members":
        return t("audience.members");
      case "roles": {
        if (audience.roleIds.length === 0) return t("audience.nobody");
        const names = audience.roleIds.map(id => {
          const role = roles.find(candidate => candidate.id === id);

          return role ? roleOptionName(role, locale) : t("deleted_role");
        });

        return t("audience.roles", { roles: names.join(", ") });
      }
    }
  };
};

/**
 * The effective access the form's values would give, asked of the server -
 * which counts every ancestor and the definition's defaults, the same way the
 * public site will.
 */
const EffectivePanel = ({
  initial,
  scopeId,
  scopeNames,
  target,
}: {
  initial: ContentAccessAdminResponse;
  scopeId: string;
  scopeNames: ReadonlyMap<string, string>;
  target: ContentAccessApiTarget;
}) => {
  const t = useTranslations("core.access.admin");
  const { form } = useFormApi();
  const values = useSelector(form.store, state => state.values) as Record<
    string,
    unknown
  >;
  const overrides = overridesOf(values);
  const key = JSON.stringify(overrides);
  const [debounced, setDebounced] = React.useState(key);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(key);
    }, PREVIEW_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [key]);

  const preview = useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) =>
      await previewContentAccess(
        target,
        scopeId,
        JSON.parse(debounced) as ContentAccessOverrides,
        { signal },
      ),
    queryKey: ["vitnode", "admin", "access-preview", target.family, scopeId, debounced],
    retry: false,
    staleTime: Infinity,
  });
  const data = preview.data ?? initial;
  const audienceText = useAudienceText(data.roles);
  const nameOf = (id: string) =>
    id === scopeId ? t("this_scope") : (scopeNames.get(id) ?? `#${id}`);

  return (
    <section
      aria-busy={preview.isFetching}
      aria-labelledby="content-access-effective"
      className="bg-muted/40 flex flex-col gap-4 rounded-lg border p-4 aria-busy:opacity-60"
    >
      <h3
        className="text-base leading-snug font-semibold text-balance"
        id="content-access-effective"
      >
        {t("effective.title")}
      </h3>
      <dl className="flex flex-col gap-3">
        {CONTENT_ACCESS_ACTIONS.map(action => {
          const { prerequisite, requirements } = data.report.actions[action];

          return (
            <div className="flex flex-col gap-1" key={action}>
              <dt className="text-sm font-medium">{t(`actions.${action}.label`)}</dt>
              <dd className="text-muted-foreground flex flex-col gap-1 text-sm leading-relaxed text-pretty">
                {requirements.length === 0 ? (
                  <span className="flex items-center gap-1.5">
                    <CircleCheckIcon aria-hidden="true" className="size-4" />
                    {t("effective.open")}
                  </span>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {requirements.map(requirement => (
                      <li
                        className="flex items-start gap-1.5"
                        key={`${requirement.scopeId}-${requirement.action}-${requirement.via}`}
                      >
                        <LockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <span>
                          {t(
                            requirement.via === "ancestor"
                              ? "effective.ancestor"
                              : requirement.action === action
                                ? "effective.self"
                                : "effective.prerequisite",
                            {
                              action: t(`actions.${requirement.action}.label`),
                              audience: audienceText(requirement.audience),
                              scope: nameOf(requirement.scopeId),
                            },
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {prerequisite ? (
                  <span>
                    {t("effective.needs", {
                      action: t(`actions.${prerequisite}.label`),
                    })}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>

      {data.report.warnings.length > 0 ? (
        <ul className="flex flex-col gap-2" role="list">
          {data.report.warnings.map(warning => (
            <li
              className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm leading-relaxed text-pretty"
              key={`${warning.action}-${warning.scopeId}`}
            >
              <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("warnings.nobody", {
                action: t(`actions.${warning.action}.label`),
                scope: nameOf(warning.scopeId),
              })}
            </li>
          ))}
        </ul>
      ) : null}

      {data.report.descendants > 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("descendants", { count: data.report.descendants })}
        </p>
      ) : null}

      {data.attachments.privateStorage ? null : (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("attachments.unsupported")}
        </p>
      )}
    </section>
  );
};

const AccessForm = ({
  onSaved,
  response,
  scopeId,
  scopeName,
  scopeNames,
  target,
}: Omit<ContentAccessFormProps, "scopeId"> & {
  response: ContentAccessAdminResponse;
  scopeId: string;
}) => {
  const t = useTranslations("core.access.admin");
  const tError = useTranslations("core.global.errors");
  const locale = useLocale();
  const { setIsDirty, setOpen } = useDialog();
  const privateStorage = response.attachments.privateStorage;
  const formSchema = buildFormSchema(response, { privateStorage });
  const audienceText = useAudienceText(response.roles);
  const selectedRoles: RoleOption[] = response.roles;

  const sourceText = (action: ContentAccessAction): string => {
    const { inheritedSource } = response.report.actions[action];
    if (inheritedSource.kind === "scope") {
      return t("source.scope", {
        name: scopeNames.get(inheritedSource.scopeId) ?? `#${inheritedSource.scopeId}`,
      });
    }

    return t(`source.${inheritedSource.kind}`);
  };

  const fields = CONTENT_ACCESS_ACTIONS.flatMap(action => [
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormSelect
          {...props}
          description={
            <>
              <span className="block">{t(`actions.${action}.desc`)}</span>
              <span className="block">{sourceText(action)}</span>
            </>
          }
          label={t(`actions.${action}.label`)}
          labels={[
            {
              label: t("inherit", {
                value: audienceText(response.report.actions[action].inherited),
              }),
              value: "inherit",
            },
            { label: t("audience.everyone"), value: "everyone" },
            { label: t("audience.members"), value: "members" },
            { label: t("modes.roles"), value: "roles" },
          ]}
        />
      ),
      id: modeKey(action),
    },
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormRoles
          {...props}
          description={t("roles_desc")}
          label={t("roles_label", { action: t(`actions.${action}.label`) })}
          multiple
          search={searchAdminRolesInBrowser}
          selected={selectedRoles}
        />
      ),
      hidden: (values: Record<string, unknown>) =>
        values[modeKey(action)] !== "roles",
      id: rolesKey(action),
    },
  ]);

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const parsed = zodContentAccessOverrides.safeParse(
      overridesOf(values as Record<string, unknown>),
    );
    const result = parsed.success
      ? await saveContentAccess(target, scopeId, parsed.data)
      : { error: { code: "invalidAccess" as const, status: 400 } };

    if ("error" in result) {
      toast.error(tError("title"), {
        description: t(`errors.${result.error.code ?? "unknown"}`),
      });

      return;
    }

    toast.success(t("success"), {
      description: t("successDesc", { name: scopeName }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
    await onSaved?.();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={fields}
      formSchema={formSchema}
      key={locale}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("desc", { name: scopeName })}
            </p>
            {CONTENT_ACCESS_ACTIONS.map(action => (
              <section
                aria-label={t(`actions.${action}.label`)}
                className="flex flex-col gap-3 border-t pt-5"
                key={action}
              >
                {rendered[modeKey(action)]}
                {rendered[rolesKey(action)]}
              </section>
            ))}
            <EffectivePanel
              initial={response}
              scopeId={scopeId}
              scopeNames={scopeNames}
              target={target}
            />
          </div>
          <AutoFormSheetFooter submitLabel={t("submit")} />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

/**
 * The access editor of one scope - a container, a blog category, any scope a
 * plugin declares: view, read, comment and download rules, each inherited,
 * open to everyone, to signed-in members or to selected roles, with the
 * effective result the server computes below. Rendered in a sheet.
 */
export const ContentAccessFormContent = (props: ContentAccessFormProps) => {
  const t = useTranslations("core.access.admin");
  const query = useQuery(contentAccessQuery(props.target, props.scopeId));

  if (query.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
        role="alert"
      >
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("loadError")}
        </p>
        <Button
          onClick={() => {
            void query.refetch();
          }}
          variant="outline"
        >
          <RotateCwIcon aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <AccessForm key={query.dataUpdatedAt} response={query.data} {...props} />
  );
};
