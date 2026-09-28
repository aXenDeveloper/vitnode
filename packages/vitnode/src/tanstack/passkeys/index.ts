export { PasskeysPanelContent, PasskeysPanelPending } from "./panel";

export * from "./query";

export type {
  AddPasskey,
  AddPasskeyResult,
  DeletePasskey,
  DeletePasskeyResult,
  RenamePasskey,
  RenamePasskeyResult,
} from "@/views/auth/settings/passkeys/passkeys-mutations";
export {
  isPasskeysRequestError,
  passkeysQueryKey,
  passkeysQueryOptions,
  PasskeysRequestError,
} from "@/views/auth/settings/passkeys/passkeys-query";
export type {
  Passkey,
  PasskeysApi,
} from "@/views/auth/settings/passkeys/passkeys-query";
