import {
  generateMetadataLegal,
  LegalView,
} from 'vitnode-frontend/views/theme/views/legal/legal-view';

export const generateMetadata = generateMetadataLegal;

export default function Page() {
  return <LegalView />;
}
