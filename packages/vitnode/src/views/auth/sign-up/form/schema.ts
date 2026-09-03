import { z } from "zod";

/** The password rules, as messages rather than as copy. */
export interface PasswordFieldMessages {
  /** Shown when the field is missing entirely. */
  fieldRequired: string;
  /** Shown for a password that fails any of the four character rules. */
  invalidPassword: string;
}

export interface SignUpFormMessages extends PasswordFieldMessages {
  /** Shown when the email field is not an email address. */
  invalidEmail: string;
  /** Shown when the username is longer than 32 characters. */
  nameMaxLength: string;
  /** Shown when the username is shorter than 3 characters. */
  nameMinLength: string;
  /** Shown when the terms checkbox is left unticked. */
  termsRequired: string;
}

export const createPasswordZodSchema = ({
  fieldRequired,
  invalidPassword,
}: PasswordFieldMessages) =>
  z
    .string({ message: fieldRequired })
    .regex(/^.{8,}$/, invalidPassword)
    .regex(/[A-Z]/, invalidPassword)
    .regex(/\d/, invalidPassword)
    .regex(/\W|_/, invalidPassword)
    .default("");

export const createSignUpFormSchema = ({
  fieldRequired,
  invalidEmail,
  invalidPassword,
  nameMaxLength,
  nameMinLength,
  termsRequired,
}: SignUpFormMessages) =>
  z.object({
    email: z.email({ message: invalidEmail }),
    name: z
      .string({ message: fieldRequired })
      .min(3, nameMinLength)
      .max(32, nameMaxLength)
      .default(""),
    newsletter: z.boolean().default(false).optional(),
    password: createPasswordZodSchema({ fieldRequired, invalidPassword }),
    // Never sent to the API - it has no `terms` field. The tick is a local
    // precondition, which is why it lives in the form schema and is dropped by
    // the submit callback.
    terms: z
      .boolean()
      .refine(value => value, termsRequired)
      .default(false),
  });

export type SignUpFormSchema = ReturnType<typeof createSignUpFormSchema>;
export type SignUpFormValues = z.infer<SignUpFormSchema>;

export interface SignUpSubmitValues {
  captchaToken: string;
  email: string;
  name: string;
  newsletter?: boolean;
  password: string;
}

export type SignUpMutationResult =
  | undefined
  | { emailConfirmation: string; message?: never }
  | {
      emailConfirmation?: never;
      message: "email_exists" | "Internal Server Error" | "name_exists";
    };

/** Which field a conflict belongs to. */
export type SignUpConflictField = "email" | "name";

export const signUpFormOutcome = (
  result: SignUpMutationResult,
):
  | null
  | { email: string; kind: "confirmation" }
  | { field: SignUpConflictField; kind: "field" }
  | { kind: "toast" } => {
  if (!result) return null;

  if (result.emailConfirmation) {
    return { email: result.emailConfirmation, kind: "confirmation" };
  }

  if (result.message === "email_exists") {
    return { field: "email", kind: "field" };
  }
  if (result.message === "name_exists") return { field: "name", kind: "field" };

  return { kind: "toast" };
};

/** The message inside an API error body, whatever it was wrapped in. */
const unwrapApiMessage = (body: string): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }

  if (typeof parsed === "string") return parsed;
  if (typeof parsed !== "object" || parsed === null) return body;

  const { error, message } = parsed as {
    error?: unknown;
    message?: unknown;
  };

  if (typeof error === "string") return error;
  if (typeof message === "string") return message;

  return body;
};

export const signUpConflictReason = (
  body: string,
): "email_exists" | "name_exists" | "unknown" => {
  const text = unwrapApiMessage(body).trim().toLowerCase();

  if (text === "email already exists") return "email_exists";
  if (text === "name already exists") return "name_exists";

  return "unknown";
};
