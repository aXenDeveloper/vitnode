import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { useTranslations } from "use-intl";

import type { CheckoutError } from "./start-checkout";

/** Explains why a checkout could not start. Every code comes from the server. */
export const CheckoutErrorAlert = ({ error }: { error: CheckoutError }) => {
  const t = useTranslations("payments-demo.errors");

  return (
    <Alert variant={error === "already_owned" ? "info" : "destructive"}>
      <AlertTitle>{t(`${error}.title`)}</AlertTitle>
      <AlertDescription className="leading-relaxed text-pretty">
        {t(`${error}.desc`)}
      </AlertDescription>
    </Alert>
  );
};
