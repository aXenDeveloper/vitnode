import { Link, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowLeft, HomeIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/ui/button";

export const ErrorActions = () => {
  const router = useRouter();
  const t = useTranslations("core.global");

  return (
    <>
      <Button
        onClick={() => {
          router.history.back();
        }}
        size="lg"
        variant="ghost"
      >
        <ArrowLeft />
        {t("go_back")}
      </Button>

      <Link className={cn(buttonVariants({ size: "lg" }))} to="/">
        <HomeIcon />
        {t("back_home")}
      </Link>
    </>
  );
};
