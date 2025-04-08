import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export const Loader = ({
  className,
  small,
}: {
  className?: string;
  small?: boolean;
}) => {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2
        className={cn('size-10 animate-spin', {
          'size-4': small,
        })}
      />
    </div>
  );
};
