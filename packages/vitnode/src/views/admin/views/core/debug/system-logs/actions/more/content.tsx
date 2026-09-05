import {
  CalendarIcon,
  GlobeIcon,
  HashIcon,
  PlugIcon,
  ServerIcon,
  UserIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { DebugLogRow } from "../../../debug-query";

import { BadgeStatus } from "../../badges/badge-status";
import { BadgeTypeLog } from "../../badges/badge-type-log";

export const ContentMoreActionSystemLogs = ({
  content,
  ipAddress,
  pluginId,
  createdAt,
  type,
  id,
  LinkComponent,
  method,
  path,
  userAgent,
  statusCode,
  user,
}: DebugLogRow & { LinkComponent: AuthLinkComponent }) => {
  const t = useTranslations("admin.debug.logs.more");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HashIcon className="size-4" />
            {t("log_overview.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label
                className="text-muted-foreground text-xs font-medium"
                htmlFor="log-type"
              >
                {t("log_overview.log_type")}
              </Label>
              <BadgeTypeLog type={type} />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">
                {t("log_overview.status_code")}
              </Label>
              <BadgeStatus statusCode={statusCode} />
            </div>
            <div className="space-y-2">
              <Label
                className="text-muted-foreground text-xs font-medium"
                htmlFor="log-id"
              >
                {t("log_overview.log_id")}
              </Label>
              <Input id="log-id" readOnly value={`#${id}`} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label
                className="text-muted-foreground flex items-center gap-1 text-xs font-medium"
                htmlFor="created-at"
              >
                <CalendarIcon className="size-3" />
                {t("log_overview.created_at")}
              </Label>
              <div className="text-sm" id="created-at">
                <DateFormat date={createdAt} />
              </div>
            </div>
            <div className="space-y-2">
              <Label
                className="text-muted-foreground flex items-center gap-1 text-xs font-medium"
                htmlFor="plugin-id"
              >
                <PlugIcon className="size-3" />
                {t("log_overview.plugin")}
              </Label>
              <Input id="plugin-id" readOnly value={pluginId} />
            </div>
            {user && (
              <div className="space-y-2">
                <Label
                  className="text-muted-foreground flex items-center gap-1 text-xs font-medium"
                  htmlFor="user-link"
                >
                  <UserIcon className="size-3" />
                  {t("log_overview.user")}
                </Label>
                <LinkComponent
                  className="border-input bg-background hover:bg-accent hover:text-accent-foreground block rounded-md border px-3 py-2 text-sm font-medium"
                  href={`/admin/core/users/${user.id}`}
                  id="user-link"
                >
                  {user.name} (#{user.id})
                </LinkComponent>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4" />
            {t("request_information.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label
                className="text-muted-foreground text-xs font-medium"
                htmlFor="ip-address"
              >
                {t("request_information.ip_address")}
              </Label>
              <Input id="ip-address" readOnly value={ipAddress} />
            </div>
            <div className="space-y-3">
              <Label
                className="text-muted-foreground text-xs font-medium"
                htmlFor="request-method"
              >
                {t("request_information.request_method")}
              </Label>
              <div className="flex">
                <Badge
                  className="px-3 py-1"
                  id="request-method"
                  variant="outline"
                >
                  {method}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label
              className="text-muted-foreground text-xs font-medium"
              htmlFor="request-url"
            >
              {t("request_information.request_url")}
            </Label>
            <Input id="request-url" readOnly value={path} />
          </div>

          {userAgent && (
            <div className="space-y-3">
              <Label
                className="text-muted-foreground text-xs font-medium"
                htmlFor="user-agent"
              >
                {t("request_information.user_agent")}
              </Label>
              <Textarea
                className="resize-none font-mono text-sm"
                id="user-agent"
                readOnly
                value={userAgent}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ServerIcon className="size-4" />
            {t("log_content.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label
              className="text-muted-foreground text-xs font-medium"
              htmlFor="log-content"
            >
              {t("log_content.full_log")}
            </Label>
            <Textarea
              className="min-h-[120px] font-mono text-sm"
              id="log-content"
              readOnly
              value={content}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
