import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  getBaseSchema,
  getBaseType,
  getDefaultValueInZodStack,
  getDefaultValues,
  getObjectFormSchema,
  getShapeFromSchema,
} from './auto-form';

describe('auto-form helpers', () => {
  describe('getShapeFromSchema', () => {
    it('should get shape from ZodObject', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const shape = getShapeFromSchema(schema, 'name');
      expect(shape?._def.typeName).toBe('ZodString');
    });

    it('should get shape from ZodEffects', () => {
      const schema = z
        .object({
          name: z.string(),
          age: z.number(),
        })
        .refine(() => true);

      const shape = getShapeFromSchema(schema, 'name');
      expect(shape?._def.typeName).toBe('ZodString');
    });
  });

  describe('getObjectFormSchema', () => {
    it('should return the same schema if already ZodObject', () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = getObjectFormSchema(schema);
      expect(result).toBe(schema);
    });

    it('should unwrap ZodEffects to get ZodObject', () => {
      const innerSchema = z.object({
        name: z.string(),
      });
      const schema = innerSchema.refine(() => true);

      const result = getObjectFormSchema(schema);
      expect(result).toBe(innerSchema);
    });
  });

  describe('getBaseSchema', () => {
    it('should get base schema from simple schema', () => {
      const schema = z.string();
      const result = getBaseSchema(schema);
      expect(result).toBe(schema);
    });

    it('should unwrap optional schema', () => {
      const schema = z.string().optional();
      const result = getBaseSchema(schema);
      expect(result?._def.typeName).toBe('ZodString');
    });

    it('should handle array type when isArray is true', () => {
      const schema = z.array(z.string());
      const result = getBaseSchema(schema, true);
      expect(result?._def.typeName).toBe('ZodString');
    });
  });

  describe('getBaseType', () => {
    it('should return type name of simple schema', () => {
      const schema = z.string();
      expect(getBaseType(schema)).toBe('ZodString');
    });

    it('should return type name from optional schema', () => {
      const schema = z.string().optional();
      expect(getBaseType(schema)).toBe('ZodString');
    });

    it('should return type name from refined schema', () => {
      const schema = z.string().refine(() => true);
      expect(getBaseType(schema)).toBe('ZodString');
    });
  });

  describe('getDefaultValueInZodStack', () => {
    it('should get default value from ZodDefault', () => {
      const schema = z.string().default('test');
      expect(getDefaultValueInZodStack(schema)).toBe('test');
    });

    it('should get default value from nested ZodDefault', () => {
      const schema = z.string().default('test').optional();
      expect(getDefaultValueInZodStack(schema)).toBe('test');
    });

    it('should return undefined when no default value exists', () => {
      const schema = z.string();
      expect(getDefaultValueInZodStack(schema)).toBeUndefined();
    });
  });

  describe('getDefaultValues', () => {
    it('should get default values from flat object schema', () => {
      const schema = z.object({
        name: z.string().default('John'),
        age: z.number().default(25),
      });

      const defaults = getDefaultValues(schema);
      expect(defaults).toEqual({
        name: 'John',
        age: 25,
      });
    });

    it('should get default values from nested object schema', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().default('John'),
          age: z.number().default(25),
        }),
      });

      const defaults = getDefaultValues(schema);
      expect(defaults).toEqual({
        user: {
          name: 'John',
          age: 25,
        },
      });
    });

    it('should handle schema with no defaults', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const defaults = getDefaultValues(schema);
      expect(defaults).toEqual({});
    });

    it('should return empty object for schema without shape', () => {
      const schema = z.string() as unknown as z.ZodObject<z.ZodRawShape>;
      const defaults = getDefaultValues(schema);
      expect(defaults).toEqual({});
    });
  });
});
