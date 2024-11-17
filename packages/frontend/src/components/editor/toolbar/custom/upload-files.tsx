import { Paperclip } from 'lucide-react';
import React from 'react';

import { useEditorState } from '../../hooks/use-editor-state';
import { ButtonToolbarEditor } from '../button';

export const UploadFilesToolbarEditor = () => {
  const { onUploadFile } = useEditorState();
  const ref = React.useRef<HTMLInputElement>(null);

  return (
    <ButtonToolbarEditor
      name="upload_files"
      onClick={() => {
        ref.current?.click();
      }}
    >
      <Paperclip />
      <input
        className="hidden"
        multiple
        onChange={e => {
          const files = [...(e.target.files ?? [])];

          files.forEach(file => {
            onUploadFile(file);
          });
        }}
        ref={ref}
        type="file"
        value=""
      />
    </ButtonToolbarEditor>
  );
};
