import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

export const LastUsedBadge = ({ id }: { id: string }) => {
  const t = useTranslations("core.auth.sign_in");

  return (
    <Badge
      className="border-transparent bg-current/15 text-current transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0"
      id={id}
      variant="secondary"
    >
      {t("last_used")}
    </Badge>
  );
};
