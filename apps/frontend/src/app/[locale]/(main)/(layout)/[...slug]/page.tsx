import {
  DynamicView,
  generateMetadataDynamic,
} from 'vitnode-frontend/views/theme/views/dynamic-view';

export const generateMetadata = generateMetadataDynamic;

export default function Page(props: React.ComponentProps<typeof DynamicView>) {
  return <DynamicView {...props} />;
}
