"use client";

import { CheckIcon, MailIcon, PenIcon, UserSearchIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { FilterOption } from "@/components/table/filters";
import type { AdminRoleSearch } from "@/views/admin/views/core/users/roles/roles-query";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { RoleFormatContent } from "@/components/role-format-content";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { ContentDataTable } from "@/components/table/content";
import { Button, buttonVariants } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminUserRow, AdminUsersPage } from "./users-query";

import { ADMIN_USERS_DEFAULT_ORDER } from "./users-query";

/**
 * The AdminCP users table, with no framework in it.
 *
 * The same columns, the same empty state, the same sort and the same role
 * filter the Next.js `UsersAdminView` renders - lifted out of the Server
 * Component so a TanStack Start route can render them too. What the Server
 * Component keeps is the part only it can do: reading the page with the request's
 * own cookies.
 *
 * Three things arrive as props because they are the three a shared table cannot
 * resolve for itself:
 *
 *     data           the page, from whichever transport fetched it
 *     LinkComponent  how this application renders an internal link
 *     onVerifyEmail  the row action's write, and what to do about the cache
 *     searchRoles    how the role filter looks roles up
 *
 * `ContentDataTable` rather than `DataTable`: the latter is the Next.js binding
 * and mounts `NextDataTableNavigation`. The caller mounts a
 * `DataTableNavigationProvider` of its own instead, which is what makes the
 * URL controls work in either router.
 */

/** Verifying one user's email, from wherever the caller gets it done. */
export type VerifyAdminUserEmail = (
  id: number,
) => Promise<{ error?: unknown; name?: string }>;

export interface UsersAdminTableProps {
  data: AdminUsersPage;
  LinkComponent: AuthLinkComponent;
  onVerifyEmail: VerifyAdminUserEmail;
  searchRoles: AdminRoleSearch;
}

/**
 * The row actions: verify an unverified email, and open the user.
 *
 * Gated on `users:can_edit` read from the AdminCP permission context, which both
 * shells mount from the same admin session - so the button is hidden for exactly
 * the administrators the API would refuse.
 */
const UserRowActions = ({
  LinkComponent,
  onVerifyEmail,
  row,
}: {
  LinkComponent: AuthLinkComponent;
  onVerifyEmail: VerifyAdminUserEmail;
  row: AdminUserRow;
}) => {
  const t = useTranslations("admin.user.list");
  const canEdit = useAdminStaffPermission(ADMIN_USER_PERMISSIONS.edit);

  if (!canEdit) return null;

  return (
    <>
      <VerifyEmailButton
        emailVerified={row.emailVerified}
        id={row.id}
        onVerifyEmail={onVerifyEmail}
      />

      <TooltipWithContent text={t("edit")}>
        <LinkComponent
          className={buttonVariants({ variant: "ghost" })}
          href={`/admin/core/users/${row.id}`}
        >
          <PenIcon />
        </LinkComponent>
      </TooltipWithContent>
    </>
  );
};

/**
 * Marks a user's email verified.
 *
 * A button and `React.useTransition` rather than the `useActionState` +
 * `<form action>` pair this replaces: a form action is a Server Action binding,
 * and the write here is an ordinary promise the caller supplied. The pending
 * state, the icon and the tooltip are the same either way.
 *
 * The toast is the caller's, not this component's: what "it worked" should say
 * differs between an application that revalidates a path and one that
 * invalidates a query, and neither belongs in a table cell.
 */
const VerifyEmailButton = ({
  emailVerified,
  id,
  onVerifyEmail,
}: {
  emailVerified: boolean;
  id: number;
  onVerifyEmail: VerifyAdminUserEmail;
}) => {
  const t = useTranslations("admin.user.verify_email");
  const tError = useTranslations("core.global.errors");
  const [isPending, startTransition] = React.useTransition();

  if (emailVerified) return null;

  return (
    <TooltipWithContent text={t("label")}>
      <Button
        aria-label={t("label")}
        isLoading={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await onVerifyEmail(id);

            if (result.error) {
              toast.error(tError("title"), {
                description: tError("internal_server_error"),
              });

              return;
            }

            toast.success(t("success"), { description: result.name });
          });
        }}
        size="icon"
        type="button"
      >
        <CheckIcon />
      </Button>
    </TooltipWithContent>
  );
};

export const UsersAdminTableContent = ({
  data,
  LinkComponent,
  onVerifyEmail,
  searchRoles,
}: UsersAdminTableProps) => {
  const t = useTranslations("admin.user.list");

  /**
   * The filter's options, as the dropdown wants them.
   *
   * The label is a rendered role rather than a string, so the colour a
   * community gave a role survives into the filter - and the untranslated names
   * become `keywords`, so typing a role's Polish name finds it while reading
   * English.
   */
  const onSearchRoles = React.useCallback(
    async (search: string): Promise<FilterOption[]> =>
      (await searchRoles(search)).map(role => ({
        keywords: role.name.map(item => item.name),
        label: <RoleFormatContent role={role} />,
        value: String(role.id),
      })),
    [searchRoles],
  );

  return (
    <ContentDataTable<AdminUserRow>
      columns={[
        {
          accessorKey: "name",
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <Avatar size={32} user={row} />

              <div className="flex flex-col">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground text-sm">
                  @{row.nameCode}
                </span>
              </div>
            </div>
          ),
          header: t("user"),
        },
        {
          accessorKey: "email",
          cell: ({ row }) => {
            if (row.emailVerified) {
              return <span>{row.email}</span>;
            }

            return (
              <div className="flex items-center gap-2">
                <TooltipWithContent text={t("emailNotVerified")}>
                  <MailIcon className="text-destructive size-4" />
                </TooltipWithContent>

                <span className="text-muted-foreground italic">
                  {row.email}
                </span>
              </div>
            );
          },
          header: t("email"),
        },
        {
          accessorKey: "roleId",
          cell: ({ row }) => (
            <div className="flex flex-col items-start gap-1">
              <RoleFormatContent role={row.role} />
              {row.secondaryRoles.length > 0 && (
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  {row.secondaryRoles.slice(0, 3).map(role => (
                    <RoleFormatContent key={role.id} role={role} />
                  ))}
                  {row.secondaryRoles.length > 3 && (
                    <span>+{row.secondaryRoles.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ),
          header: t("roles"),
        },
        {
          accessorKey: "createdAt",
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
          header: t("createdAt"),
        },
        {
          align: "right",
          cell: ({ row }) => (
            <UserRowActions
              LinkComponent={LinkComponent}
              onVerifyEmail={onVerifyEmail}
              row={row}
            />
          ),
          className: "w-10",
          header: "",
          id: "actions",
        },
      ]}
      customNoResults={{
        description: t("noResults.description"),
        icon: <UserSearchIcon />,
        title: t("noResults.title"),
      }}
      edges={data.edges}
      filters={[
        {
          id: "roleId",
          label: t("roles"),
          onSearch: onSearchRoles,
        },
      ]}
      id="users-table"
      order={{
        columns: ["createdAt", "name"],
        defaultOrder: ADMIN_USERS_DEFAULT_ORDER,
      }}
      pageInfo={data.pageInfo}
      search
      searchPlaceholder={t("searchPlaceholder")}
    />
  );
};
