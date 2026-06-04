import { CalendarIcon, ImageIcon, MailIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { fetcher } from "@/lib/fetcher";

import { VerifyEmailUserAdmin } from "../actions/verify-email/verify-email";

export const ShowUserAdminView = async ({ nameCode }: { nameCode: string }) => {
  const t = await getTranslations("admin.user.show");
  const res = await fetcher(adminModule, {
    path: "/{nameCode}",
    method: "get",
    module: "admin/users",
    args: {
      params: { nameCode },
    },
  });

  if (res.status !== 200) {
    notFound();
  }

  const user = await res.json();

  return (
    <Card className="overflow-hidden pt-0">
      {/* Cover placeholder */}
      <div className="bg-muted text-muted-foreground flex h-40 w-full items-center justify-center sm:h-56">
        <ImageIcon className="size-8 opacity-50" />
        <span className="sr-only">{t("coverPlaceholder")}</span>
      </div>

      <CardContent>
        <div className="-mt-16 flex flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end">
          {/* Avatar placeholder */}
          <Avatar
            className="border-card size-24 border-4 sm:size-32"
            size={128}
            user={user}
          />

          <div className="flex flex-1 flex-col gap-1 pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-2xl font-bold">
                {user.name}
              </h2>
              {!user.emailVerified && (
                <TooltipWithContent text={t("emailNotVerified")}>
                  <MailIcon className="text-destructive size-5" />
                </TooltipWithContent>
              )}
            </div>
            <span className="text-muted-foreground text-sm">
              @{user.nameCode}
            </span>
          </div>

          <VerifyEmailUserAdmin
            emailVerified={user.emailVerified}
            nameCode={user.nameCode}
          />
        </div>

        <div className="text-muted-foreground mt-6 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <MailIcon className="size-4" />
            <span>{user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4" />
            <span>
              {t("joined")} <DateFormat date={user.createdAt} showFullDate />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
