import { ArrowLeft, HomeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { BackButtonNotFound } from "./back-button";

export const ErrorView = ({
  code,
  customDescription,
  customTitle,
  customActions,
}: {
  code: 400 | 403 | 404 | 409 | 500;
  customActions?: React.ReactNode;
  customDescription?: React.ReactNode;
  customTitle?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 sm:py-20">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-primary text-8xl font-bold">{code}</h1>
          <h2 className="text-2xl font-medium">
            {customTitle ?? t(`errors.${code}.title`)}
          </h2>
          <p className="text-muted-foreground">
            {customDescription ?? t(`errors.${code}.desc`)}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {customActions ?? (
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
          )}
        </div>
      </div>
    </div>
  );
};
