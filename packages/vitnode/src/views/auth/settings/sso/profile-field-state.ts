import type { SsoProfileField } from "@/lib/sso-profile";

import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

import type {
  SsoConnectionProvider,
  SsoImportPreviewField,
  SsoProfileSources,
} from "./sso-connections-query";

export const sourceOptionsFor = (
  field: SsoProfileField,
  providers: SsoConnectionProvider[],
): SsoConnectionProvider[] =>
  providers.filter(
    provider =>
      provider.connection &&
      provider.available &&
      provider.profileFields.includes(field),
  );

export const sourcedFieldsOf = (
  provider: Pick<SsoConnectionProvider, "id" | "profileFields">,
  sources: SsoProfileSources,
): SsoProfileField[] =>
  SSO_PROFILE_FIELDS.filter(
    field =>
      provider.profileFields.includes(field) && sources[field] === provider.id,
  );

export type PreviewFieldState = "missing" | "not_allowed" | "selectable";

export const previewFieldState = (
  field: SsoImportPreviewField,
): PreviewFieldState => {
  if (field.incoming === null) return "missing";
  if (!field.allowed) return "not_allowed";

  return "selectable";
};
