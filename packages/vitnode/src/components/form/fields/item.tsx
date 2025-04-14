import { FormField } from '@/components/ui/form';
import { getShapeFromSchema } from '@/lib/helpers/auto-form';
import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import { z } from 'zod';

export interface ItemAutoFormComponentProps<
  T extends z.ZodTypeAny,
  TName extends FieldPath<z.infer<T>> = FieldPath<z.infer<T>>,
> {
  field: ControllerRenderProps<FieldValues, TName>;
  shape: z.ZodAny;
}

export interface ItemAutoFormProps<
  T extends z.ZodTypeAny,
  TName extends FieldPath<z.infer<T>> = FieldPath<z.infer<T>>,
> {
  component: (props: ItemAutoFormComponentProps<T, TName>) => React.ReactNode;
  id: TName;
}

export function ItemAutoForm<
  T extends
    | z.ZodEffects<z.ZodObject<z.ZodRawShape>>
    | z.ZodObject<z.ZodRawShape>,
  TName extends FieldPath<z.infer<T>> = FieldPath<z.infer<T>>,
>({
  id,
  component,
  formSchema,
}: ItemAutoFormProps<T, TName> & { formSchema: T }) {
  let shape: null | z.ZodAny = null;
  const ids = id.split('.');
  for (const id of ids) {
    shape = getShapeFromSchema(
      shape ? (shape as unknown as z.ZodObject<z.ZodRawShape>) : formSchema,
      id,
    );
  }
  if (!shape) return null;

  return (
    <FormField
      name={id}
      render={({ field }) => {
        return <>{component({ field, shape })}</>;
      }}
    />
  );
}
