import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";

import { PasswordResetView } from "@vitnode/core/views/auth/password-reset/password-reset-view";

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
