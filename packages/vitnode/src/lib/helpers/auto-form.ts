import type { DefaultValues } from 'react-hook-form';

import { z } from 'zod';

export const getShapeFromSchema = (
  schema: z.ZodEffects<z.ZodObject<z.ZodRawShape>> | z.ZodObject<z.ZodRawShape>,
  id: string,
): null | z.ZodAny => {
  if (schema._def.typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    return schema._def.schema.shape[id] as z.ZodAny;
  }

  return (schema as z.ZodObject<z.ZodRawShape>).shape[id] as z.ZodAny;
};

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
export function getBaseSchema<T extends z.ZodTypeAny>(
  schema: T | z.ZodEffects<T>,
  isArray?: boolean,
): null | T {
  if ('innerType' in schema._def) {
    return getBaseSchema(schema._def.innerType as T, isArray);
  }
  if ('schema' in schema._def) {
    return getBaseSchema(schema._def.schema as T, isArray);
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
export const getBaseType = (schema: z.ZodTypeAny): string => {
  const baseSchema = getBaseSchema(schema);

  return baseSchema ? baseSchema._def.typeName : '';
};

/**
 * Search for a "ZodDefult" in the Zod stack and return its value.
 */
export function getDefaultValueInZodStack(schema: z.ZodTypeAny): unknown {
  if (schema._def.typeName === z.ZodFirstPartyTypeKind.ZodDefault) {
    return (schema as z.ZodDefault<z.ZodTypeAny>)._def.defaultValue();
  }

  if ('innerType' in schema._def) {
    return getDefaultValueInZodStack(schema._def.innerType as z.ZodTypeAny);
  }
  if ('schema' in schema._def) {
    return getDefaultValueInZodStack(
      (schema._def as { schema: z.ZodTypeAny }).schema,
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
      const baseSchema = getBaseSchema(item);
      if (baseSchema && 'shape' in baseSchema._def) {
        const defaultItems = getDefaultValues(
          baseSchema as unknown as z.ZodObject<z.ZodRawShape>,
        );

        if (defaultItems !== null) {
          const obj: Record<string, unknown> = {};

          for (const defaultItemKey of Object.keys(defaultItems)) {
            obj[defaultItemKey] = defaultItems[defaultItemKey];
            (defaultValues as Record<string, unknown>)[key] = obj;
          }
        }
      }
    } else {
      const defaultValue = getDefaultValueInZodStack(item);

      if (defaultValue !== undefined) {
        (defaultValues as Record<string, unknown>)[key] = defaultValue;
      }
    }
  }

  return defaultValues;
}
