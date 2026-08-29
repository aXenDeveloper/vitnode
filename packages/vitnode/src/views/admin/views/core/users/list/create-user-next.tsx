"use client";

import type { CreateAdminUser } from "./create-user-content";

import { CreateUserAdminContent } from "./create-user-content";
import { createUserAction } from "./create-user.server";

/**
 * {@link CreateUserAdminContent}, wired to Next.js.
 *
 * One binding: the write is a Server Action, because the refresh it ends with is
 * `revalidatePath`. The dialog, the lazy form and the `409` handling are shared
 * with the TanStack AdminCP.
 */
const onCreate: CreateAdminUser = async input => await createUserAction(input);

export const CreateUserAdmin = () => (
  <CreateUserAdminContent onCreate={onCreate} />
);
