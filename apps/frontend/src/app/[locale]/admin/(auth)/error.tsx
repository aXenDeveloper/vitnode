'use client';

import { WrapperError } from 'vitnode-frontend/views/theme/views/error/wrapper-error';

export default function Error(
  props: React.ComponentProps<typeof WrapperError>,
) {
  return <WrapperError {...props} />;
}
