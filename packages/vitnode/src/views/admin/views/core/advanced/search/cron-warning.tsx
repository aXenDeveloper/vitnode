import { XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DOCS_URLS } from "@/lib/docs-links";

export const CronWarning = () => {
  const t = useTranslations("core.search");
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <Alert variant="warning">
      <AlertTitle>{t("admin.cron.title")}</AlertTitle>
      <AlertDescription>
        {t.rich("admin.cron.desc", {
          docs: text => (
            <a href={DOCS_URLS.cron} rel="noopener noreferrer" target="_blank">
              {text}
            </a>
          ),
        })}
      </AlertDescription>
      <AlertAction>
        <Button
          aria-label={t("admin.cron.dismiss")}
          className="text-muted-foreground hover:text-foreground size-7"
          onClick={() => setDismissed(true)}
          size="icon"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  );
};
