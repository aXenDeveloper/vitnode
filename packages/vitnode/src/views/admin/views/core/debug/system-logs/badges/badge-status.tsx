import { Badge } from "@/components/ui/badge";

export const BadgeStatus = ({ statusCode }: { statusCode: number }) => {
  let variant: "default" | "destructive" | "secondary" = "secondary";

  if (statusCode >= 200 && statusCode < 300) {
    variant = "default";
  } else if (statusCode >= 400) {
    variant = "destructive";
  }

  return <Badge variant={variant}>{statusCode}</Badge>;
};
