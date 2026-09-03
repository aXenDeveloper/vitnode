import { z } from "zod";

import type { PasswordFieldMessages } from "../../sign-up/form/schema";
import type { RecoveryLink } from "../recovery-link";

import { createPasswordZodSchema } from "../../sign-up/form/schema";

export type ChangePasswordFormMessages = PasswordFieldMessages;

export const createChangePasswordFormSchema = (
  messages: ChangePasswordFormMessages,
) =>
  z.object({
    password: createPasswordZodSchema(messages),
  });

export type ChangePasswordFormSchema = ReturnType<
  typeof createChangePasswordFormSchema
>;
export type ChangePasswordFormValues = z.infer<ChangePasswordFormSchema>;

export type ChangePasswordSubmitValues = RecoveryLink & { password: string };

export type ChangePasswordMutationResult =
  undefined | { message: "internal_server_error" | "invalid_token" };

export const changePasswordFormOutcome = (
  result: ChangePasswordMutationResult,
):
  | { kind: "success" }
  | { kind: "toast"; reason: "invalid_token" | "server" } =>
  result?.message
    ? {
        kind: "toast",
        reason: result.message === "invalid_token" ? "invalid_token" : "server",
      }
    : { kind: "success" };
