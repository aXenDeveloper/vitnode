import type { McpScope } from "@vitnode/api/lib/mcp/scopes";

import { MCP_SCOPES } from "@vitnode/api/lib/mcp/scopes";
import { cn } from "cn";
import {
  BotIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  CornerDownRightIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AvatarUser } from "@/components/avatar";

import { Avatar } from "@/components/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { OAuthAuthorizeRequest } from "./authorize-query";

import { OAuthAuthorizeCard } from "./authorize-card";

/** Where the connected apps settings live; the consent page links there. */
export const CONNECTED_APPS_HREF = "/settings/connected-apps";

export type OAuthAnswer = (args: {
  approve: boolean;
  scopes: McpScope[];
}) => Promise<boolean>;

/**
 * The scopes a member may still turn off: any of the selected ones, as long as
 * one stays on - a connection with no scope cannot do anything.
 */
export const canToggleScope = (
  scope: McpScope,
  selected: readonly McpScope[],
): boolean => !selected.includes(scope) || selected.length > 1;

const AppTile = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "bg-primary/10 text-primary ring-primary/20 flex size-12 shrink-0 items-center justify-center rounded-xl ring-1",
      className,
    )}
  >
    <BotIcon aria-hidden="true" className="size-6" />
  </div>
);

const ScopeOption = ({
  checked,
  disabled,
  onCheckedChange,
  scope,
}: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  scope: McpScope;
}) => {
  const t = useTranslations("core.auth.oauth.scopes");
  const id = React.useId();

  return (
    <li>
      <label
        className={cn(
          "flex items-start gap-3 rounded-lg border p-3 transition-colors",
          checked && "border-primary/40 bg-primary/5",
          disabled ? "cursor-not-allowed" : "hover:bg-muted/60 cursor-pointer",
        )}
        htmlFor={id}
      >
        <Checkbox
          aria-describedby={`${id}-desc`}
          checked={checked}
          className="mt-0.5"
          disabled={disabled}
          id={id}
          onCheckedChange={onCheckedChange}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-foreground text-sm font-medium">
            {t(`${scope}.title`)}
          </span>
          <span
            className="text-muted-foreground text-sm leading-relaxed text-pretty"
            id={`${id}-desc`}
          >
            {t(`${scope}.desc`)}
          </span>
        </span>
      </label>
    </li>
  );
};

const DoneContent = ({
  approved,
  name,
}: {
  approved: boolean;
  name: string;
}) => {
  const t = useTranslations("core.auth.oauth.done");

  return (
    <Empty role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {approved ? (
            <CircleCheckIcon aria-hidden="true" />
          ) : (
            <CircleXIcon aria-hidden="true" />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-balance">
          {approved ? t("approved", { name }) : t("denied")}
        </EmptyTitle>
        <EmptyDescription>{t("desc", { name })}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export const OAuthAuthorizeContent = ({
  connectedAppsLink,
  onAnswer,
  request,
  user,
}: {
  /** Renders the link to the connected apps settings around its label. */
  connectedAppsLink: (chunks: React.ReactNode) => React.ReactNode;
  /** Sends the answer; resolves `true` once the browser is on its way back. */
  onAnswer: OAuthAnswer;
  request: OAuthAuthorizeRequest;
  user: AvatarUser;
}) => {
  const t = useTranslations("core.auth.oauth");
  const name = request.client.name;
  const requested = MCP_SCOPES.filter(scope => request.scopes.includes(scope));
  const [selected, setSelected] = React.useState<McpScope[]>(requested);
  const [pending, setPending] = React.useState<"approve" | "deny" | null>(
    null,
  );
  const [done, setDone] = React.useState<"approved" | "denied" | null>(null);
  const legendId = React.useId();

  if (done) {
    return (
      <OAuthAuthorizeCard>
        <DoneContent approved={done === "approved"} name={name} />
      </OAuthAuthorizeCard>
    );
  }

  const answer = async (approve: boolean) => {
    setPending(approve ? "approve" : "deny");
    try {
      const isSent = await onAnswer({ approve, scopes: selected });
      if (isSent) setDone(approve ? "approved" : "denied");
    } finally {
      setPending(null);
    }
  };

  return (
    <OAuthAuthorizeCard>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <AppTile />
          <div className="flex flex-col gap-2">
            <h1 className="text-xl leading-tight font-semibold tracking-tight text-balance wrap-anywhere">
              {t("heading", { name })}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("desc", { name })}
            </p>
          </div>
        </div>

        <div className="bg-muted/50 flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CornerDownRightIcon aria-hidden="true" className="size-3.5" />
            {t("redirect_label")}
          </span>
          <code className="text-foreground font-mono text-base font-semibold break-all">
            {request.redirectHost}
          </code>
        </div>

        <Alert variant="warning">
          <AlertTitle>{t("warning.title")}</AlertTitle>
          <AlertDescription className="leading-relaxed text-pretty">
            {t("warning.desc", { name })}
          </AlertDescription>
        </Alert>

        <fieldset
          aria-describedby={requested.length > 1 ? `${legendId}-hint` : undefined}
          className="flex flex-col gap-3"
        >
          <legend className="text-foreground mb-3 text-sm font-semibold">
            {t("scopes_legend", { name })}
          </legend>
          <ul className="flex flex-col gap-2">
            {requested.map(scope => (
              <ScopeOption
                checked={selected.includes(scope)}
                disabled={
                  pending !== null || !canToggleScope(scope, selected)
                }
                key={scope}
                onCheckedChange={checked => {
                  setSelected(current =>
                    MCP_SCOPES.filter(item =>
                      item === scope ? checked : current.includes(item),
                    ),
                  );
                }}
                scope={scope}
              />
            ))}
          </ul>
          {requested.length > 1 ? (
            <p
              className="text-muted-foreground text-xs"
              id={`${legendId}-hint`}
            >
              {t("scopes_hint")}
            </p>
          ) : null}
        </fieldset>

        <p className="text-muted-foreground flex gap-2 text-sm leading-relaxed text-pretty">
          <ShieldCheckIcon
            aria-hidden="true"
            className="text-success mt-0.5 size-4 shrink-0"
          />
          <span>{t.rich("limits", { link: connectedAppsLink })}</span>
        </p>
      </div>

      <div className="bg-muted/40 flex flex-col gap-4 border-t p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8" size={32} user={user} />
          <div className="flex min-w-0 flex-col text-sm leading-tight">
            <span className="text-muted-foreground text-xs">
              {t("signed_in_as")}
            </span>
            <span className="truncate font-medium">{user.name}</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={pending === "approve"}
            isLoading={pending === "deny"}
            onClick={() => void answer(false)}
            variant="secondary"
          >
            <XIcon aria-hidden="true" />
            {t("deny")}
          </Button>
          <Button
            disabled={pending === "deny" || selected.length === 0}
            isLoading={pending === "approve"}
            onClick={() => void answer(true)}
          >
            <CheckIcon aria-hidden="true" />
            {t("approve")}
          </Button>
        </div>
      </div>
    </OAuthAuthorizeCard>
  );
};
