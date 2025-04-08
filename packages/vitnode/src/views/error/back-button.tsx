'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/navigation';

export const BackButtonNotFound = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { back } = useRouter();

  return (
    <Button className={className} onClick={back} size="lg" variant="ghost">
      {children}
    </Button>
  );
};
