import { DefaultValues } from 'react-hook-form';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodObjectOrWrapped = z.Schema<any, any>;

export function getObjectFormSchema(
  schema: ZodObjectOrWrapped,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): z.ZodObject<any, any> {
  if (schema._def.typeName === 'ZodEffects') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedSchema = schema as z.ZodEffects<z.ZodObject<any, any>>;

    return getObjectFormSchema(typedSchema._def.schema);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return schema as z.ZodObject<any, any>;
}

/**
 * Get the lowest level Zod type.
 * This will unpack optionals, refinements, etc.
 */
export function getBaseSchema<T extends z.AnyZodObject | z.ZodAny = z.ZodAny>(
  schema: T | z.ZodEffects<T>,
  isArray?: boolean,
): null | T {
  if ('innerType' in schema._def) {
    return getBaseSchema(schema._def.innerType as T, isArray);
  }
  if ('schema' in schema._def) {
    return getBaseSchema(schema._def.schema, isArray);
  }

  if ('type' in schema._def && isArray) {
    return getBaseSchema(schema._def.type as T, isArray);
  }

  return schema as T;
}

/**
 * Get the type name of the lowest level Zod type.
 * This will unpack optionals, refinements, etc.
 */
export const getBaseType = (schema: z.ZodAny): string => {
  const baseSchema = getBaseSchema(schema);

  return baseSchema ? baseSchema._def.typeName : '';
};

/**
 * Search for a "ZodDefult" in the Zod stack and return its value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDefaultValueInZodStack(schema: z.ZodAny): any {
  const typedSchema = schema as unknown as z.ZodDefault<
    z.ZodNumber | z.ZodString
  >;

  if (typedSchema._def.typeName === z.ZodFirstPartyTypeKind.ZodDefault) {
    return typedSchema._def.defaultValue();
  }

  if ('innerType' in typedSchema._def) {
    return getDefaultValueInZodStack(
      typedSchema._def.innerType as unknown as z.ZodAny,
    );
  }
  if ('schema' in typedSchema._def) {
    return getDefaultValueInZodStack(
      (
        typedSchema._def as {
          schema: z.ZodAny;
        }
      ).schema,
    );
  }

  return undefined;
}

/**
 * Get all default values from a Zod schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDefaultValues<Schema extends z.ZodObject<any, any>>(
  schema: Schema,
): DefaultValues<Partial<z.TypeOf<Schema>>> {
  const { shape } = schema;
  type DefaultValuesType = DefaultValues<Partial<z.infer<Schema>>>;
  const defaultValues = {} as DefaultValuesType;
  if (!shape) return defaultValues;

  for (const key of Object.keys(shape as object)) {
    const item = shape[key] as z.ZodAny;

    if (getBaseType(item) === 'ZodObject') {
      const defaultItems = getDefaultValues(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getBaseSchema(item) as unknown as z.ZodObject<any, any>,
      );

      if (defaultItems !== null) {
        const obj: Record<string, unknown> = {};

        for (const defaultItemKey of Object.keys(defaultItems)) {
          obj[defaultItemKey] = defaultItems[defaultItemKey];
          defaultValues[key as keyof DefaultValuesType] = obj as DefaultValues<
            Partial<z.TypeOf<Schema>>
          >[keyof DefaultValues<Partial<z.TypeOf<Schema>>>];
        }
      }
    } else {
      const defaultValue = getDefaultValueInZodStack(item);

      if (defaultValue !== undefined) {
        defaultValues[key as keyof DefaultValuesType] = defaultValue;
      }
    }
  }

  return defaultValues;
}
