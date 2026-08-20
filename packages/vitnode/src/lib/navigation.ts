/**
 * The locale-aware half of {@link "@/framework/navigation"}, under the import
 * path it has always had.
 *
 * Kept as a shim rather than deleted: apps, the `create-vitnode-app` template
 * and roughly fifty modules in here import `@vitnode/core/lib/navigation`, and
 * the framework abstraction is not a reason to break any of them. New code
 * should import from `@/framework/navigation`, which also carries `notFound`,
 * `useSearchParams` and the two locale-free primitives.
 */
export {
  getPathname,
  Link,
  redirect,
  usePathname,
  useRouter,
} from "@/framework/navigation";
