import { ArrowLeft, HomeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { BackButtonNotFound } from "./back-button";
import { ErrorContent } from "./error-content";

/**
 * "Go back" and "go home", the Next.js way.
 *
 * Exported because the SSO callback needs exactly these two buttons around the
 * shared error screen it renders for a denied or failed sign-in, and building
 * them a second time is how the two drift apart.
 */
export const ErrorViewActions = () => {
  const t = useTranslations("core.global");

  return (
    <>
      <BackButtonNotFound>
        <ArrowLeft />
        {t("go_back")}
      </BackButtonNotFound>

      <Link
        className={cn(
          buttonVariants({
            size: "lg",
          }),
        )}
        href="/"
      >
        <HomeIcon />
        {t("back_home")}
      </Link>
    </>
  );
};

/**
 * {@link ErrorContent}, wired to Next.js.
 *
 * The props are unchanged, so every `not-found.tsx`, the data table's failure
 * state and the route error boundary see exactly the component they always did.
 * This supplies the two things the shared screen cannot resolve for itself: the
 * strings (`next-intl`, which works in a Server Component *and* in the browser)
 * and the default actions, which are `next-intl`'s locale-aware navigation.
 */
export const ErrorView = ({
  code,
  customDescription,
  customTitle,
  customActions,
}: {
  code: 400 | 403 | 404 | 409 | 429 | 500;
  customActions?: React.ReactNode;
  customDescription?: React.ReactNode;
  customTitle?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");

  return (
    <ErrorContent
      actions={customActions ?? <ErrorViewActions />}
      code={code}
      description={customDescription ?? t(`errors.${code}.desc`)}
      title={customTitle ?? t(`errors.${code}.title`)}
    />
  );
};
