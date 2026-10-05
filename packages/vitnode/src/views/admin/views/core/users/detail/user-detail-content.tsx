import { BellIcon, HistoryIcon, LockIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { VerifyAdminUserEmail } from "@/views/admin/views/core/users/list/users-table-content";
import type { AdminRoleSearch } from "@/views/admin/views/core/users/roles/roles-query";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";

import type { UpdateAdminUser } from "./user-fields-content";
import type {
  RemoveAdminUserImage,
  UploadAdminUserImage,
} from "./user-images-content";
import type { AdminUserDetail } from "./user-query";
import type { UpdateAdminUserRoles } from "./user-roles-content";

import { UserIdentityCard } from "./user-identity-card";
import { UserPersonalCard, UserPreferencesCard } from "./user-profile-cards";
import { UserRolesCardContent } from "./user-roles-content";

export interface UserDetailProps {
  canEdit: boolean;
  connectedAccounts: React.ReactNode;
  devices: React.ReactNode;
  notifications: React.ReactNode;
  onRemoveImage: RemoveAdminUserImage;
  onUpdate: UpdateAdminUser;
  onUpdateRoles: UpdateAdminUserRoles;
  onUploadImage: UploadAdminUserImage;
  onVerifyEmail: VerifyAdminUserEmail;
  searchRoles: AdminRoleSearch;
  security: React.ReactNode;
  timeline: React.ReactNode;
  user: AdminUserDetail;
}

export const UserDetailContent = ({
  canEdit,
  connectedAccounts,
  devices,
  notifications,
  onRemoveImage,
  onUpdate,
  onUpdateRoles,
  onUploadImage,
  onVerifyEmail,
  searchRoles,
  security,
  timeline,
  user,
}: UserDetailProps) => {
  const t = useTranslations("admin.user.show.tabs");

  return (
    <div className="mx-auto grid w-full max-w-7xl items-start gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <aside
        aria-label={t("profileLabel")}
        className="flex min-w-0 flex-col gap-6"
      >
        <UserIdentityCard
          canEdit={canEdit}
          onRemoveImage={onRemoveImage}
          onUpdate={onUpdate}
          onUploadImage={onUploadImage}
          onVerifyEmail={onVerifyEmail}
          user={user}
        />
        <UserPersonalCard canEdit={canEdit} onUpdate={onUpdate} user={user} />
        <UserPreferencesCard
          canEdit={canEdit}
          onUpdate={onUpdate}
          user={user}
        />
        <UserRolesCardContent
          canEdit={canEdit}
          id={user.id}
          onUpdateRoles={onUpdateRoles}
          role={user.role}
          searchRoles={searchRoles}
          secondaryRoles={user.secondaryRoles}
        />
        {connectedAccounts}
        {devices}
      </aside>

      <Tabs className="min-w-0 gap-4" defaultValue="activity">
        <h2 className="sr-only">{t("detailsLabel")}</h2>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="w-full min-w-max">
            <TabsTrigger value="activity">
              <HistoryIcon />
              {t("activity")}
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <BellIcon />
              {t("notifications")}
            </TabsTrigger>
            <TabsTrigger value="security">
              <LockIcon />
              <span className="sm:hidden">{t("securityShort")}</span>
              <span className="hidden sm:inline">{t("security")}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsPanels>
          <TabsContent value="activity">{timeline}</TabsContent>
          <TabsContent value="notifications">{notifications}</TabsContent>
          <TabsContent value="security">{security}</TabsContent>
        </TabsPanels>
      </Tabs>
    </div>
  );
};
