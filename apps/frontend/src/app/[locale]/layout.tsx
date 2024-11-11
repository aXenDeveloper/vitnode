import { Geist } from 'next/font/google';
import {
  generateMetadataRootLayout,
  RootLayout,
} from 'vitnode-frontend/views/layout/root-layout';

export const generateMetadata = generateMetadataRootLayout;

const geistSans = Geist();

export default function Layout(
  props: Omit<React.ComponentProps<typeof RootLayout>, 'className'>,
) {
  return <RootLayout className={geistSans.className} {...props} />;
}
