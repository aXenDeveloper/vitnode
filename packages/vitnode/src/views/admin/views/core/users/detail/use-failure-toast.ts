import { toast } from "sonner";
import { useTranslations } from "use-intl";

export const useFailureToast = () => {
  const tError = useTranslations("core.global.errors");

  return () => {
    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };
};
