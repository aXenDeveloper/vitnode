// Home page (/) has no breadcrumb. An explicit slot page (not just default.tsx)
// keeps client-side navigation back to "/" from showing a stale breadcrumb.
export default function BreadcrumbSlot() {
  return null;
}
