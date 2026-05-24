import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getDefaults, getNestedParam, getZodInputParams } from "./auto-form";

describe("auto-form helpers", () => {
  describe("getDefaults", () => {
    it("should return empty object when no schema provided", () => {
      expect(getDefaults()).toEqual({});
    });

    it("should return empty object when schema has no properties", () => {
      const schema = {};
      expect(getDefaults(schema)).toEqual({});
    });

    it("should extract default values from simple Zod schema", () => {
      const zodSchema = z.object({
        name: z.string().default("John Doe"),
        age: z.number().default(25),
        active: z.boolean().default(true),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getDefaults(jsonSchema);
      expect(result).toEqual({
        name: "John Doe",
        age: 25,
        active: true,
      });
    });

    it("should handle nested Zod objects with defaults", () => {
      const zodSchema = z.object({
        user: z.object({
          name: z.string().default("Jane"),
          settings: z.object({
            theme: z.string().default("dark"),
            notifications: z.boolean().default(false),
          }),
        }),
        title: z.string().default("Hello"),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getDefaults(jsonSchema);
      expect(result).toEqual({
        user: {
          name: "Jane",
          settings: {
            theme: "dark",
            notifications: false,
          },
        },
        title: "Hello",
      });
    });

    it("should skip nested objects with no default values", () => {
      const zodSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
        title: z.string().default("Hello"),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getDefaults(jsonSchema);
      expect(result).toEqual({
        title: "Hello",
      });
    });

    it("should handle mixed properties with and without defaults", () => {
      const zodSchema = z.object({
        name: z.string().default("Test"),
        email: z.string(),
        age: z.number().default(30),
        bio: z.string(),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getDefaults(jsonSchema);
      expect(result).toEqual({
        name: "Test",
        age: 30,
      });
    });
  });

  describe("getZodInputParams", () => {
    it("should return empty object when no schema provided", () => {
      expect(getZodInputParams()).toEqual({});
    });

    it("should return empty object when schema has no properties", () => {
      const schema = {};
      expect(getZodInputParams(schema)).toEqual({});
    });

    it("should extract basic string field parameters from Zod schema", () => {
      const zodSchema = z.object({
        name: z
          .string()
          .min(2)
          .max(50)
          .regex(/^[a-zA-Z]+$/)
          .describe("User name"),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema, ["name"]);
      expect(result).toEqual({
        name: {
          type: "text",
          minLength: 2,
          maxLength: 50,
          pattern: "^[a-zA-Z]+$",
          description: "User name",
          required: true,
        },
      });
    });

    it("should handle email format from Zod schema", () => {
      const zodSchema = z.object({
        email: z.email().describe("Email address"),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema, ["email"]);
      expect(result.email).toHaveProperty("type", "email");
      expect(result.email).toHaveProperty("description", "Email address");
      expect(result.email).toHaveProperty("required", true);
      expect(result.email).toHaveProperty("pattern"); // Email pattern is generated
    });

    it("should infer password type from field name", () => {
      const zodSchema = z.object({
        password: z.string(),
        confirmPassword: z.string(),
        userPassword: z.string(),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema);
      expect(result.password).toHaveProperty("type", "password");
      expect(result.password).toHaveProperty("required", true);
      expect(result.confirmPassword).toHaveProperty("type", "password");
      expect(result.confirmPassword).toHaveProperty("required", true);
      expect(result.userPassword).toHaveProperty("type", "password");
      expect(result.userPassword).toHaveProperty("required", true);
    });

    it("should handle number and boolean types from Zod schema", () => {
      const zodSchema = z.object({
        age: z.number(),
        count: z.number().int(),
        active: z.boolean(),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema);
      expect(result.age).toHaveProperty("type", "number");
      expect(result.age).toHaveProperty("required", true);
      expect(result.count).toHaveProperty("type", "number");
      expect(result.count).toHaveProperty("required", true);
      expect(result.active).toHaveProperty("type", "checkbox");
      expect(result.active).toHaveProperty("required", true);
    });

    it("should handle enum values from Zod schema", () => {
      const zodSchema = z.object({
        role: z.enum(["admin", "user", "guest"]),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema);
      expect(result.role).toHaveProperty("type", "text");
      expect(result.role).toHaveProperty("enum", ["admin", "user", "guest"]);
      expect(result.role).toHaveProperty("required", true);
    });

    it("should handle complex password validation", () => {
      const zodSchema = z.object({
        password: z
          .string()
          .min(8)
          .regex(/(?=.*[a-z])/, "Must contain lowercase")
          .regex(/(?=.*[A-Z])/, "Must contain uppercase")
          .regex(/(?=.*\d)/, "Must contain number"),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema);

      expect(result.password).toHaveProperty("type", "password");
      expect(result.password).toHaveProperty("minLength", 8);
    });

    it("should handle nested objects from Zod schema", () => {
      const zodSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.email(),
        }),
        settings: z.object({
          theme: z.enum(["light", "dark"]),
          notifications: z.boolean(),
        }),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema, ["user"]);
      expect(result.user).toHaveProperty("name");
      expect(result.user).toHaveProperty("email");
      expect(result.settings).toHaveProperty("theme");
      expect(result.settings).toHaveProperty("notifications");
    });

    it("should handle required fields from Zod schema", () => {
      const zodSchema = z.object({
        name: z.string(),
        email: z.string(),
        age: z.number().optional(), // Make this optional to test the difference
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema, ["name", "email"]);
      expect(result.name).toHaveProperty("required", true);
      expect(result.email).toHaveProperty("required", true);
      expect(result.age).not.toHaveProperty("required");
    });

    it("should handle optional fields from Zod schema", () => {
      const zodSchema = z.object({
        name: z.string(),
        email: z.string().optional(),
        age: z.number().optional(),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema, ["name"]);
      expect(result.name).toHaveProperty("required", true);
      expect(result.email).not.toHaveProperty("required");
      expect(result.age).not.toHaveProperty("required");
    });

    it("should handle union types from Zod schema", () => {
      const zodSchema = z.object({
        status: z.union([z.literal("active"), z.literal("inactive")]),
        priority: z.number().or(z.string()),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema);
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("priority");
    });

    it("should handle array types from Zod schema", () => {
      const zodSchema = z.object({
        tags: z.array(z.string()).min(2).max(5),
        guests: z.array(
          z.object({
            name: z.string().min(2),
            email: z.email(),
          }),
        ),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema);

      // Simple array case
      expect(result).toHaveProperty("tags");
      expect(result.tags).toEqual({
        required: true,
        minItems: 2,
        maxItems: 5,
        itemParams: {
          "": { type: "text" },
        },
      });

      // Object array case
      expect(result).toHaveProperty("guests");
      expect(result.guests).toEqual({
        required: true,
        itemParams: {
          name: {
            type: "text",
            required: true,
            minLength: 2,
          },
          email: {
            type: "email",
            required: true,
            pattern:
              "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
          },
        },
      });
    });

    it("should handle nested array types from Zod schema", () => {
      const zodSchema = z.object({
        nestedGuests: z
          .array(z.array(z.string().min(2)))
          .min(1)
          .max(3),
      });

      const jsonSchema = z.toJSONSchema(zodSchema);
      const result = getZodInputParams(jsonSchema);

      expect(result).toHaveProperty("nestedGuests");
      expect(result.nestedGuests).toEqual({
        required: true,
        minItems: 1,
        maxItems: 3,
        itemParams: {
          "": {
            itemParams: {
              "": { type: "text", minLength: 2 },
            },
          },
        },
      });
    });
  });

  describe("getNestedParam", () => {
    const testObj = {
      user: {
        name: { type: "text", required: true },
        email: { type: "email" },
        settings: {
          theme: { type: "text", enum: ["light", "dark"] },
          notifications: { type: "checkbox" },
        },
      },
      title: { type: "text", default: "Hello" },
      guests: {
        itemParams: {
          name: { type: "text", required: true },
        },
      },
    };

    it("should get top-level properties", () => {
      const result = getNestedParam(testObj, "title");
      expect(result).toEqual({ type: "text", default: "Hello" });
    });

    it("should get nested properties", () => {
      const result = getNestedParam(testObj, "user.name");
      expect(result).toEqual({ type: "text", required: true });
    });

    it("should get deeply nested properties", () => {
      const result = getNestedParam(testObj, "user.settings.theme");
      expect(result).toEqual({ type: "text", enum: ["light", "dark"] });
    });
    it("should return undefined for missing array params", () => {
      const result = getNestedParam(testObj, "guests.itemParams.unknown");
      expect(result).toBeUndefined();
    });
    it("should return undefined for non-existent paths", () => {
      expect(getNestedParam(testObj, "nonexistent")).toBeUndefined();
      expect(getNestedParam(testObj, "user.nonexistent")).toBeUndefined();
      expect(
        getNestedParam(testObj, "user.settings.nonexistent"),
      ).toBeUndefined();
    });

    it("should return undefined for invalid paths", () => {
      expect(getNestedParam(testObj, "title.invalid")).toBeUndefined();
      expect(getNestedParam(testObj, "user.name.invalid")).toBeUndefined();
    });

    it("should handle empty path", () => {
      const result = getNestedParam(testObj, "");
      expect(result).toBeUndefined(); // Empty string path returns undefined
    });

    it("should handle paths with array values safely", () => {
      const objWithArray = {
        items: { enum: ["a", "b", "c"] },
      };

      const result = getNestedParam(objWithArray, "items.enum");
      expect(result).toEqual(["a", "b", "c"]); // Arrays are accessible as normal properties
    });
  });
});
