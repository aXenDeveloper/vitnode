"use client";

import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import {
  RATE_LIMIT_EVENT,
  type RateLimitEventDetail,
} from "@/lib/fetcher/rate-limit";

export const RateLimitListener = () => {
  const t = useTranslations("core.global.errors");

  React.useEffect(() => {
    const handler = (event: Event) => {
      const { retryAfter } =
        (event as CustomEvent<RateLimitEventDetail>).detail ?? {};

      toast.error(t("429.title"), {
        id: "vitnode-rate-limit",
        description: retryAfter
          ? t("429.retry", { seconds: retryAfter })
          : t("429.desc"),
      });
    };

    window.addEventListener(RATE_LIMIT_EVENT, handler);

    return () => {
      window.removeEventListener(RATE_LIMIT_EVENT, handler);
    };
  }, [t]);

  return null;
};
