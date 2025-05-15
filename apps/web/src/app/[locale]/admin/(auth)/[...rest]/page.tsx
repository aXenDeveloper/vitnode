import type { DynamicAdminViewProps } from 'vitnode/views/admin/dynamic-admin-view';

import { vitNodeConfig } from '@/vitnode.config';
import {
  DynamicAdminView,
  dynamicAdminViewGenerateStaticParams,
  generateMetadataDynamicAdminView,
} from 'vitnode/views/admin/dynamic-admin-view';

export const generateMetadata = generateMetadataDynamicAdminView;
export const generateStaticParams = dynamicAdminViewGenerateStaticParams;

export default function CatchAllPage(props: DynamicAdminViewProps) {
  return <DynamicAdminView config={vitNodeConfig} {...props} />;
}
