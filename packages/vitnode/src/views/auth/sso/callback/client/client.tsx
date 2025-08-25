"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Loader } from "@/components/ui/loader";
import { Link, useRouter } from "@/lib/navigation";
import { ErrorView } from "@/views/error/error-view";
import { Button } from "../../../../../components/ui/button";
import type { getMiddlewareApi } from "../../../../../lib/api/get-middleware-api";
import { mutationApi } from "./mutation-api";

export const ClientCallbackSSO = ({
  providerId,
  code,
  state,
  sso,
}: {
  code: string;
  providerId: string;
  sso: Awaited<ReturnType<typeof getMiddlewareApi>>["sso"];
  state: string;
}) => {
  const t = useTranslations("core.auth.sso");
  const { replace } = useRouter();
  const { isError, error } = useQuery({
    queryKey: ["core.auth.sso.callback.sign-up", providerId, code],
    queryFn: async () => {
      const mutation = await mutationApi({ providerId, code, state });
      if (mutation?.error) {
        throw new Error(mutation.error);
      }
      replace("/");

      return "";
    },
    retry: false,
  });
  const provider = sso.find(p => p.id === providerId);

  if (error?.message === "Email already exists") {
    return (
      <ErrorView
        code={409}
        customActions={
          <Button asChild size="lg">
            <Link href="/login">{t("email_exists.sign_in")}</Link>
          </Button>
        }
        customDescription={t.rich("email_exists.desc", {
          provider: () => (
            <span className="font-semibold">
              {provider?.name ?? providerId}
            </span>
          ),
        })}
        customTitle={t.rich("email_exists.title", {
          provider: () => (
            <span className="font-semibold">
              {provider?.name ?? providerId}
            </span>
          ),
        })}
      />
    );
  }

  if (isError) {
    return <ErrorView code={500} />;
  }

  return (
    <div className="container mx-auto flex items-center justify-center p-4">
      <Loader />
    </div>
  );
};
