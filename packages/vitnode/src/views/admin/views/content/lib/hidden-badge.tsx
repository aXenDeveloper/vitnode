import { isContentHidden } from "@vitnode/api/content/visibility";
import { EyeOffIcon } from "lucide-react";

import { HiddenIcon } from "@/components/hidden-icon";
import { Badge } from "@/components/ui/badge";

export const ContentHiddenBadge = ({
  label,
  row,
}: {
  label: string;
  row: { hiddenAt?: unknown };
}) => {
  if (!isContentHidden(row)) return null;

  return (
    <Badge variant="warning">
      <EyeOffIcon aria-hidden />
      {label}
    </Badge>
  );
};

export const ContentHiddenIcon = ({
  className,
  label,
  row,
}: {
  className?: string;
  label: string;
  row: { hiddenAt?: unknown };
}) =>
  isContentHidden(row) ? (
    <HiddenIcon className={className} label={label} />
  ) : null;
