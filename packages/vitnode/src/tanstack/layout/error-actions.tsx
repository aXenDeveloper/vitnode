"use client";

import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, HomeIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { RouterLink } from "./router-link";

/**
 * "Go back" and "go home", for a screen that ends in a dead end.
 *
 * The TanStack half of what `ErrorViewActions` renders in Next.js: the same two
 * buttons and the same two strings, with this framework's navigation behind
 * them. The shared error screens take their actions as a slot precisely because
 * this is the part that cannot be shared - `router.history.back()` here,
 * `next-intl`'s `useRouter().back()` there.
 *
 * A component rather than a snippet because more than one screen outside the
 * main shell needs exactly it: an SSO callback's failure states, and the 404 a
 * reset-password page shows on an install with no email adapter. Copied into the
 * second of those, the two would have drifted the first time either string
 * changed.
 *
 * `core.global` is provided by the host's root for every page, so this renders
 * correctly without a route-scoped message provider above it - which matters,
 * because a `notFoundComponent` replaces the component that would have mounted
 * one.
 *
 * Declare it at module scope wherever it is used, so it is the same component
 * type on every render.
 */
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
