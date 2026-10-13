import { useQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormLabel } from "@/components/form/common/label";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import {
  contentFrontendRegistry,
  hasContentFrontendRegistry,
} from "@/content/admin/registry";
import { isAdminRequestError } from "@/views/admin/admin-request";
import { contentContainerListQuery } from "@/views/admin/views/containers/container-query";
import { contentContainerApiTarget } from "@/views/admin/views/containers/container-request";
import {
  AutoFormContainerSelect,
  containerSelectOptions,
} from "@/views/admin/views/containers/container-select";

export const useContentContainerOptions = (
  definitionId: string | undefined,
) => {
  const entry =
    definitionId !== undefined && hasContentFrontendRegistry()
      ? contentFrontendRegistry().containers.byId(definitionId)
      : undefined;
  const query = useQuery({
    ...contentContainerListQuery({
      definitionId: definitionId ?? "",
      target: entry
        ? contentContainerApiTarget(entry)
        : { permissionModule: "", pluginId: "" },
    }),
    enabled: entry !== undefined,
  });

  return { entry, query };
};

const ContainerFieldProblem = ({
  label,
  message,
  onRetry,
}: {
  label: string;
  message: string;
  onRetry?: () => void;
}) => {
  const t = useTranslations("core.content.form.container");

  return (
    <>
      <AutoFormLabel>{label}</AutoFormLabel>
      <div
        className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <p className="text-destructive text-sm leading-relaxed text-pretty">
          {message}
        </p>
        {onRetry ? (
          <Button
            className="shrink-0"
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCwIcon />
            {t("retry")}
          </Button>
        ) : null}
      </div>
      <FormMessage />
    </>
  );
};

export const ContentContainerField = ({
  spec,
  ...props
}: ItemAutoFormComponentProps & { spec: ContentFormFieldSpec }) => {
  const t = useTranslations("core.content.form.container");
  const { entry, query } = useContentContainerOptions(
    spec.containerDefinitionId,
  );

  if (!entry) {
    return (
      <ContainerFieldProblem label={spec.label} message={t("unregistered")} />
    );
  }

  if (query.isPending) {
    return (
      <>
        <AutoFormLabel>{spec.label}</AutoFormLabel>
        <Skeleton className="h-9 w-full" />
      </>
    );
  }

  if (query.isError) {
    const forbidden =
      isAdminRequestError(query.error) && query.error.status === 403;

    return (
      <ContainerFieldProblem
        label={spec.label}
        message={t(forbidden ? "forbidden" : "loadFailed")}
        onRetry={
          forbidden
            ? undefined
            : () => {
                void query.refetch();
              }
        }
      />
    );
  }

  const options = containerSelectOptions(query.data);

  if (options.length === 0) {
    return <ContainerFieldProblem label={spec.label} message={t("empty")} />;
  }

  return (
    <AutoFormContainerSelect
      {...props}
      label={spec.label}
      options={
        spec.nullable
          ? [{ depth: 1, id: null, label: t("none") }, ...options]
          : options
      }
      placeholder={t("placeholder")}
    />
  );
};
