import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

function Admin() {
  const t = useTranslations("admin");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold text-balance">{t("title")}</h1>
      <p className="text-muted-foreground leading-relaxed text-pretty">
        {t("description")}
      </p>
      {/* Never localized, so a plain Link rather than a LocalizedLink. */}
      <Link className="text-primary underline" to="/">
        {t("title")}
      </Link>
    </main>
  );
}
