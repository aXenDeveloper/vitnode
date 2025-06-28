import { Badge } from '@/components/ui/badge';

export const BadgeStatus = ({ statusCode }: { statusCode: number }) => {
  return (
    <Badge
      variant={
        statusCode >= 200 && statusCode < 300
          ? 'default'
          : statusCode >= 400
            ? 'destructive'
            : 'secondary'
      }
    >
      {statusCode}
    </Badge>
  );
};
