import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { cn } from "cn";
import { SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { PermissionStaffScope } from "@/api/lib/permission-staff";
import type { StaffScopeFamily } from "@/views/admin/views/core/staff/staff-model";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";

import {
  staffScopeResourcesQueryOptions,
  staffScopeSelectionQueryOptions,
} from "./scope-query";

const SEARCH_DELAY_MS = 250;

const useDebounced = (value: string): string => {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [value]);

  return debounced;
};

const ResourceLabel = ({
  context,
  label,
}: {
  context: string[];
  label: string;
}) => (
  <span className="flex min-w-0 flex-col">
    <span className="truncate text-sm">{label}</span>
    {context.length > 0 ? (
      <span className="text-muted-foreground truncate text-xs">
        {context.join(" › ")}
      </span>
    ) : null}
  </span>
);

export interface StaffScopeDialogContentProps {
  family: StaffScopeFamily;
  moduleScopedCount: number;
  onApply: (scope: PermissionStaffScope, applyToModule: boolean) => void;
  onCancel: () => void;
  value: PermissionStaffScope | undefined;
}

export const StaffScopeDialogContent = ({
  family,
  moduleScopedCount,
  onApply,
  onCancel,
  value,
}: StaffScopeDialogContentProps) => {
  const t = useTranslations("admin.staff.edit.scope");
  const [mode, setMode] = React.useState<"all" | "selected">(
    value?.mode ?? "all",
  );
  const [selected, setSelected] = React.useState<string[]>(
    value?.mode === "selected" ? value.ids : [],
  );
  const [applyToModule, setApplyToModule] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search.trim());

  const list = useInfiniteQuery({
    ...staffScopeResourcesQueryOptions({
      family: family.id,
      search: debounced,
    }),
    enabled: mode === "selected",
    placeholderData: keepPreviousData,
  });
  const initialIds = React.useMemo(
    () => (value?.mode === "selected" ? value.ids : []),
    [value],
  );
  const saved = useQuery(
    staffScopeSelectionQueryOptions({ family: family.id, ids: initialIds }),
  );

  const known = new Map<string, { context: string[]; label: string }>();
  for (const item of saved.data?.items ?? []) known.set(item.id, item);
  for (const page of list.data?.pages ?? []) {
    for (const item of page.items) known.set(item.id, item);
  }
  const missing = new Set(saved.data?.missing ?? []);
  const items = list.data?.pages.flatMap(page => page.items) ?? [];

  const toggle = (id: string, checked: boolean) => {
    setSelected(previous =>
      checked
        ? [...new Set([...previous, id])]
        : previous.filter(entry => entry !== id),
    );
  };

  const canApply = mode === "all" || selected.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        aria-label={t("legend")}
        onValueChange={next => {
          setMode(next === "selected" ? "selected" : "all");
        }}
        value={mode}
      >
        <Label className="flex items-start gap-3 rounded-lg border p-3">
          <RadioGroupItem className="mt-0.5" value="all" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("all")}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {t("all_desc")}
            </span>
          </span>
        </Label>
        <Label className="flex items-start gap-3 rounded-lg border p-3">
          <RadioGroupItem className="mt-0.5" value="selected" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("selected_label")}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {t("selected_desc")}
            </span>
          </span>
        </Label>
      </RadioGroup>

      {mode === "selected" ? (
        <div className="flex flex-col gap-3">
          {selected.length > 0 ? (
            <section
              aria-label={t("selection_title", { count: selected.length })}
              className="flex flex-col gap-2"
            >
              <h3 className="text-muted-foreground text-xs font-semibold uppercase">
                {t("selection_title", { count: selected.length })}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {selected.map(id => {
                  const resource = known.get(id);
                  const gone = missing.has(id);
                  const name = resource?.label ?? `#${id}`;

                  return (
                    <li
                      className={
                        gone
                          ? "border-destructive/40 bg-destructive/5 text-destructive flex items-center gap-1 rounded-md border py-1 ps-2 pe-1 text-xs"
                          : "bg-muted text-foreground flex items-center gap-1 rounded-md py-1 ps-2 pe-1 text-xs"
                      }
                      key={id}
                      title={gone ? t("removed_desc") : undefined}
                    >
                      {gone ? (
                        <TriangleAlertIcon aria-hidden className="size-3" />
                      ) : null}
                      <span>
                        {name}
                        {gone ? ` (${t("removed")})` : null}
                      </span>
                      <button
                        aria-label={t("remove", { name })}
                        className="hover:bg-background/60 rounded p-0.5"
                        onClick={() => {
                          toggle(id, false);
                        }}
                        type="button"
                      >
                        <XIcon aria-hidden className="size-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("none_selected")}
            </p>
          )}

          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              aria-label={t("search", { family: family.label })}
              className="ps-8"
              onChange={event => {
                setSearch(event.target.value);
              }}
              placeholder={t("search", { family: family.label })}
              value={search}
            />
          </div>

          <div
            aria-busy={list.isFetching && !list.isFetchingNextPage}
            className={cn(
              "max-h-72 overflow-y-auto rounded-lg border transition-opacity",
              list.isPlaceholderData && "opacity-60",
            )}
          >
            {list.isPending ? (
              <div
                className="flex items-center justify-center gap-2 p-4 text-sm"
                role="status"
              >
                <Spinner aria-hidden="true" />
                {t("loading")}
              </div>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center text-sm">
                {t("empty")}
              </p>
            ) : (
              <ul className="divide-y">
                {items.map(item => (
                  <li key={item.id}>
                    <label className="hover:bg-muted/40 flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={selected.includes(item.id)}
                        onCheckedChange={checked => {
                          toggle(item.id, checked);
                        }}
                      />
                      <ResourceLabel
                        context={item.context}
                        label={item.label}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {list.hasNextPage ? (
              <div className="border-t p-2">
                <Button
                  className="w-full"
                  isLoading={list.isFetchingNextPage}
                  onClick={async () => {
                    await list.fetchNextPage();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {t("load_more")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {moduleScopedCount > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={applyToModule}
            onCheckedChange={checked => {
              setApplyToModule(checked);
            }}
          />
          {t("apply_module")}
        </label>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel} variant="outline">
          {t("cancel")}
        </Button>
        <Button
          disabled={!canApply}
          onClick={() => {
            onApply(
              mode === "all"
                ? { family: family.id, mode: "all" }
                : { family: family.id, ids: selected, mode: "selected" },
              applyToModule,
            );
          }}
        >
          {t("apply")}
        </Button>
      </div>
    </div>
  );
};

export default StaffScopeDialogContent;
