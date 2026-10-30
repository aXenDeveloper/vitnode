import { FilterXIcon, SearchIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AuditStaffLog } from "@/lib/audit/const";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { AUDIT_AREAS, AUDIT_CORE_PLUGIN_ID } from "@/lib/audit/const";

import type { ActivityFilterOptions, ActivityFilters } from "./activity-query";

import { useActivityLabels } from "./activity-labels";

/**
 * Core's report and approval actions are only ever recorded in the moderator
 * area, and core's other actions never are; plugin actions can be either.
 */
const isModerationAction = (action: string) =>
  action.startsWith("report.") || action.startsWith("submission.");

/** The moderator area has a log of its own. */
const ADMIN_LOG_AREAS = AUDIT_AREAS.filter(area => area !== "moderator");

const FilterSelect = ({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string | undefined) => void;
  options: { label: string; value: string }[];
  value: string | undefined;
}) => {
  const t = useTranslations("core.activity_logs.filters");

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        className="w-full sm:w-44"
        id={id}
        onChange={event => {
          onChange(event.target.value || undefined);
        }}
        size="sm"
        value={value ?? ""}
      >
        <NativeSelectOption value="">{t("all")}</NativeSelectOption>
        {options.map(option => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
};

/**
 * The Activity Logs filters. Every change goes straight to `onChange`, which
 * the screen writes into the URL - so a filtered view can be bookmarked and
 * shared, and the back button undoes a filter.
 */
export const ActivityFiltersBar = ({
  actorName,
  filters,
  onChange,
  options,
  staff,
}: {
  /** The name of the actor `filters.actorId` narrows to, for its chip. */
  actorName?: null | string;
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
  options: ActivityFilterOptions;
  /** The staff log being filtered - it decides which areas and actions apply. */
  staff: AuditStaffLog;
}) => {
  const t = useTranslations("core.activity_logs.filters");
  const tAreas = useTranslations("core.activity_logs.areas");
  const labels = useActivityLabels(options.plugins);
  // The draft belongs to the search it was typed against: once the URL's
  // search changes (a reset, the back button), the field shows the URL again.
  const [draft, setDraft] = React.useState({
    for: filters.search,
    value: filters.search ?? "",
  });
  const search =
    draft.for === filters.search ? draft.value : (filters.search ?? "");
  const setSearch = (value: string) => {
    setDraft({ for: filters.search, value });
  };

  const set =
    <TKey extends keyof ActivityFilters>(key: TKey) =>
    (value: ActivityFilters[TKey] | undefined) => {
      onChange({ ...filters, [key]: value });
    };

  const actions = React.useMemo(() => {
    const visible = options.actions.filter(
      entry =>
        (!filters.pluginId || entry.pluginId === filters.pluginId) &&
        (staff === "moderator"
          ? entry.pluginId !== AUDIT_CORE_PLUGIN_ID ||
            isModerationAction(entry.action)
          : !isModerationAction(entry.action)),
    );
    const unique = new Map<string, string>();
    for (const entry of visible) {
      if (!unique.has(entry.action)) {
        unique.set(
          entry.action,
          labels.action({
            action: entry.action,
            contentTypeId: null,
            pluginId: entry.pluginId,
          }),
        );
      }
    }

    return [...unique]
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filters.pluginId, labels, options.actions, staff]);

  const hasFilters = Object.values(filters).some(
    value => value !== undefined && value !== "",
  );

  return (
    <div
      aria-label={t("label")}
      className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl px-4 py-3 shadow-xs ring-1"
      role="search"
    >
      <form
        className="flex flex-col gap-1"
        onSubmit={event => {
          event.preventDefault();
          set("search")(search.trim() || undefined);
        }}
      >
        <Label htmlFor={`activity-${staff}-search`}>{t("search")}</Label>
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            id={`activity-${staff}-search`}
            maxLength={100}
            onChange={event => {
              setSearch(event.target.value);
            }}
            placeholder={t("search_placeholder")}
            type="search"
            value={search}
          />
          <Button
            aria-label={t("search")}
            size="icon"
            type="submit"
            variant="outline"
          >
            <SearchIcon aria-hidden />
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          id={`activity-${staff}-plugin`}
          label={t("plugin")}
          onChange={value => {
            onChange({ ...filters, action: undefined, pluginId: value });
          }}
          options={options.plugins.map(plugin => ({
            label: labels.plugin(plugin.id),
            value: plugin.id,
          }))}
          value={filters.pluginId}
        />
        {staff === "admin" ? (
          <FilterSelect
            id={`activity-${staff}-area`}
            label={t("area")}
            onChange={value => {
              set("area")(ADMIN_LOG_AREAS.find(area => area === value));
            }}
            options={ADMIN_LOG_AREAS.map(area => ({
              label: tAreas(area),
              value: area,
            }))}
            value={filters.area}
          />
        ) : null}
        <FilterSelect
          id={`activity-${staff}-action`}
          label={t("action")}
          onChange={set("action")}
          options={actions}
          value={filters.action}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor={`activity-${staff}-from`}>{t("from")}</Label>
          <Input
            className="w-full sm:w-40"
            id={`activity-${staff}-from`}
            max={filters.to}
            onChange={event => {
              set("from")(event.target.value || undefined);
            }}
            type="date"
            value={filters.from ?? ""}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor={`activity-${staff}-to`}>{t("to")}</Label>
          <Input
            className="w-full sm:w-40"
            id={`activity-${staff}-to`}
            min={filters.from}
            onChange={event => {
              set("to")(event.target.value || undefined);
            }}
            type="date"
            value={filters.to ?? ""}
          />
        </div>
        {hasFilters ? (
          <Button
            onClick={() => {
              onChange({});
            }}
            size="sm"
            variant="ghost"
          >
            <FilterXIcon aria-hidden />
            {t("reset")}
          </Button>
        ) : null}
      </div>

      {filters.actorId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1 pe-1" variant="secondary">
            {t("actor", { name: actorName ?? `#${filters.actorId}` })}
            <Button
              aria-label={t("clear_actor")}
              className="size-5"
              onClick={() => {
                set("actorId")(undefined);
              }}
              size="icon"
              variant="ghost"
            >
              <XIcon aria-hidden />
            </Button>
          </Badge>
        </div>
      ) : null}
    </div>
  );
};
