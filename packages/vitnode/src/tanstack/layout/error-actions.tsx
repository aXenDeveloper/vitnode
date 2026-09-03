"use client";

import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, HomeIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { RouterLink } from "./router-link";

export const ErrorActions = ({
  LinkComponent = RouterLink,
}: {
  /** How a path becomes a navigation. See {@link RouterLink} for the default. */
  LinkComponent?: AuthLinkComponent;
}) => {
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

      <LinkComponent className={cn(buttonVariants({ size: "lg" }))} href="/">
        <HomeIcon />
        {t("back_home")}
      </LinkComponent>
    </>
  );
};
