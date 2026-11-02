import { useSelector } from "@tanstack/react-form";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  FolderTreeIcon,
  PaperclipIcon,
  RotateCwIcon,
  SaveIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
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
import { roleOptionName } from "@/components/form/fields/roles";
import { Button } from "@/components/ui/button";
import { DialogClose, useDialog } from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useFormApi } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTENT_ACCESS_ACTIONS } from "@/content/access/const";
import { zodContentAccessOverrides } from "@/content/access/policy";
import { DOCS_URLS } from "@/lib/docs-links";

import type { ContentAccessRuleValue } from "./access-matrix";
import type { ContentAccessApiTarget } from "./access-request";

import { ContentAccessMatrix } from "./access-matrix";
import { ContentAccessMatrixSkeleton } from "./access-matrix-skeleton";
import {
  contentAccessFilesQuery,
  contentAccessQuery,
  previewContentAccess,
  protectContentAccessFiles,
  saveContentAccess,
} from "./access-request";

const MODES = ["inherit", "everyone", "members", "roles"] as const;
type Mode = (typeof MODES)[number];

const PREVIEW_DELAY_MS = 300;

const privateStorageLink = (text: React.ReactNode) => (
  <a
    className="text-foreground font-medium underline underline-offset-4"
    href={DOCS_URLS.contentPrivateStorage}
    rel="noopener noreferrer"
    target="_blank"
  >
    {text}
  </a>
);

export interface ContentAccessFormProps {
  /** Called after a save, e.g. to refresh a list that shows access state. */
  onSaved?: () => Promise<void> | void;
  /** The scope being edited, as the admin knows it. */
  scopeId: string;
  /** The scope's own display name. */
  scopeName: string;
  /** Names of the family's scopes by id, to name where a rule comes from. */
  scopeNames: ReadonlyMap<string, string>;
  target: ContentAccessApiTarget;
}

const modeKey = (action: ContentAccessAction) => `${action}Mode`;
const rolesKey = (action: ContentAccessAction) => `${action}Roles`;

const buildFormSchema = (response: ContentAccessAdminResponse) => {
  const shape: Record<string, z.ZodType> = {};
  const knownRoleIds = new Set(response.roles.map(role => role.id));
  for (const action of CONTENT_ACCESS_ACTIONS) {
    const own = response.report.overrides[action];
    const choices: [Mode, ...Mode[]] =
      action === "downloadAttachments" && !response.attachments.privateStorage
        ? ["inherit", "everyone"]
        : [...MODES];
    shape[modeKey(action)] = z
      .enum(choices)
      .default(own && choices.includes(own.mode) ? own.mode : "inherit");
    shape[rolesKey(action)] = z
      .array(z.number().int().positive())
      .default(
        own?.mode === "roles"
          ? own.roleIds.filter(id => knownRoleIds.has(id))
          : [],
      );
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
          message: "Pick at least one group.",
          path: [rolesKey(action)],
        });
      }
    }
  });
};

/** The overrides the form's values describe. `roles` with none picked is left out. */
const overridesOf = (
  values: Record<string, unknown>,
): ContentAccessOverrides => {
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

const rulesOf = (
  values: Record<string, unknown>,
): Record<ContentAccessAction, ContentAccessRuleValue> =>
  Object.fromEntries(
    CONTENT_ACCESS_ACTIONS.map(action => {
      const mode = values[modeKey(action)];
      const roles = values[rolesKey(action)];
      const rule: ContentAccessRuleValue =
        mode === "everyone" || mode === "members"
          ? { mode }
          : mode === "roles"
            ? {
                mode: "roles",
                roleIds: Array.isArray(roles)
                  ? roles.filter((id): id is number => typeof id === "number")
                  : [],
              }
            : "inherit";

      return [action, rule];
    }),
  ) as Record<ContentAccessAction, ContentAccessRuleValue>;

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
 * The matrix of the rules being edited, with the server's preview of them -
 * which counts every ancestor and the definition's defaults, the same way the
 * public site will - plus what else the rules reach.
 */
const AccessBody = ({
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
  const submissionAttempts = useSelector(
    form.store,
    state => state.submissionAttempts,
  );
  const key = JSON.stringify(overridesOf(values));
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
    queryKey: [
      "vitnode",
      "admin",
      "access-preview",
      target.family,
      scopeId,
      debounced,
    ],
    retry: false,
    staleTime: Infinity,
  });
  const data = preview.data ?? initial;
  const audienceText = useAudienceText(data.roles);
  const rules = rulesOf(values);
  const disabledActions = new Set<ContentAccessAction>(
    initial.attachments.privateStorage ? [] : ["downloadAttachments"],
  );
  const errors =
    submissionAttempts > 0
      ? CONTENT_ACCESS_ACTIONS.filter(action => {
          const rule = rules[action];

          return (
            rule !== "inherit" &&
            rule.mode === "roles" &&
            rule.roleIds.length === 0
          );
        })
      : [];
  const nameOf = (id: string) => scopeNames.get(id) ?? `#${id}`;

  const change = (
    action: ContentAccessAction,
    rule: ContentAccessRuleValue,
  ) => {
    const next: ContentAccessRuleValue =
      rule !== "inherit" && disabledActions.has(action)
        ? { mode: "everyone" }
        : rule;
    form.setFieldValue(
      modeKey(action),
      next === "inherit" ? "inherit" : next.mode,
    );
    form.setFieldValue(
      rolesKey(action),
      next !== "inherit" && next.mode === "roles" ? next.roleIds : [],
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div aria-busy={preview.isFetching}>
        <ContentAccessMatrix
          audienceText={audienceText}
          disabledActions={disabledActions}
          errors={errors}
          onChange={change}
          preview={data}
          scopeNames={new Map([...scopeNames, [scopeId, t("this_scope")]])}
          values={rules}
        />
      </div>

      <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
        {data.report.warnings.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {data.report.warnings.map(warning => (
              <li
                className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm leading-relaxed text-pretty"
                key={`${warning.action}-${warning.scopeId}`}
              >
                <AlertTriangleIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                {t("warnings.nobody", {
                  action: t(`actions.${warning.action}.label`),
                  scope: nameOf(warning.scopeId),
                })}
              </li>
            ))}
          </ul>
        ) : null}

        {disabledActions.has("downloadAttachments") ? (
          <p className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed text-pretty">
            <PaperclipIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {t.rich("attachments.unsupported", { docs: privateStorageLink })}
          </p>
        ) : null}

        {data.report.descendants > 0 ? (
          <p className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed text-pretty">
            <FolderTreeIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {t("descendants", { count: data.report.descendants })}
          </p>
        ) : null}

        <FilesPanel target={target} />
      </div>
    </div>
  );
};

/**
 * Where the family's files are stored. A rule cannot make a file private that
 * still has a public URL, so this says how many do and moves them on request.
 */
const FilesPanel = ({ target }: { target: ContentAccessApiTarget }) => {
  const t = useTranslations("core.access.admin.files");
  const tError = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const query = useQuery(contentAccessFilesQuery(target));
  const [isPending, startTransition] = React.useTransition();

  if (query.isPending) {
    return (
      <div
        aria-busy="true"
        className="flex flex-col gap-2 rounded-lg border p-3"
      >
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  if (!query.data || query.data.public === 0) return null;

  const { privateStorage, public: publicCount } = query.data;
  const protect = () => {
    startTransition(async () => {
      const result = await protectContentAccessFiles(target);
      if (!result) {
        toast.error(tError("title"), { description: t("failed") });

        return;
      }
      toast.success(t("success"), {
        description: t("successDesc", {
          moved: result.moved,
          remaining: result.remaining,
          shared: result.shared,
        }),
      });
      await queryClient.invalidateQueries({
        queryKey: contentAccessFilesQuery(target).queryKey,
      });
    });
  };

  return (
    <section
      aria-label={t("public_title", { count: publicCount })}
      className="border-warn/30 bg-warn/5 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-sm leading-relaxed text-pretty">
        <ShieldAlertIcon
          aria-hidden="true"
          className="text-warn mt-0.5 size-4 shrink-0"
        />
        <span>
          <span className="font-medium">
            {t("public_title", { count: publicCount })}
          </span>{" "}
          <span className="text-muted-foreground">
            {privateStorage
              ? t("public_desc")
              : t.rich("unsupported", { docs: privateStorageLink })}
          </span>
        </span>
      </p>
      {privateStorage ? (
        <Button
          className="shrink-0 self-start sm:self-auto"
          isLoading={isPending}
          onClick={protect}
          size="sm"
          type="button"
          variant="outline"
        >
          <ShieldCheckIcon aria-hidden="true" />
          {t("protect", { count: publicCount })}
        </Button>
      ) : null}
    </section>
  );
};

const AccessFooter = ({ submitLabel }: { submitLabel: string }) => {
  const t = useTranslations("core.global");
  const { form } = useFormApi();
  const isDirty = useSelector(form.store, state => !state.isDefaultValue);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  return (
    <div className="bg-muted/50 flex items-center justify-between gap-3 border-t px-4 py-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))] sm:px-6">
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {isDirty ? t("unsaved_changes") : null}
      </p>
      <div className="flex items-center gap-2">
        <DialogClose render={<Button variant="ghost">{t("cancel")}</Button>} />
        <Button disabled={!isDirty} isLoading={isSubmitting} type="submit">
          <SaveIcon aria-hidden="true" />
          {submitLabel}
        </Button>
      </div>
    </div>
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
  const formSchema = buildFormSchema(response);

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const parsed = zodContentAccessOverrides.safeParse(overridesOf(values));
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
      fields={[]}
      formSchema={formSchema}
      key={locale}
      layout={() => (
        <>
          <AccessBody
            initial={response}
            scopeId={scopeId}
            scopeNames={scopeNames}
            target={target}
          />
          <AccessFooter submitLabel={t("submit")} />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

/**
 * The access editor of one scope - a container, a blog category, any scope a
 * plugin declares: who may view, read, comment and download, as a matrix of
 * guests, signed-in members and roles by action. Each action inherits or is
 * set here; a lock marks a ticked group a parent or a prerequisite still
 * keeps out. Rendered in {@link ContentAccessDialog}.
 */
export const ContentAccessFormContent = (props: ContentAccessFormProps) => {
  const t = useTranslations("core.access.admin");
  const query = useQuery(contentAccessQuery(props.target, props.scopeId));

  if (query.isPending) return <ContentAccessMatrixSkeleton />;

  if (!query.data) {
    return (
      <Empty role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlertIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("loadError.title")}</EmptyTitle>
          <EmptyDescription>{t("loadError.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <AccessForm key={query.dataUpdatedAt} response={query.data} {...props} />
  );
};
