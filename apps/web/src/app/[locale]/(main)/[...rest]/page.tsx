import type { DynamicViewProps } from 'vitnode/views/dynamic-view';

import { vitNodeConfig } from '@/vitnode.config';
import {
  DynamicView,
  dynamicViewGenerateStaticParams,
  generateMetadataDynamicView,
} from 'vitnode/views/dynamic-view';

export const generateMetadata = generateMetadataDynamicView;
export const generateStaticParams = dynamicViewGenerateStaticParams;

export default function RestPage(props: DynamicViewProps) {
  return <DynamicView config={vitNodeConfig} {...props} />;
}
