import type { AdminMutationError } from "@/views/admin/views/core/shared/admin-mutation";

/** The toast description of a failed SEO save: the API's own message for a `400`. */
export const seoSaveErrorDescription = (
  error: AdminMutationError,
  tError: (key: "internal_server_error") => string,
): string =>
  error.status === 400 && error.message
    ? error.message
    : tError("internal_server_error");
