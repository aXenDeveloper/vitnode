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
