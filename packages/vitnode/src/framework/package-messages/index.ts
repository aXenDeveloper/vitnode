export { CORE_LOCALE_FILES, CORE_PLUGIN_ID } from "./core.js";
export { generatePackageMessagesSource } from "./generate.js";
export type { PackageMessagesSource } from "./resolve.js";
export {
  localeFilesFromDeclaration,
  PACKAGE_MESSAGES_ERROR_PREFIX,
  resolvePackageMessagesModules,
} from "./resolve.js";
export type { ResolvedPackageMessagesModule } from "./types.js";
