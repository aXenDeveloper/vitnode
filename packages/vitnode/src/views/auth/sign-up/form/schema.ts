import { z } from "zod";

/**
 * The registration form's shape and its failure vocabulary, with no React in
 * sight.
 *
 * The same split `sign-in/form/schema.ts` makes, for the same reason: the schema
 * is a function of already-translated strings, and the outcome mapping is a
 * function of whatever the submit callback returned. Neither needs a renderer, a
 * provider or a request to be checked - which matters more here than on the
 * login form, because registration has four outcomes rather than two and one of
 * them replaces the whole page.
 */

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

/**
 * The password field, shared by registration and password recovery.
 *
 * Four separate `.regex()` calls carrying the *same* message, which is
 * deliberate: `PasswordInput` renders a live checklist of the four rules from
 * its own copies of these expressions, so the message a failing password
 * produces is always "too weak" and the checklist is what says which rule.
 * Collapsing them into one expression would change nothing on screen and lose
 * the ability to say which rule a value breaks.
 *
 * The API is stricter than this only in that it accepts *less*: `zodSignUpSchema`
 * asks for eight characters and nothing else, so every value this schema admits
 * is one the API admits too.
 */
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

/**
 * What registration sends, once the form has dropped the parts the API has no
 * field for.
 *
 * `terms` is absent on purpose - the tick is a local precondition, not something
 * the API stores - and `captchaToken` is present because the sign-up route is
 * `withCaptcha: true`, so a caller that could not attach one has nothing to
 * send. Both are the reason this is its own type rather than
 * {@link SignUpFormValues}.
 */
export interface SignUpSubmitValues {
  captchaToken: string;
  email: string;
  name: string;
  newsletter?: boolean;
  password: string;
}

/**
 * What the API told us about a registration attempt, as the UI cares about it.
 *
 * Four outcomes, because registration genuinely has four:
 *
 * - `undefined` - it worked *and* the caller has already navigated. The account
 *   was created with `emailVerified: true`, the API minted a session on the same
 *   response, and there is nothing left for the form to render.
 * - `{ emailConfirmation }` - it worked and the visitor is *not* signed in: this
 *   deployment has an email adapter, so the account waits on a confirmation
 *   link. The address travels back because the confirmation screen prints it.
 * - `{ message: 'email_exists' | 'name_exists' }` - a conflict the visitor can
 *   fix, and the two are distinguished because they mark different fields.
 * - `{ message: 'Internal Server Error' }` - anything else, rendered as the
 *   internal-error toast.
 *
 * Spelled as literals the transport can produce rather than as the API's own
 * body, so no backend string reaches a screen: the API answers a 409 with
 * `"Email already exists"`, and classifying that text is the transport's job.
 */
export type SignUpMutationResult =
  | undefined
  | { emailConfirmation: string; message?: never }
  | {
      emailConfirmation?: never;
      message: "email_exists" | "Internal Server Error" | "name_exists";
    };

/** Which field a conflict belongs to. */
export type SignUpConflictField = "email" | "name";

/**
 * What a submit result means for the screen.
 *
 * - `"confirmation"` - swap the card for the "check your email" view.
 * - `"field"` - mark one field and focus it; the hook supplies the message,
 *   because it is the half that has translations.
 * - `"toast"` - the internal-error toast.
 * - `null` - nothing to show: it worked and the caller navigated.
 *
 * A success is deliberately indistinguishable from "returned nothing", exactly
 * as on the login form: both the Next.js server action and a TanStack Start
 * mutation leave the page on the happy path, so the resolved value is
 * `undefined` in both.
 */
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

/**
 * Which unique constraint a `409` hit, or `"unknown"`.
 *
 * The API answers a conflict with a bare `HTTPException`, whose body is the
 * message and nothing else - `"Email already exists"` or `"Name already
 * exists"` (`api/models/user/sign-up.ts`). Two things follow, and this function
 * is where both are handled:
 *
 * 1. **The distinction is worth keeping.** They mark different fields, and the
 *    visitor's next move differs - pick another address, or pick another name.
 * 2. **The string itself must not travel.** It is an internal message in a fixed
 *    language, so it is classified here and never forwarded; a body that matches
 *    neither becomes `"unknown"` and the caller renders its generic failure
 *    rather than printing something a backend wrote.
 *
 * Lives with the schema, framework-free, because both transports have to make
 * the identical judgement: the Next.js server action reads `res.text()`, and the
 * TanStack Start server function reads the same body off the same route. One
 * classifier rather than two that can drift.
 *
 * Tolerant about *packaging* and strict about content: a body may arrive as
 * plain text, as a JSON string, or as `{ "error": ... }` / `{ "message": ... }`
 * (which is how VitNode's other conflict routes answer), and only the two known
 * sentences are recognised once unwrapped.
 */
export const signUpConflictReason = (
  body: string,
): "email_exists" | "name_exists" | "unknown" => {
  const text = unwrapApiMessage(body).trim().toLowerCase();

  if (text === "email already exists") return "email_exists";
  if (text === "name already exists") return "name_exists";

  return "unknown";
};
