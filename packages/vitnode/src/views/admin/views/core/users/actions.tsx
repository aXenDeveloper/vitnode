"use client";

import { EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { Link } from "@/lib/navigation";

export const UsersAdminActions = ({ nameCode }: { nameCode: string }) => {
  const t = useTranslations("admin.user.list");

  return (
    <TooltipWithContent text={t("view")}>
      <Link
        className={buttonVariants({ variant: "ghost" })}
        href={`/admin/core/users/${nameCode}`}
      >
        <EyeIcon />
      </Link>
    </TooltipWithContent>
  );
};
