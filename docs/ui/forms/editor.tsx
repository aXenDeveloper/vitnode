'use client';

import React from 'react';
import { Editor } from 'vitnode-frontend/components/editor/editor';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

export const EditorDemo = () => {
  const [value, setValue] = React.useState<StringLanguage[]>([]);

  return <Editor onChange={setValue} value={value} />;
};
