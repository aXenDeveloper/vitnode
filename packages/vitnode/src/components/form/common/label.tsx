import { FormLabel } from '@/components/ui/form';

export const AutoFormLabel = ({
  children,
  ...props
}: React.ComponentProps<typeof FormLabel>) => {
  return <FormLabel {...props}>{children}</FormLabel>;
};
