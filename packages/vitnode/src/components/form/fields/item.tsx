import { FormField } from '@/components/ui/form';
import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import { z } from 'zod';

export interface ItemAutoFormProps<
  T extends z.ZodTypeAny,
  TName extends FieldPath<z.infer<T>> = FieldPath<z.infer<T>>,
> {
  field: ControllerRenderProps<FieldValues, TName>;
}

export function ItemAutoForm<
  T extends
    | z.ZodEffects<z.ZodObject<z.ZodRawShape>>
    | z.ZodObject<z.ZodRawShape>,
  TName extends FieldPath<z.infer<T>> = FieldPath<z.infer<T>>,
>({
  id,
  component,
}: {
  component: (props: ItemAutoFormProps<T, TName>) => React.ReactNode;
  id: TName;
}) {
  return (
    <FormField
      name={id}
      render={({ field }) => {
        return <>{component({ field })}</>;
      }}
    />
  );
}
