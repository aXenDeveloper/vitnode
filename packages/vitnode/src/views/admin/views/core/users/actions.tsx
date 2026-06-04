"use client";

import { EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { Link } from "@/lib/navigation";

import { VerifyEmailUserAdmin } from "./actions/verify-email/verify-email";

export const UsersAdminActions = ({
  nameCode,
  emailVerified,
}: {
  emailVerified: boolean;
  nameCode: string;
}) => {
  const t = useTranslations("admin.user.list");

  return (
    <>
      <VerifyEmailUserAdmin
        emailVerified={emailVerified}
        iconOnly
        nameCode={nameCode}
      />

      <TooltipWithContent text={t("view")}>
        <Link
          className={buttonVariants({ variant: "ghost" })}
          href={`/admin/core/users/${nameCode}`}
        >
          <EyeIcon />
        </Link>
      </TooltipWithContent>
    </>
  );
};
