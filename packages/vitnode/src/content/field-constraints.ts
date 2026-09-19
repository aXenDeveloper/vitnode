import type { ContentFieldDescriptor } from "./types";

import { CONTENT_ENUM_DEFAULT_LENGTH } from "./const";

const DEFAULT_MUST_FIT =
  "A default is what gets written whenever the field is left empty, so it has to satisfy the field's own rules.";

interface LengthConstraints {
  defaultValue: string | undefined;
  maxLength?: number;
  minLength?: number;
}

interface NumberConstraints {
  defaultValue: number | undefined;
  integer: boolean;
  max?: number;
  min?: number;
}

interface EnumConstraints {
  defaultValue: string | undefined;
  length?: number;
  values: readonly string[];
}

const textIssue = (
  name: string,
  { defaultValue, maxLength, minLength }: LengthConstraints,
): null | string => {
  if (maxLength !== undefined) {
    if (!Number.isInteger(maxLength)) {
      return `Field "${name}" has a maxLength of ${maxLength}; it counts characters, so it must be a whole number.`;
    }

    if (maxLength <= 0) {
      return `Field "${name}" has a maxLength of ${maxLength}; it must be positive.`;
    }
  }

  if (
    minLength !== undefined &&
    (!Number.isInteger(minLength) || minLength < 0)
  ) {
    return `Field "${name}" has a minLength of ${minLength}; it counts characters, so it must be a whole number that is zero or more.`;
  }

  if (
    minLength !== undefined &&
    maxLength !== undefined &&
    minLength > maxLength
  ) {
    return `Field "${name}" has minLength ${minLength} greater than maxLength ${maxLength}.`;
  }

  if (typeof defaultValue !== "string") return null;

  if (minLength !== undefined && defaultValue.length < minLength) {
    return `Field "${name}" has a default of ${JSON.stringify(defaultValue)}, which is ${defaultValue.length} characters against a minLength of ${minLength}. ${DEFAULT_MUST_FIT}`;
  }

  if (maxLength !== undefined && defaultValue.length > maxLength) {
    return `Field "${name}" has a default of ${JSON.stringify(defaultValue)}, which is ${defaultValue.length} characters against a maxLength of ${maxLength}. ${DEFAULT_MUST_FIT}`;
  }

  return null;
};

const numberIssue = (
  name: string,
  { defaultValue, integer, max, min }: NumberConstraints,
): null | string => {
  const stated: [string, number | undefined][] = [
    ["min", min],
    ["max", max],
    ["default", defaultValue],
  ];

  for (const [label, value] of stated) {
    if (value !== undefined && !Number.isFinite(value)) {
      return `Field "${name}" has a ${label} of ${value}, which is not a finite number. A number field is compared against its bounds on every write, and nothing compares usefully against NaN or Infinity.`;
    }
  }

  if (min !== undefined && max !== undefined && min > max) {
    return `Field "${name}" has min ${min} greater than max ${max}.`;
  }

  if (defaultValue === undefined) return null;

  if (integer && !Number.isInteger(defaultValue)) {
    return `Field "${name}" is \`integer: true\` and has a default of ${defaultValue}. A whole-number field can only ever hold whole numbers, so the value it writes when it is left empty has to be one too. A fractional \`min\` or \`max\` is fine - the field rounds into range.`;
  }

  if (min !== undefined && defaultValue < min) {
    return `Field "${name}" has a default of ${defaultValue}, which is below its own min of ${min}. ${DEFAULT_MUST_FIT}`;
  }

  if (max !== undefined && defaultValue > max) {
    return `Field "${name}" has a default of ${defaultValue}, which is above its own max of ${max}. ${DEFAULT_MUST_FIT}`;
  }

  return null;
};

const enumIssue = (
  name: string,
  {
    defaultValue,
    length = CONTENT_ENUM_DEFAULT_LENGTH,
    values,
  }: EnumConstraints,
): null | string => {
  if (values.length === 0) return `Field "${name}" needs at least one value.`;

  if (new Set(values).size !== values.length) {
    return `Field "${name}" has duplicate enum values.`;
  }

  const tooLong = values.find(value => value.length > length);
  if (tooLong !== undefined) {
    return `Field "${name}" value "${tooLong}" is longer than the column length ${length}. Raise \`length\` on the field.`;
  }

  if (defaultValue !== undefined && !values.includes(defaultValue)) {
    return `Field "${name}" has default "${defaultValue}", which is not one of its values.`;
  }

  return null;
};

export const scalarFieldConstraintIssue = (
  name: string,
  fieldValue: ContentFieldDescriptor,
): null | string => {
  if (fieldValue.kind === "text" || fieldValue.kind === "textarea") {
    return textIssue(name, fieldValue);
  }

  if (fieldValue.kind === "number") return numberIssue(name, fieldValue);

  if (fieldValue.kind === "enum") return enumIssue(name, fieldValue);

  return null;
};
