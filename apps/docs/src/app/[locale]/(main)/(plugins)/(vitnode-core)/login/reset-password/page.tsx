import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";

import { PasswordResetView } from "@vitnode/core/views/auth/password-reset/password-reset-view";

// instant = false: kept on purpose. The page is only meaningful on an install
// with an email adapter, and `PasswordResetView` calls `notFound()` when there
// is none - so the response status depends on a read only the API can answer.
// That read cannot be prerendered, and behind a `<Suspense>` boundary it would
// land after the fallback had already committed the response to 200, leaving
// crawlers, caches and monitoring with a successful reset-password page whose
// body says not-found. The route blocks so the status is decided first.
export const instant = false;

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("core.auth.reset_password");

  return {
    title: t("title"),
  };
};

export default function Page(
  props: React.ComponentProps<typeof PasswordResetView>,
) {
  return <PasswordResetView {...props} />;
}
