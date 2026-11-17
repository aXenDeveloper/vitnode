import { cn } from "cn";
import { KeyRoundIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { McpTokenSummary } from "./mcp-query";

import { SETTINGS_ROW } from "../settings-group";
import { revokeMcpToken } from "./mcp-query";

const STATUS_VARIANT = {
  active: "default",
  expired: "secondary",
  revoked: "outline",
} as const;

export const McpTokenItem = ({
  onRevoked,
  token,
}: {
  onRevoked: () => Promise<void>;
  token: McpTokenSummary;
}) => {
  const t = useTranslations("core.auth.settings.mcp");
  const tError = useTranslations("core.global.errors");

  return (
    <li className={cn(SETTINGS_ROW, "items-start")}>
      <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
        <KeyRoundIcon aria-hidden="true" className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {token.label}
          </span>
          <Badge variant={STATUS_VARIANT[token.status]}>
            {t(`status.${token.status}`)}
          </Badge>
        </div>
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm leading-relaxed">
          <code>{token.prefix}…</code>
          <span>{t("tools_count", { count: token.tools.length })}</span>
          <span>
            {t("expires")} <DateFormat date={token.expiresAt} />
          </span>
          <span>
            {token.lastUsedAt ? (
              <>
                {t("last_used")} <DateFormat date={token.lastUsedAt} />
              </>
            ) : (
              t("never_used")
            )}
          </span>
        </p>
      </div>
      {token.status === "active" ? (
        <ConfirmActionAlertDialog
          description={t("revoke.desc", { label: token.label })}
          icon={<Trash2Icon />}
          onSubmit={async ({ onClose }) => {
            if (!(await revokeMcpToken(token.id))) {
              toast.error(tError("title"), {
                description: tError("internal_server_error"),
              });

              return;
            }

            await onRevoked();
            toast.success(t("revoke.success"), {
              description: t("revoke.success_desc", { label: token.label }),
            });
            onClose();
          }}
          textSubmit={t("revoke.confirm")}
          title={t("revoke.title")}
        >
          <Button
            aria-label={`${t("revoke.action")}: ${token.label}`}
            size="icon-sm"
            variant="destructive"
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </ConfirmActionAlertDialog>
      ) : null}
    </li>
  );
};
