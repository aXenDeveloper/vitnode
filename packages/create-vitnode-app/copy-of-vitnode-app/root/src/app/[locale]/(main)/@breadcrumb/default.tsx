// Root fallback for the @breadcrumb slot. Required so unmatched routes (pages
// without an explicit breadcrumb override) don't 404 the slot on hard loads.
// Plugin breadcrumb routes are copied alongside this file by `vitnode`.
export default function Default() {
  return null;
}
