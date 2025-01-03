'use client';

import React from 'react';
import { ColorPicker } from 'vitnode-frontend/components/ui/color-picker';

export const ColorPickerDemo = () => {
  const [value, setValue] = React.useState('');

  return <ColorPicker onChange={setValue} value={value} />;
};
