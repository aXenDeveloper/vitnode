import type { DefaultValues } from "react-hook-form";
import type { z } from "zod";

type NestedParamValue = InputParams[string] | undefined;

export function getDefaults<T extends z.ZodType>(
  jsonSchema?: z.core.JSONSchema.JSONSchema,
): DefaultValues<z.input<T>> {
  if (!jsonSchema?.properties) {
    return {} as DefaultValues<z.input<T>>;
  }

  const defaultValues: Record<string, unknown> = {};

  // Iterate over each property in the schema
  for (const key in jsonSchema.properties) {
    const prop = jsonSchema.properties[key] as z.core.JSONSchema.JSONSchema;

    // Case 1: The property has a 'default' key.
    if (prop.default !== undefined) {
      defaultValues[key] = prop.default;
      continue; // Move to the next property
    }

    // Case 2: The property is a nested object. Recurse into it.
    if (prop.type === "object" && prop.properties) {
      const nestedDefaults = getDefaults(prop);

      // Only add the nested object if it contains default values.
      if (Object.keys(nestedDefaults).length > 0) {
        defaultValues[key] = nestedDefaults;
      }
    }
  }

  return defaultValues as DefaultValues<z.input<T>>;
}

export interface InputParams {
  [key: string]:
    | InputParams
    | {
        description?: string;
        enum?: string[];

        maxLength?: number;
        minLength?: number;

        pattern?: string;
        patterns?: string[];
        required?: boolean;
        type?: string;
      };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <it's complex and needs to be>
export function getZodInputParams(
  jsonSchema?: z.core.JSONSchema.JSONSchema,
  parentRequired: string[] = [],
): InputParams {
  // Base case: If there's no schema or properties, return an empty object.
  if (!jsonSchema?.properties) {
    return {};
  }

  const extractedParams: InputParams = {};
  const requiredFields = new Set(jsonSchema.required ?? parentRequired);

  // Iterate over each property in the current schema level.
  for (const key in jsonSchema.properties) {
    const prop = jsonSchema.properties[key] as z.core.JSONSchema.JSONSchema;
    const fieldParams: Record<string, unknown> = {};

    // 1. Handle 'required' status
    if (requiredFields.has(key)) {
      fieldParams.required = true;
    }

    // 2. Handle standard string constraints
    if (prop.minLength !== undefined) {
      fieldParams.minLength = prop.minLength;
    }
    if (prop.maxLength !== undefined) {
      fieldParams.maxLength = prop.maxLength;
    }
    if (prop.pattern !== undefined) {
      fieldParams.pattern = prop.pattern;
    }
    if (prop.enum) {
      fieldParams.enum = prop.enum;
    }

    // 3. Handle complex patterns from `allOf` (used for password)
    if (prop.allOf) {
      fieldParams.patterns = prop.allOf.map(p => p.pattern).filter(Boolean); // Filter out any undefined patterns
    }

    if (prop.description) {
      fieldParams.description = prop.description;
    }

    // 4. Determine the input type based on schema type and format
    switch (prop.type) {
      case "boolean":
        fieldParams.type = "checkbox";
        break;
      case "integer":
      case "number":
        fieldParams.type = "number";
        break;
      case "string":
        // Check format for special string types
        if (prop.format === "email") {
          fieldParams.type = "email";
        } else if (key.toLowerCase().includes("password")) {
          // Infer password type by key name for better UX
          fieldParams.type = "password";
        } else {
          fieldParams.type = "text";
        }
        break;
    }

    // 5. Handle nested objects by making a recursive call
    if (prop.type === "object") {
      // Pass the 'required' array from the nested object itself.
      extractedParams[key] = getZodInputParams(prop, prop.required);
    } else {
      extractedParams[key] = fieldParams;
    }
  }

  return extractedParams;
}

export function getNestedParam(
  obj: InputParams,
  path: string,
): NestedParamValue {
  return path
    .split(".")
    .reduce<NestedParamValue>(
      (acc: NestedParamValue, key: string): NestedParamValue => {
        if (
          acc &&
          typeof acc === "object" &&
          !Array.isArray(acc) &&
          key in acc
        ) {
          return (acc as InputParams)[key];
        }

        return undefined;
      },
      obj,
    );
}
