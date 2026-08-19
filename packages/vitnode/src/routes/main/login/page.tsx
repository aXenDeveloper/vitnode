import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";

import { SignInView } from "@/views/auth/sign-in/sign-in-view";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("core.global");

  return {
    title: t("login"),
  };
};

export default function Page() {
  return <SignInView />;
}
