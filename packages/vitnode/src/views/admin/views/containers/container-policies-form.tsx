import { useQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { ContentLabelTranslator } from "@/content/admin/labels";
import type {
  ContentContainerPolicy,
  ContentContainerPolicyKey,
  ContentContainerPolicyOverrides,
} from "@/content/containers/policies";
import type { AnyContentContainerDefinition } from "@/content/containers/types";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSelect } from "@/components/form/fields/select";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { contentNouns } from "@/content/admin/labels";
import {
  CONTENT_CONTAINER_POLICY_AUTHOR_EDIT,
  CONTENT_CONTAINER_POLICY_CREATE,
  CONTENT_CONTAINER_POLICY_MAX_MINUTES,
  CONTENT_CONTAINER_POLICY_MODES,
} from "@/content/containers/const";
import { zodContentContainerPolicyOverrides } from "@/content/containers/policies";

import type {
  AdminContentContainer,
  AdminContentContainerPolicyReport,
  AdminContentContainerPolicySource,
  ContentContainerMutationResult,
} from "./container-request";

import {
  contentContainerErrorKey,
  contentContainerPoliciesQuery,
} from "./container-query";
import { contentContainerApiTarget } from "./container-request";

export type ContentContainerPoliciesSave = (args: {
  id: number;
  overrides: ContentContainerPolicyOverrides;
}) => Promise<ContentContainerMutationResult<null>>;

export interface ContentContainerPoliciesFormProps {
  container: AdminContentContainer;
  definition: AnyContentContainerDefinition;
  onSavePolicies: ContentContainerPoliciesSave;
  pluginId: string;
  records: readonly AdminContentContainer[];
  singular: string;
}

type ChoiceKey = Exclude<ContentContainerPolicyKey, "authorEditMinutes">;

const CHOICES: { [K in ChoiceKey]: readonly ContentContainerPolicy[K][] } = {
  create: CONTENT_CONTAINER_POLICY_CREATE,
  publish: CONTENT_CONTAINER_POLICY_MODES,
  edits: CONTENT_CONTAINER_POLICY_MODES,
  authorEdit: CONTENT_CONTAINER_POLICY_AUTHOR_EDIT,
};

const CHOICE_KEYS = ["create", "publish", "edits", "authorEdit"] as const;

const choicesOf = (key: ChoiceKey): readonly string[] => CHOICES[key];

const INHERIT = "inherit";

type PolicyEntry = AdminContentContainerPolicyReport["contentTypes"][number];

const fieldId = (index: number, key: ContentContainerPolicyKey) =>
  `type${String(index)}_${key}`;

const authorEditOf = (
  values: Record<string, unknown>,
  index: number,
  entry: PolicyEntry,
): string => {
  const value = values[fieldId(index, "authorEdit")];

  return typeof value === "string" && value !== INHERIT
    ? value
    : entry.inherited.authorEdit;
};

const buildFormSchema = (report: AdminContentContainerPolicyReport) => {
  const shape: Record<string, z.ZodType> = {};

  report.contentTypes.forEach((entry, index) => {
    const saved = report.overrides[entry.contentTypeId] ?? {};
    for (const key of CHOICE_KEYS) {
      const values: [string, ...string[]] = [INHERIT, ...choicesOf(key)];
      shape[fieldId(index, key)] = z
        .enum(values)
        .default(saved[key] ?? INHERIT);
    }
    shape[fieldId(index, "authorEditMinutes")] = z
      .number()
      .int()
      .min(1)
      .max(CONTENT_CONTAINER_POLICY_MAX_MINUTES)
      .nullable()
      .default(saved.authorEditMinutes ?? null);
  });

  return z.object(shape);
};

const PoliciesForm = ({
  container,
  onSavePolicies,
  records,
  report,
  singular,
}: Omit<ContentContainerPoliciesFormProps, "definition" | "pluginId"> & {
  report: AdminContentContainerPolicyReport;
}) => {
  const t = useTranslations("core.containers.policies");
  const tContainers = useTranslations("core.containers");
  const tError = useTranslations("core.global.errors");
  const tRoot = useTranslations() as unknown as ContentLabelTranslator;
  const { setIsDirty, setOpen } = useDialog();
  const headingId = React.useId();

  const formSchema = buildFormSchema(report);

  const optionLabel = (key: ChoiceKey, value: string): string => {
    switch (key) {
      case "authorEdit":
        return t(`authorEdit.${value as ContentContainerPolicy["authorEdit"]}`);
      case "create":
        return t(`create.${value as ContentContainerPolicy["create"]}`);
      case "edits":
      case "publish":
        return t(`${key}.${value as ContentContainerPolicy["publish"]}`);
    }
  };

  const sourceText = (
    entry: PolicyEntry,
    key: ContentContainerPolicyKey,
  ): string => {
    if (report.overrides[entry.contentTypeId]?.[key] !== undefined) {
      return t("source.self", { name: singular });
    }

    const source: AdminContentContainerPolicySource | undefined =
      entry.sources[key];
    if (!source || source.kind === "fallback") return t("source.fallback");
    if (source.kind === "container") {
      const name =
        records.find(record => record.id === source.containerId)?.name ??
        `#${String(source.containerId)}`;

      return t("source.container", { name });
    }

    return t(`source.${source.kind}`);
  };

  const describe = (
    entry: PolicyEntry,
    key: ContentContainerPolicyKey,
  ): React.ReactNode => (
    <>
      <span className="block">{t(`${key}.desc`)}</span>
      <span className="block">{sourceText(entry, key)}</span>
    </>
  );

  const fields = report.contentTypes.flatMap((entry, index) => [
    ...CHOICE_KEYS.map(key => ({
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormSelect
          {...props}
          description={describe(entry, key)}
          label={t(`${key}.label`)}
          labels={[
            {
              label: t("inherit", {
                value: optionLabel(key, entry.inherited[key]),
              }),
              value: INHERIT,
            },
            ...choicesOf(key).map(value => ({
              label: optionLabel(key, value),
              value,
            })),
          ]}
        />
      ),
      id: fieldId(index, key),
    })),
    {
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormNullableNumber
          {...props}
          description={describe(entry, "authorEditMinutes")}
          label={t("authorEditMinutes.label")}
          max={CONTENT_CONTAINER_POLICY_MAX_MINUTES}
          min={1}
          resumeValue={entry.inherited.authorEditMinutes}
          step={1}
          toggleLabel={t("inheritMinutes", {
            count: entry.inherited.authorEditMinutes,
          })}
          unitLabel={t("authorEditMinutes.unit")}
        />
      ),
      hidden: (values: Record<string, unknown>) =>
        authorEditOf(values, index, entry) !== "window",
      id: fieldId(index, "authorEditMinutes"),
    },
  ]);

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const read = values as Record<string, unknown>;
    const raw = Object.fromEntries(
      report.contentTypes.flatMap((entry, index) => {
        const policy: Record<string, unknown> = {};
        for (const key of CHOICE_KEYS) {
          const value = read[fieldId(index, key)];
          if (typeof value === "string" && value !== INHERIT) {
            policy[key] = value;
          }
        }
        const minutes =
          authorEditOf(read, index, entry) === "window"
            ? read[fieldId(index, "authorEditMinutes")]
            : report.overrides[entry.contentTypeId]?.authorEditMinutes;
        if (typeof minutes === "number") policy.authorEditMinutes = minutes;

        return Object.keys(policy).length > 0
          ? [[entry.contentTypeId, policy]]
          : [];
      }),
    );

    const parsed = zodContentContainerPolicyOverrides.safeParse(raw);
    const result = parsed.success
      ? await onSavePolicies({ id: container.id, overrides: parsed.data })
      : { error: { code: "invalidPolicy" as const, status: 400 } };

    if ("error" in result) {
      toast.error(tError("title"), {
        description: tContainers(contentContainerErrorKey(result.error)),
      });

      return;
    }

    toast.success(t("success"), {
      description: t("successDesc", { name: container.name }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={fields}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("desc", { name: container.name })}
            </p>

            {report.contentTypes.length === 0 ? (
              <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm leading-relaxed text-pretty">
                {t("empty")}
              </p>
            ) : null}

            {report.contentTypes.map((entry, index) => {
              const id = `${headingId}-${String(index)}`;

              return (
                <section
                  aria-labelledby={id}
                  className="flex flex-col gap-5 border-t pt-5"
                  key={entry.contentTypeId}
                >
                  <h3
                    className="text-base leading-snug font-semibold text-balance"
                    id={id}
                  >
                    {
                      contentNouns(
                        { id: entry.contentTypeId },
                        entry.pluginId,
                        tRoot,
                      ).title
                    }
                  </h3>
                  {CHOICE_KEYS.map(key => (
                    <React.Fragment key={key}>
                      {rendered[fieldId(index, key)]}
                    </React.Fragment>
                  ))}
                  {rendered[fieldId(index, "authorEditMinutes")]}
                </section>
              );
            })}
          </div>
          <AutoFormSheetFooter
            disabled={report.contentTypes.length === 0}
            submitLabel={t("submit")}
          />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

export const ContentContainerPoliciesFormContent = ({
  definition,
  pluginId,
  ...props
}: ContentContainerPoliciesFormProps) => {
  const t = useTranslations("core.containers.policies");
  const query = useQuery(
    contentContainerPoliciesQuery({
      definitionId: definition.id,
      id: props.container.id,
      target: contentContainerApiTarget({ definition, pluginId }),
    }),
  );

  if (query.isFetching) {
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
          <RotateCwIcon />
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <PoliciesForm key={query.dataUpdatedAt} report={query.data} {...props} />
  );
};
