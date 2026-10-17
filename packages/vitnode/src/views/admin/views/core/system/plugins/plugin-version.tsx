import { cn } from "cn";
import { FlaskConicalIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

import { unstableChannelLabel, unstableChannelOf } from "./unstable-channel";

const UnstableChannelTag = ({ version }: { version: string }) => {
  const t = useTranslations("admin.system.plugins.unstable");
  const channel = unstableChannelOf(version);
  if (channel === null) return null;

  const label = unstableChannelLabel(channel);

  return (
    <Badge
      className="bg-warn/10 text-warn dark:bg-warn/20 h-4.5 gap-1 px-1.5"
      title={t("hint", { channel: label })}
      variant="outline"
    >
      <FlaskConicalIcon aria-hidden data-icon="inline-start" />
      {label}
      <span className="sr-only">{t("sr")}</span>
    </Badge>
  );
};

export const PluginVersion = ({
  className,
  version,
}: {
  className?: string;
  version: null | string;
}) => {
  const t = useTranslations("admin.system.plugins");

  if (version === null) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {t("version_unknown")}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-mono whitespace-nowrap tabular-nums">
        {version}
      </span>
      <UnstableChannelTag version={version} />
    </span>
  );
};
