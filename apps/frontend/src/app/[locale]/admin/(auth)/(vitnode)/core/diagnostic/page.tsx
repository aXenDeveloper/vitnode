import {
  DiagnosticToolsView,
  generateMetadataDiagnosticAdmin,
} from 'vitnode-frontend/views/admin/views/core/diagnostic/diagnostic-tools-view';

export const generateMetadata = generateMetadataDiagnosticAdmin;

export default function Page() {
  return <DiagnosticToolsView />;
}
