"use client";

import type z from "zod";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { mutationApi } from "./mutation-api.server";
import { PasswordResetFormContent } from "./password-reset-form-content";

/**
 * {@link PasswordResetFormContent}, wired to Next.js.
 *
 * One prop wide, and that prop is the whole of the boundary: a server action
 * that asks the API to send a reset link. Nothing about the screen changes with
 * the framework, so nothing else is passed.
 */
export const PasswordResetForm = ({
  captcha,
}: {
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"];
}) => (
  <PasswordResetFormContent captcha={captcha} onRequestReset={mutationApi} />
);
