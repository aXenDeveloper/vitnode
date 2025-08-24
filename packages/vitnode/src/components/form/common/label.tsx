import { FormLabel } from '@/components/ui/form';
import { cn } from '@/lib/utils';

export const AutoFormLabel = ({
  children,
  labelRight,
  className,
  ...props
}: React.ComponentProps<typeof FormLabel> & {
  labelRight?: React.ReactNode;
}) => {
  return (
    <FormLabel
      className={cn(
        {
          'flex flex-wrap items-center': labelRight,
        },
        className,
      )}
      {...props}
    >
      {children}
      {labelRight && <span className="ml-auto">{labelRight}</span>}
    </FormLabel>
  );
};
