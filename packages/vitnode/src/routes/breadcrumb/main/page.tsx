// Home page (/) has no breadcrumb. An explicit slot page (not just default.tsx)
// is required so client-side navigation back to "/" clears a previously-rendered
// breadcrumb - otherwise Next.js keeps the slot's stale active state on soft nav.
export default function BreadcrumbSlot() {
  return null;
}
