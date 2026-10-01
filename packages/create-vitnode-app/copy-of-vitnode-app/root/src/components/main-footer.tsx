import {
  VITNODE_DOCS_URL,
  VITNODE_SPONSOR_URL,
  VITNODE_WEBSITE_URL,
} from "@vitnode/core/lib/docs-links";
import { GLOBAL_NAMESPACE, RouteMessages } from "@vitnode/core/tanstack/i18n";
import { Heart } from "lucide-react";
import { useTranslations } from "use-intl";

export const FOOTER_NAMESPACES = [GLOBAL_NAMESPACE, "app.footer"] as const;

export const MainFooter = () => (
  <RouteMessages namespaces={FOOTER_NAMESPACES}>
    <MainFooterContent />
  </RouteMessages>
);

const MainFooterContent = () => {
  const t = useTranslations("app.footer");

  return (
    <footer className="mt-20 border-t">
      <div className="text-muted-foreground container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 text-sm sm:flex-row">
        <p>
          {t.rich("powered_by", {
            link: chunks => (
              <a
                className="text-foreground font-medium underline-offset-4 hover:underline"
                href={VITNODE_WEBSITE_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                {chunks}
              </a>
            ),
          })}
        </p>

        <nav aria-label="VitNode" className="flex items-center gap-5">
          <a
            className="hover:text-foreground transition-colors"
            href={VITNODE_DOCS_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("docs")}
          </a>
          <a
            className="hover:text-foreground flex items-center gap-1.5 transition-colors"
            href={VITNODE_SPONSOR_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Heart className="size-3.5" />
            {t("sponsor")}
          </a>
        </nav>
      </div>
    </footer>
  );
};
