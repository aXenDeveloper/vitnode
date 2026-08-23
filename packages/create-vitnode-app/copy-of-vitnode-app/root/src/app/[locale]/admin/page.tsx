import { SignInAdminView } from "@vitnode/core/views/admin/sign-in/sign-in-admin-view";
import React from "react";

export default function Page(
  props: React.ComponentProps<typeof SignInAdminView>,
) {
  return <SignInAdminView {...props} />;
}
