"use client";

import { PenIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { Link } from "@/lib/navigation";

import { VerifyEmailUserAdmin } from "./actions/verify-email/verify-email";

export const UsersAdminActions = ({
  id,
  emailVerified,
}: {
  emailVerified: boolean;
  id: number;
}) => {
  const t = useTranslations("admin.user.list");

  return (
    <>
      <VerifyEmailUserAdmin emailVerified={emailVerified} iconOnly id={id} />

      <TooltipWithContent text={t("edit")}>
        <Link
          className={buttonVariants({ variant: "ghost" })}
          href={`/admin/core/users/${id}`}
        >
          <PenIcon />
        </Link>
      </TooltipWithContent>
    </>
  );
};
