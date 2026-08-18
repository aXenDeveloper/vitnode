import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";

import { SignUpView } from "@/views/auth/sign-up/sign-up-view";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("core.global");

  return {
    title: t("register"),
  };
};

export default function Page() {
  return <SignUpView />;
}
