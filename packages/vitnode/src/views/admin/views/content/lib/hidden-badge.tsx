import { EyeClosedIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { isContentHidden } from "@/content/visibility";

/**
 * "Hidden", for a record readers cannot reach whatever its status says.
 *
 * Words and an icon, never a colour alone: next to a "Published" badge this is
 * the one thing that tells an editor the published record is not public.
 * Renders nothing for a visible record - or for a content type without
 * visibility, whose rows carry no `hiddenAt` at all.
 */
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
      <EyeClosedIcon aria-hidden />
      {label}
    </Badge>
  );
};
