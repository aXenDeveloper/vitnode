import { vitNodeConfig } from '@/vitnode.config';
import {
  DynamicView,
  dynamicViewGenerateStaticParams,
  DynamicViewProps,
  generateMetadataDynamicView,
} from 'vitnode/views/dynamic-view';

export const generateMetadata = generateMetadataDynamicView;
export const generateStaticParams = () =>
  dynamicViewGenerateStaticParams([...vitNodeConfig.i18n.locales]);

export default function RestPage(props: DynamicViewProps) {
  return <DynamicView config={vitNodeConfig} {...props} />;
}
