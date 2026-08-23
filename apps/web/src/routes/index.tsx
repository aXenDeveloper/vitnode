import { createFileRoute, Link } from "@tanstack/react-router";
import { LocaleSwitcher, LocalizedLink } from "@vitnode/i18n/client";
import { useTranslations } from "use-intl";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const t = useTranslations("home");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold text-balance">{t("title")}</h1>
      <p className="text-muted-foreground leading-relaxed text-pretty">
        {t("description")}
      </p>
      <LocaleSwitcher />
      <div className="flex items-center gap-4">
        {/* Localized: picks up the current locale's prefix. */}
        <LocalizedLink className="text-primary underline" to="/">
          {t("title")}
        </LocalizedLink>
        {/* Never localized, so a plain Link. */}
        <Link className="text-primary underline" to="/admin">
          {t("admin")}
        </Link>
      </div>
    </main>
  );
}
