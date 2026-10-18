import { useTranslations } from "use-intl";

import { ErrorContent } from "@/views/error/error-content";

/** The translated 404 page, e.g. the router's `defaultNotFoundComponent`. Needs `core.global` messages. */
export const NotFound = ({ actions }: { actions?: React.ReactNode }) => {
  const t = useTranslations("core.global");

  return (
    <ErrorContent
      actions={actions}
      code={404}
      description={t("errors.404.desc")}
      title={t("errors.404.title")}
    />
  );
};

/** The translated 500 page. Needs `core.global` messages. */
export const Error500Page = ({ actions }: { actions?: React.ReactNode }) => {
  const t = useTranslations("core.global");

  return (
    <ErrorContent
      actions={actions}
      code={500}
      description={t("errors.500.desc")}
      title={t("errors.500.title")}
    />
  );
};
