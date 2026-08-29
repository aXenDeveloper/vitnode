/**
 * The shell's breadcrumb, for a TanStack Router application.
 *
 * Two halves that are deliberately separate: a rule over matched routes
 * (`breadcrumbOf`, testable with no router at all) and the component that
 * applies it (`MainBreadcrumb`). Importing this barrel is also what loads the
 * `staticData.breadcrumb` augmentation - see `./model`.
 */

export { MainBreadcrumb } from "./main-breadcrumb";
export type { BreadcrumbMatch } from "./model";
export { breadcrumbOf } from "./model";
