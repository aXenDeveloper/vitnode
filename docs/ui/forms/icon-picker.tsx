'use client';

import React from 'react';
import { IconPicker } from 'vitnode-frontend/components/icon/picker/icon-picker';

export const IconPickerDemo = () => {
  const [value, setValue] = React.useState<string | undefined>('');

  return <IconPicker onChange={setValue} value={value} />;
};
