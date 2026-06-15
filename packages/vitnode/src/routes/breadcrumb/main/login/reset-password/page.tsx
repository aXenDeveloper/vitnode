import { getTranslations } from "next-intl/server";

import { BreadcrumbMain } from "@/views/breadcrumb/breadcrumb-main";

export default async function BreadcrumbSlot() {
  const [tGlobal, tAuth] = await Promise.all([
    getTranslations("core.global"),
    getTranslations("core.auth"),
  ]);

  return (
    <BreadcrumbMain
      labels={{
        "/login": tGlobal("login"),
        "/login/reset-password": tAuth("reset_password.title"),
      }}
      segments={["login", "reset-password"]}
    />
  );
}
