import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";

import { SignInView } from "@/views/auth/sign-in/sign-in-view";

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "core.global" });

  return {
    title: t("login"),
  };
};

export default function Page() {
  return <SignInView />;
}
