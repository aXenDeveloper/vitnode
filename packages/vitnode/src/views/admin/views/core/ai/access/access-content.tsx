import { Link } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { UserOption } from "@/components/form/fields/input-users";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { resolveRoleName } from "@/components/role-name";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { formatAiPoints } from "@/lib/ai/format-points";

import type {
  AdminAiAccess,
  AdminAiRoleAccess,
  AdminAiUserOverride,
} from "../ai-query";
import type { AiRoleAccessFormProps } from "./role-access-form-content";
import type { AiUserOverrideFormProps } from "./user-override-form-content";

const AiRoleAccessFormContent = React.lazy(async () =>
  import("./role-access-form-content").then(module => ({
    default: module.AiRoleAccessFormContent,
  })),
);

const AiUserOverrideFormContent = React.lazy(async () =>
  import("./user-override-form-content").then(module => ({
    default: module.AiUserOverrideFormContent,
  })),
);

const DialogFallback = () => (
  <div className="flex items-center justify-center">
    <Spinner size="xl" />
  </div>
);

export interface AiAccessContentProps {
  canManage: boolean;
  data: AdminAiAccess;
  describePermission: (key: string) => string;
  onDeleteUserOverride: (userId: number) => Promise<AdminMutationResult<true>>;
  onSaveRole: AiRoleAccessFormProps["onSave"];
  onSaveUserOverride: AiUserOverrideFormProps["onSave"];
  searchUsers: (search: string) => Promise<UserOption[]>;
}

/** The four separate controls, so nobody mistakes one for another. */
const AiAccessLayers = () => {
  const t = useTranslations("admin.ai.access.layers");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["permission", "points", "daily", "budget"] as const).map(key => (
            <div className="flex flex-col gap-1" key={key}>
              <dt className="font-medium">{t(`${key}.title`)}</dt>
              <dd className="text-muted-foreground leading-relaxed text-pretty">
                {t(`${key}.desc`)}
                {key === "budget" ? (
                  <>
                    {" "}
                    <Link
                      className="text-foreground underline underline-offset-3"
                      to="/admin/core/ai/settings"
                    >
                      {t("budget.link")}
                    </Link>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
};

const AllowanceBadge = ({
  monthlyPoints,
  unlimited,
}: {
  monthlyPoints: null | string;
  unlimited: boolean;
}) => {
  const t = useTranslations("admin.ai.access");
  const locale = useLocale();

  if (unlimited) return <Badge variant="warning">{t("unlimited")}</Badge>;
  if (monthlyPoints === null) {
    return <Badge variant="outline">{t("site_default")}</Badge>;
  }

  return (
    <Badge variant="secondary">
      {t("points_month", { points: formatAiPoints(monthlyPoints, locale) })}
    </Badge>
  );
};

const AiRoleCard = ({
  canManage,
  describePermission,
  onSave,
  permissions,
  role,
}: {
  canManage: boolean;
  describePermission: AiAccessContentProps["describePermission"];
  onSave: AiRoleAccessFormProps["onSave"];
  permissions: AdminAiAccess["permissions"];
  role: AdminAiRoleAccess;
}) => {
  const t = useTranslations("admin.ai.access.roles");
  const locale = useLocale();
  const name = resolveRoleName(role, locale);
  const allowed = permissions.filter(permission => {
    const grant = role.grants.find(row => row.permission === permission.key);

    return grant ? grant.granted : permission.defaultGranted;
  }).length;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {name}
          {role.root ? <Badge variant="outline">{t("root")}</Badge> : null}
        </CardTitle>
        <CardDescription>
          {t("features_allowed", { allowed, total: permissions.length })}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <AllowanceBadge
            monthlyPoints={role.monthlyPoints}
            unlimited={role.unlimited}
          />
          {canManage ? (
            <Dialog>
              <TooltipWithContent text={t("edit")}>
                <DialogTrigger
                  render={
                    <Button
                      aria-label={t("edit")}
                      size="icon"
                      variant="ghost"
                    />
                  }
                >
                  <PencilIcon />
                </DialogTrigger>
              </TooltipWithContent>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t("edit_title", { name })}</DialogTitle>
                  <DialogDescription>{t("edit_desc")}</DialogDescription>
                </DialogHeader>
                <React.Suspense fallback={<DialogFallback />}>
                  <AiRoleAccessFormContent
                    describePermission={describePermission}
                    onSave={onSave}
                    permissions={permissions}
                    role={role}
                  />
                </React.Suspense>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardAction>
      </CardHeader>
    </Card>
  );
};

const UserOverrideDialog = ({
  data,
  onSave,
  searchUsers,
  trigger,
}: Omit<AiUserOverrideFormProps, "data"> & {
  data?: AdminAiUserOverride;
  trigger: React.ReactElement;
}) => {
  const t = useTranslations("admin.ai.access.users");

  return (
    <Dialog>
      {trigger}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {data ? t("edit_title", { name: data.user.name }) : t("add_title")}
          </DialogTitle>
          <DialogDescription>{t("form_desc")}</DialogDescription>
        </DialogHeader>
        <React.Suspense fallback={<DialogFallback />}>
          <AiUserOverrideFormContent
            data={data}
            onSave={onSave}
            searchUsers={searchUsers}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

const RemoveUserOverrideAction = ({
  onDelete,
  override,
}: {
  onDelete: AiAccessContentProps["onDeleteUserOverride"];
  override: AdminAiUserOverride;
}) => {
  const t = useTranslations("admin.ai.access.users.remove");
  const tError = useTranslations("core.global.errors");
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <TooltipWithContent text={t("title")}>
        <AlertDialogTrigger
          render={
            <Button aria-label={t("title")} size="icon" variant="ghost" />
          }
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      </TooltipWithContent>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("desc", { name: override.user.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <Button
            isLoading={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await onDelete(override.user.id);
                if ("error" in result) {
                  toast.error(tError("title"), {
                    description: tError("internal_server_error"),
                  });

                  return;
                }

                toast.success(t("success"), {
                  description: t("success_desc", { name: override.user.name }),
                });
                setOpen(false);
              });
            }}
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const AiUserOverridesSection = ({
  canManage,
  onDelete,
  onSave,
  overrides,
  searchUsers,
}: {
  canManage: boolean;
  onDelete: AiAccessContentProps["onDeleteUserOverride"];
  onSave: AiUserOverrideFormProps["onSave"];
  overrides: AdminAiUserOverride[];
  searchUsers: AiAccessContentProps["searchUsers"];
}) => {
  const t = useTranslations("admin.ai.access.users");

  return (
    <section aria-labelledby="ai-access-users" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold" id="ai-access-users">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("desc")}
          </p>
        </div>
        {canManage ? (
          <UserOverrideDialog
            onSave={onSave}
            searchUsers={searchUsers}
            trigger={
              <DialogTrigger render={<Button variant="outline" />}>
                <PlusIcon />
                {t("add")}
              </DialogTrigger>
            }
          />
        ) : null}
      </div>

      {overrides.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="bg-card ring-foreground/10 divide-y rounded-md ring-1">
          {overrides.map(override => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 p-3"
              key={override.user.id}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">
                  {override.user.name}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  @{override.user.nameCode}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {override.blocked ? (
                  <Badge variant="destructive">{t("blocked")}</Badge>
                ) : (
                  <AllowanceBadge
                    monthlyPoints={override.monthlyPoints}
                    unlimited={override.unlimited}
                  />
                )}
                {canManage ? (
                  <>
                    <UserOverrideDialog
                      data={override}
                      onSave={onSave}
                      searchUsers={searchUsers}
                      trigger={
                        <TooltipWithContent text={t("edit")}>
                          <DialogTrigger
                            render={
                              <Button
                                aria-label={t("edit")}
                                size="icon"
                                variant="ghost"
                              />
                            }
                          >
                            <PencilIcon />
                          </DialogTrigger>
                        </TooltipWithContent>
                      }
                    />
                    <RemoveUserOverrideAction
                      onDelete={onDelete}
                      override={override}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const AiAccessContent = ({
  canManage,
  data,
  describePermission,
  onDeleteUserOverride,
  onSaveRole,
  onSaveUserOverride,
  searchUsers,
}: AiAccessContentProps) => {
  const t = useTranslations("admin.ai.access.roles");

  return (
    <div className="flex flex-col gap-6">
      <AiAccessLayers />

      <section
        aria-labelledby="ai-access-roles"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold" id="ai-access-roles">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {data.permissions.length === 0 ? t("no_features") : t("desc")}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.roles.map(role => (
            <AiRoleCard
              canManage={canManage}
              describePermission={describePermission}
              key={role.id}
              onSave={onSaveRole}
              permissions={data.permissions}
              role={role}
            />
          ))}
        </div>
      </section>

      <AiUserOverridesSection
        canManage={canManage}
        onDelete={onDeleteUserOverride}
        onSave={onSaveUserOverride}
        overrides={data.overrides}
        searchUsers={searchUsers}
      />
    </div>
  );
};
