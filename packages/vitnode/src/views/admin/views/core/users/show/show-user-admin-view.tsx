import { ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";
import { Link } from "@/lib/navigation";

import { EditImageButton } from "./edit-buttons";
import { EditUserField } from "./edit-field";
import { EditNameCode } from "./edit-name-code";
import { RolesUserAdmin } from "./roles/roles";

export const ShowUserAdminView = async ({ id }: { id: string }) => {
  const t = await getTranslations("admin.user.show");
  const res = await fetcher(adminModule, {
    path: "/{id}",
    method: "get",
    module: "admin/users",
    args: {
      params: { id },
    },
  });

  if (res.status !== 200) {
    notFound();
  }

  const user = await res.json();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <Card className="w-full overflow-hidden pt-0">
        {/* Cover placeholder */}
        <div className="from-primary/30 to-primary/5 relative h-44 w-full bg-linear-to-br">
          <span className="sr-only">{t("coverPlaceholder")}</span>
          <div className="absolute inset-e-3 top-3">
            <EditImageButton label={t("editCover")} />
          </div>
        </div>

        <CardContent className="flex flex-col">
          {/* Avatar */}
          <div className="-mt-16 mb-4 flex justify-center">
            <div className="relative">
              <Avatar
                className="border-card size-32 border-4"
                size={128}
                user={user}
              />
              <div className="absolute inset-e-0 bottom-0 translate-y-1/4">
                <EditImageButton label={t("editAvatar")} />
              </div>
            </div>
          </div>

          {/* Username */}
          <EditUserField
            as="h2"
            field="name"
            id={user.id}
            label={t("editName")}
            showUnverified={!user.emailVerified}
            value={user.name}
            valueClassName="text-foreground truncate text-2xl font-bold"
          />

          <div className="flex items-center gap-1">
            <span className="text-muted-foreground truncate text-sm">
              @{user.nameCode}
            </span>
            <EditNameCode id={user.id} nameCode={user.nameCode} />
          </div>

          {/* Email */}
          <div className="mt-3">
            <EditUserField
              field="email"
              id={user.id}
              label={t("editEmail")}
              type="email"
              value={user.email}
              valueClassName="text-foreground truncate font-medium"
            />
          </div>

          <p className="text-muted-foreground mt-1 text-sm">
            {t("joined")} <DateFormat date={user.createdAt} />
          </p>

          {/* Actions */}
          <div className="mt-6">
            <Button
              className="w-full"
              nativeButton={false}
              render={
                <Link href={`/profile/${user.nameCode}`} target="_blank" />
              }
              variant="ghost"
            >
              {t("goToProfile")} <ExternalLinkIcon />
            </Button>
          </div>
        </CardContent>
      </Card>

      <RolesUserAdmin
        id={user.id}
        role={user.role}
        secondaryRoles={user.secondaryRoles}
      />
    </div>
  );
};
