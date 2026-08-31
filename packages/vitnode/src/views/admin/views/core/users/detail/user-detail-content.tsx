"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { AdminRoleSearch } from "@/views/admin/views/core/users/roles/roles-query";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { UpdateAdminUser } from "./user-fields-content";
import type { AdminUserDetail } from "./user-query";
import type { UpdateAdminUserRoles } from "./user-roles-content";

import {
  EditImageButtonContent,
  EditNameCodeContent,
  EditUserFieldContent,
} from "./user-fields-content";
import { UserRolesCardContent } from "./user-roles-content";

/**
 * The AdminCP user page, with no framework in it.
 *
 * The profile card, the in-place field editors, the roles card and the two tabs
 * - lifted out of the Next.js Server Component so a TanStack route renders the
 * same screen. Four things arrive as props, because four things differ:
 *
 *     canEdit        decided from the reader's permissions and the target's
 *                    `isAdmin`, by `canEditAdminUser` - the same rule in both
 *     LinkComponent  how this application renders an internal link
 *     onUpdate*      the two writes, and what the app does about the cache
 *     timeline       the activity feed, mounted by the caller because its query
 *                    needs a locale and a transport this component has neither
 *                    of
 *
 * `canEdit` is a *display* decision. `assertCanEditAdminTarget` on the API is
 * the rule, re-checked on every write, so an administrator who edits this value
 * in devtools gets visible buttons and a `403`.
 */
export interface UserDetailProps {
  canEdit: boolean;
  LinkComponent: AuthLinkComponent;
  onUpdate: UpdateAdminUser;
  onUpdateRoles: UpdateAdminUserRoles;
  searchRoles: AdminRoleSearch;
  timeline: React.ReactNode;
  user: AdminUserDetail;
}

export const UserDetailContent = ({
  canEdit,
  LinkComponent,
  onUpdate,
  onUpdateRoles,
  searchRoles,
  timeline,
  user,
}: UserDetailProps) => {
  const t = useTranslations("admin.user.show");
  const tSearch = useTranslations("core.search");

  return (
    <Tabs className="mx-auto w-full max-w-lg gap-4" defaultValue="overview">
      <TabsList className="w-full">
        <TabsTrigger value="overview">
          {tSearch("userTab.overview")}
        </TabsTrigger>
        <TabsTrigger value="timeline">
          {tSearch("userTab.timeline")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="flex w-full flex-col gap-4">
          <Card className="w-full overflow-hidden pt-0">
            <div className="from-primary/30 to-primary/5 relative h-44 w-full bg-linear-to-br">
              <span className="sr-only">{t("coverPlaceholder")}</span>
              {canEdit && (
                <div className="absolute inset-e-3 top-3">
                  <EditImageButtonContent label={t("editCover")} />
                </div>
              )}
            </div>

            <CardContent className="flex flex-col">
              <div className="-mt-16 mb-4 flex justify-center">
                <div className="relative">
                  <Avatar
                    className="border-card size-32 border-4"
                    size={128}
                    user={user}
                  />
                  {canEdit && (
                    <div className="absolute inset-e-0 bottom-0 translate-y-1/4">
                      <EditImageButtonContent label={t("editAvatar")} />
                    </div>
                  )}
                </div>
              </div>

              <EditUserFieldContent
                as="h2"
                canEdit={canEdit}
                field="name"
                id={user.id}
                label={t("editName")}
                onUpdate={onUpdate}
                showUnverified={!user.emailVerified}
                value={user.name}
                valueClassName="text-foreground truncate text-2xl font-bold"
              />

              <div className="flex items-center gap-1">
                <span className="text-muted-foreground truncate text-sm">
                  @{user.nameCode}
                </span>
                {canEdit && (
                  <EditNameCodeContent
                    id={user.id}
                    nameCode={user.nameCode}
                    onUpdate={onUpdate}
                  />
                )}
              </div>

              <div className="mt-3">
                <EditUserFieldContent
                  canEdit={canEdit}
                  field="email"
                  id={user.id}
                  label={t("editEmail")}
                  onUpdate={onUpdate}
                  type="email"
                  value={user.email}
                  valueClassName="text-foreground truncate font-medium"
                />
              </div>

              <p className="text-muted-foreground mt-1 text-sm">
                {t("joined")} <DateFormat date={user.createdAt} />
              </p>

              <div className="mt-6">
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={
                    <LinkComponent
                      href={`/profile/${user.nameCode}`}
                      target="_blank"
                    />
                  }
                  variant="ghost"
                >
                  {t("goToProfile")} <ExternalLinkIcon />
                </Button>
              </div>
            </CardContent>
          </Card>

          <UserRolesCardContent
            canEdit={canEdit}
            id={user.id}
            onUpdateRoles={onUpdateRoles}
            role={user.role}
            searchRoles={searchRoles}
            secondaryRoles={user.secondaryRoles}
          />
        </div>
      </TabsContent>

      <TabsContent value="timeline">{timeline}</TabsContent>
    </Tabs>
  );
};
