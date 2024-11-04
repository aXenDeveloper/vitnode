import {
  generateMetadataItemLegal,
  ItemLegalView,
} from 'vitnode-frontend/views/theme/views/legal/item/item-legal-view';

export const generateMetadata = generateMetadataItemLegal;

export default function Page(
  props: React.ComponentProps<typeof ItemLegalView>,
) {
  return <ItemLegalView {...props} />;
}
