"use client";

import { UserPlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  AdminUserCreated,
  AdminUserCreateInput,
} from "@/views/admin/views/core/users/users-mutations";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";

/**
 * Creating a user from the AdminCP, with no framework in it.
 *
 * The dialog stays a shell and the form is loaded on demand - the Next.js
 * version does the same with `next/dynamic`, and for the same reason: the form
 * drags `AutoForm`, `react-hook-form` and zod behind it, and none of that is
 * worth downloading to look at a list of users. `React.lazy` is the
 * framework-neutral spelling.
 *
 * The write arrives as a prop so a Next.js page can hand it a Server Action
 * while a TanStack route hands it a browser call plus a query invalidation.
 */

export type CreateAdminUser = (
  input: AdminUserCreateInput,
) => Promise<AdminMutationResult<AdminUserCreated>>;

const CreateUserForm = React.lazy(async () =>
  import("./create-user-form").then(module => ({
    default: module.CreateUserForm,
  })),
);

export const CreateUserAdminContent = ({
  onCreate,
}: {
  onCreate: CreateAdminUser;
}) => {
  const t = useTranslations("admin.user.create");

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon />
        {t("title")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlusIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateUserForm onCreate={onCreate} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

export type { AdminUserCreated, AdminUserCreateInput };
