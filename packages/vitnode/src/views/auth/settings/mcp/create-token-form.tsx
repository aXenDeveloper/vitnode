import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormDesc } from "@/components/form/common/desc";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNumber } from "@/components/form/fields/number";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/ui/form";

import type { McpCreateTokenResult, McpSettings } from "./mcp-query";

import { createMcpToken } from "./mcp-query";

const DEFAULT_LIFETIME_DAYS = 30;

type CreatedToken = Extract<McpCreateTokenResult, { token: string }>;

const ToolsField = ({
  field,
  plugins,
}: ItemAutoFormComponentProps & { plugins: McpSettings["plugins"] }) => {
  const t = useTranslations("core.auth.settings.mcp.create");
  const selected = new Set<string>(
    Array.isArray(field.value) ? (field.value as string[]) : [],
  );

  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(name);
    else next.delete(name);
    field.onChange([...next].sort());
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-foreground mb-1 text-sm font-medium">
        {t("tools")}
      </legend>
      <AutoFormDesc>{t("tools_desc")}</AutoFormDesc>
      {plugins.map(plugin => (
        <div className="flex flex-col gap-2" key={plugin.pluginId}>
          <p className="text-muted-foreground font-mono text-xs">
            {plugin.pluginId}
          </p>
          <ul className="flex flex-col gap-2">
            {plugin.tools.map(tool => {
              const id = `mcp-tool-${tool.name}`;

              return (
                <li
                  className="flex items-start gap-3 rounded-md border p-3"
                  key={tool.name}
                >
                  <Checkbox
                    aria-describedby={`${id}-desc`}
                    checked={selected.has(tool.name)}
                    id={id}
                    onCheckedChange={checked => {
                      toggle(tool.name, checked);
                    }}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className="text-sm font-medium break-all"
                        htmlFor={id}
                      >
                        {tool.name}
                      </label>
                      {tool.annotations?.readOnlyHint ? (
                        <Badge variant="secondary">{t("read_only")}</Badge>
                      ) : null}
                      {tool.requiresAdmin ? (
                        <Badge variant="outline">{t("admin")}</Badge>
                      ) : null}
                    </div>
                    <p
                      className="text-muted-foreground text-sm leading-relaxed text-pretty"
                      id={`${id}-desc`}
                    >
                      {tool.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <FormMessage />
    </fieldset>
  );
};

export const CreateMcpTokenForm = ({
  maxLifetimeDays,
  onCreated,
  plugins,
}: {
  maxLifetimeDays: number;
  onCreated: (created: CreatedToken) => Promise<void> | void;
  plugins: McpSettings["plugins"];
}) => {
  const t = useTranslations("core.auth.settings.mcp");
  const tError = useTranslations("core.global.errors");

  const formSchema = z.object({
    label: z.string().trim().min(1).max(100).default(""),
    expiresInDays: z
      .number()
      .int()
      .min(1)
      .max(maxLifetimeDays)
      .default(Math.min(DEFAULT_LIFETIME_DAYS, maxLifetimeDays)),
    tools: z.array(z.string()).min(1).default([]),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await createMcpToken(values);

    if ("error" in result) {
      toast.error(tError("title"), {
        description:
          result.error === "unknown"
            ? tError("internal_server_error")
            : t(`create.errors.${result.error}`),
      });

      return;
    }

    toast.success(t("created.toast"), {
      description: t("created.toast_desc", { label: result.tokenInfo.label }),
    });
    await onCreated(result);
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormInput
              {...props}
              description={t("create.label_desc")}
              label={t("create.label")}
            />
          ),
          id: "label",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("create.expires_in_days_desc", {
                max: maxLifetimeDays,
              })}
              label={t("create.expires_in_days")}
            />
          ),
          id: "expiresInDays",
        },
        {
          component: props => <ToolsField {...props} plugins={plugins} />,
          id: "tools",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {rendered.label}
            {rendered.expiresInDays}
            {rendered.tools}
          </div>
          <AutoFormSheetFooter submitLabel={t("create.submit")} />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
