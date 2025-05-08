import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export const Loader = ({
  className,
  small,
}: {
  className?: string;
  small?: boolean;
}) => {
  if (small) {
    return <Loader2 className={cn('size-4 animate-spin', className)} />;
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('size-10 animate-spin')} />
    </div>
  );
};
