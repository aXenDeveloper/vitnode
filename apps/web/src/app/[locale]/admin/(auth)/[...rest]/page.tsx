import { vitNodeConfig } from '@/vitnode.config';
import {
  DynamicAdminView,
  dynamicAdminViewGenerateStaticParams,
  DynamicAdminViewProps,
  generateMetadataDynamicAdminView,
} from 'vitnode/views/admin/dynamic-admin-view';

export const generateMetadata = generateMetadataDynamicAdminView;
export const generateStaticParams = () =>
  dynamicAdminViewGenerateStaticParams(vitNodeConfig.i18n.locales);

export default function CatchAllPage(props: DynamicAdminViewProps) {
  return <DynamicAdminView config={vitNodeConfig} {...props} />;
}
