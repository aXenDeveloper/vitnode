import { cn } from "cn";
import { ChevronRightIcon, LockIcon, SearchIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type {
  ContentAccessAction,
  ContentAccessAudience,
} from "@/content/access/policy";
import type {
  ContentAccessAdminResponse,
  ContentAccessAdminRole,
} from "@/content/access/schemas";

import { roleOptionName } from "@/components/form/fields/roles";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTENT_ACCESS_ACTIONS } from "@/content/access/const";

import type { ContentAccessMatrixRow } from "./matrix";

import {
  audienceIncludes,
  audienceIncludesViaWiderGroup,
  blockingRequirementOf,
  toggleAudienceRow,
} from "./matrix";
import {
  ContentAccessMatrixHeader,
  MATRIX_ACTION_CELL,
  MATRIX_GROUP_CELL,
  MATRIX_ROW,
} from "./matrix-layout";

export type ContentAccessRuleValue = "inherit" | ContentAccessAudience;

const IMPLIED_CHECKBOX =
  "data-checked:border-primary/40 data-checked:bg-primary/40 dark:data-checked:bg-primary/40";

const RoleDot = ({ color }: { color: null | string }) => (
  <span
    aria-hidden="true"
    className="bg-muted-foreground/40 size-2 shrink-0 rounded-full"
    style={color ? { backgroundColor: color } : undefined}
  />
);

const BlockedLock = ({ desc, title }: { desc: string; title: string }) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <button
          aria-label={`${title}. ${desc}`}
          className="text-warn hover:bg-warn/10 focus-visible:ring-ring/50 relative flex size-6 items-center justify-center rounded-md transition-colors duration-150 outline-none after:absolute after:-inset-1 focus-visible:ring-3"
          type="button"
        >
          <LockIcon aria-hidden="true" className="size-3.5" />
        </button>
      }
    />
    <TooltipContent className="flex-col items-start gap-0.5 text-start">
      <span className="font-semibold">{title}</span>
      <span className="leading-relaxed text-pretty">{desc}</span>
    </TooltipContent>
  </Tooltip>
);

/**
 * Who may view, read, comment on and download from one scope, as a matrix of
 * groups by action. Roles fold into one row until expanded. A ticked group
 * that a parent or a prerequisite still keeps out gets a lock explaining why,
 * from the server's preview of the unsaved rules.
 */
export const ContentAccessMatrix = ({
  audienceText,
  disabledActions,
  errors,
  onChange,
  preview,
  scopeNames,
  values,
}: {
  audienceText: (audience: ContentAccessAudience) => string;
  /** Actions whose groups cannot be picked, only inherited or opened. */
  disabledActions: ReadonlySet<ContentAccessAction>;
  errors: readonly ContentAccessAction[];
  onChange: (action: ContentAccessAction, rule: ContentAccessRuleValue) => void;
  preview: ContentAccessAdminResponse;
  scopeNames: ReadonlyMap<string, string>;
  values: Record<ContentAccessAction, ContentAccessRuleValue>;
}) => {
  const t = useTranslations("core.access.admin");
  const tMatrix = useTranslations("core.access.admin.matrix");
  const locale = useLocale();
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const panelId = React.useId();
  const { report, roles } = preview;

  const assignableRoleIds = roles.map(role => role.id);
  const nameOf = (role: ContentAccessAdminRole) => roleOptionName(role, locale);
  const visibleRoles = roles.filter(role =>
    nameOf(role).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const actionLabel = (action: ContentAccessAction) =>
    t(`actions.${action}.label`);
  const scopeName = (id: string) => scopeNames.get(id) ?? `#${id}`;

  const audienceOf = (action: ContentAccessAction): ContentAccessAudience => {
    const value = values[action];

    return value === "inherit" ? report.actions[action].inherited : value;
  };

  const shortAudience = (audience: ContentAccessAudience) =>
    audience.mode === "roles"
      ? tMatrix("short.roles", { count: audience.roleIds.length })
      : tMatrix(`short.${audience.mode}`);

  const sourceText = (action: ContentAccessAction) => {
    const source = report.actions[action].inheritedSource;
    if (source.kind === "scope") {
      return tMatrix("inherit.from_scope", { name: scopeName(source.scopeId) });
    }

    return tMatrix(
      source.kind === "default" ? "inherit.from_default" : "inherit.fallback",
    );
  };

  const blockerOf = (
    action: ContentAccessAction,
    row: ContentAccessMatrixRow,
    group: string,
  ) => {
    const requirement = blockingRequirementOf({
      action,
      requirements: report.actions[action].requirements,
      row,
    });
    if (!requirement) return null;
    if (requirement.via === "ancestor") {
      const scope = scopeName(requirement.scopeId);

      return {
        desc: tMatrix("blocked.ancestor_desc", {
          action: actionLabel(requirement.action),
          audience: audienceText(requirement.audience),
          scope,
        }),
        title: tMatrix("blocked.ancestor_title", { scope }),
      };
    }

    return {
      desc: tMatrix("blocked.prerequisite_desc", {
        action: actionLabel(requirement.action),
        group,
      }),
      title: tMatrix("blocked.prerequisite_title", {
        action: actionLabel(requirement.action),
      }),
    };
  };

  const renderCell = (
    action: ContentAccessAction,
    group: string,
    row: ContentAccessMatrixRow,
  ) => {
    const label = tMatrix("cell", { action: actionLabel(action), group });
    const audience = audienceOf(action);
    const checked = audienceIncludes(audience, row);
    const implied =
      values[action] === "inherit" ||
      audienceIncludesViaWiderGroup(audience, row);
    const blocker = checked ? blockerOf(action, row, group) : null;

    return (
      <div className={MATRIX_ACTION_CELL} key={action} role="cell">
        <span className="relative flex items-center">
          <Checkbox
            aria-label={label}
            checked={checked}
            className={cn(implied && IMPLIED_CHECKBOX)}
            disabled={disabledActions.has(action)}
            onCheckedChange={next => {
              onChange(
                action,
                toggleAudienceRow(audience, row, next, assignableRoleIds),
              );
            }}
          />
          {blocker ? (
            <span className="absolute start-full ms-1">
              <BlockedLock desc={blocker.desc} title={blocker.title} />
            </span>
          ) : null}
        </span>
      </div>
    );
  };

  const baseRows = [
    {
      desc: tMatrix("guests.desc"),
      label: tMatrix("guests.label"),
      row: "guests",
    },
    {
      desc: tMatrix("members.desc"),
      label: tMatrix("members.label"),
      row: "members",
    },
  ] as const;

  return (
    <TooltipProvider>
      <div aria-label={tMatrix("caption")} className="text-sm" role="table">
        <ContentAccessMatrixHeader />

        <div role="rowgroup">
          <div className={MATRIX_ROW} role="row">
            <div className={cn(MATRIX_GROUP_CELL, "py-3")} role="rowheader">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{tMatrix("inherit.label")}</span>
                <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
                  {tMatrix("inherit.desc")}
                </span>
              </span>
            </div>
            {CONTENT_ACCESS_ACTIONS.map(action => {
              const inherits = values[action] === "inherit";

              return (
                <div className="self-start px-1 py-3" key={action} role="cell">
                  <span className="flex flex-col items-center gap-1 text-center">
                    <Switch
                      aria-label={tMatrix("inherit.toggle", {
                        action: actionLabel(action),
                      })}
                      checked={inherits}
                      onCheckedChange={checked => {
                        onChange(
                          action,
                          checked
                            ? "inherit"
                            : report.actions[action].inherited,
                        );
                      }}
                      size="sm"
                    />
                    <span className="hidden h-8 w-full min-w-0 flex-col text-xs leading-snug sm:flex">
                      {inherits ? (
                        <>
                          <span className="truncate font-medium">
                            {shortAudience(report.actions[action].inherited)}
                          </span>
                          <span
                            className="text-muted-foreground truncate"
                            title={sourceText(action)}
                          >
                            {sourceText(action)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground truncate">
                          {tMatrix("inherit.set_here")}
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {baseRows.map(({ desc, label, row }) => (
            <div className={MATRIX_ROW} key={row} role="row">
              <div className={MATRIX_GROUP_CELL} role="rowheader">
                <span className="flex flex-col">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </span>
              </div>
              {CONTENT_ACCESS_ACTIONS.map(action =>
                renderCell(action, label, row),
              )}
            </div>
          ))}
        </div>

        <Collapsible onOpenChange={setExpanded} open={expanded} role="none">
          <div role="rowgroup">
            <div
              className={cn(
                MATRIX_ROW,
                "transition-colors duration-200",
                expanded && "bg-muted/30",
              )}
              role="row"
            >
              <div
                className="col-span-3 min-w-0 px-2 py-1.5 sm:col-span-2 sm:px-4"
                role="rowheader"
              >
                <CollapsibleTrigger
                  aria-controls={panelId}
                  className="hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors duration-150 outline-none focus-visible:ring-3"
                >
                  <ChevronRightIcon
                    aria-hidden="true"
                    className={cn(
                      "text-muted-foreground ease-fluid size-4 shrink-0 transition-transform duration-250 motion-reduce:transition-none",
                      expanded && "rotate-90",
                    )}
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {tMatrix("roles.label")}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {tMatrix("roles.count", { count: roles.length })}
                    </span>
                  </span>
                </CollapsibleTrigger>
              </div>
              {CONTENT_ACCESS_ACTIONS.map(action => {
                const audience = audienceOf(action);
                const ticked = roles.filter(role =>
                  audienceIncludes(audience, role.id),
                );
                const all = ticked.length === roles.length;
                const blocked = ticked.some(
                  role => blockerOf(action, role.id, nameOf(role)) !== null,
                );

                return (
                  <div className="px-1 py-1.5" key={action} role="cell">
                    <span className="flex flex-col items-center gap-1">
                      <Checkbox
                        aria-label={tMatrix("roles.toggle_all", {
                          action: actionLabel(action),
                        })}
                        checked={all}
                        disabled={
                          disabledActions.has(action) ||
                          assignableRoleIds.length === 0
                        }
                        indeterminate={ticked.length > 0 && !all}
                        onCheckedChange={next => {
                          onChange(action, {
                            mode: "roles",
                            roleIds: next ? assignableRoleIds : [],
                          });
                        }}
                      />
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          blocked ? "text-warn" : "text-muted-foreground",
                        )}
                      >
                        {all
                          ? tMatrix("roles.all")
                          : ticked.length === 0
                            ? tMatrix("roles.none")
                            : tMatrix("roles.some", {
                                count: ticked.length,
                                total: roles.length,
                              })}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <CollapsibleContent
            className="group/roles ease-fluid h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-250 data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-180 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none"
            id={panelId}
            keepMounted
            role="rowgroup"
          >
            <div className="ease-fluid transition-transform duration-250 group-data-ending-style/roles:-translate-y-2 group-data-ending-style/roles:duration-180 group-data-starting-style/roles:-translate-y-2 motion-reduce:transition-none">
              <div className="border-b px-4 py-2 sm:px-6" role="row">
                <label className="relative flex items-center" role="cell">
                  <span className="sr-only">{tMatrix("roles.search")}</span>
                  <SearchIcon
                    aria-hidden="true"
                    className="text-muted-foreground pointer-events-none absolute start-3 size-4"
                  />
                  <Input
                    autoComplete="off"
                    className="ps-9"
                    onChange={event => {
                      setQuery(event.target.value);
                    }}
                    placeholder={tMatrix("roles.search")}
                    spellCheck={false}
                    type="search"
                    value={query}
                  />
                </label>
              </div>
              {visibleRoles.length === 0 ? (
                <div
                  className="text-muted-foreground border-b px-6 py-4 text-sm"
                  role="row"
                >
                  <span role="cell">
                    {tMatrix("roles.no_match", { query })}
                  </span>
                </div>
              ) : (
                visibleRoles.map(role => (
                  <div
                    className={cn(
                      MATRIX_ROW,
                      "hover:bg-muted/40 transition-colors duration-150",
                    )}
                    key={role.id}
                    role="row"
                  >
                    <div
                      className={cn(MATRIX_GROUP_CELL, "ps-6 sm:ps-12")}
                      role="rowheader"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <RoleDot color={role.color} />
                        <span className="line-clamp-3 min-w-0 text-pretty">
                          {nameOf(role)}
                        </span>
                      </span>
                    </div>
                    {CONTENT_ACCESS_ACTIONS.map(action =>
                      renderCell(action, nameOf(role), role.id),
                    )}
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {errors.length > 0 ? (
          <p className="text-destructive px-6 pt-3 text-sm" role="alert">
            {tMatrix("pick_group", {
              actions: errors.map(actionLabel).join(", "),
            })}
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
};
