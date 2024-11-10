import {
  DynamicAdminView,
  generateMetadataDynamic,
} from 'vitnode-frontend/admin/dynamic-admin-view';

export const generateMetadata = generateMetadataDynamic;

export default function Page(
  props: React.ComponentProps<typeof DynamicAdminView>,
) {
  return <DynamicAdminView {...props} />;
}
