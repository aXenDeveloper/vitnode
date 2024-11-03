import {
  generateMetadataLangsCoreAdmin,
  LangsCoreAdminView,
} from 'vitnode-frontend/views/admin/views/core/langs/langs-core-admin-view';

export const generateMetadata = generateMetadataLangsCoreAdmin;

export default function Page(
  props: React.ComponentProps<typeof LangsCoreAdminView>,
) {
  return <LangsCoreAdminView {...props} />;
}
