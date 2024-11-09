import {
  EditorAdminView,
  generateMetadataEditorAdmin,
} from 'vitnode-frontend/views/admin/views/core/styles/editor/editor-admin-view';

export const generateMetadata = generateMetadataEditorAdmin;

export default function Page() {
  return <EditorAdminView />;
}
