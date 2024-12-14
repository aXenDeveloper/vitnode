import { Editor } from '@tiptap/react';
import React from 'react';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { FilesHandlerStorage } from '../extensions/files/files';

interface Args {
  allowUploadFiles: boolean;
  editor: Editor;
  files: FilesHandlerStorage[];
  onChange: (value: string | StringLanguage[]) => void;
  onRemoveFile: (args: { id: number }) => void;
  onUploadFile: (file: File) => void;
  selectedLanguage: string;
  value: string | StringLanguage[];
}

export const EditorStateContext = React.createContext<Args>({
  editor: {} as Editor,
  value: [],
  onChange: () => {},
  selectedLanguage: '',
  files: [],
  allowUploadFiles: false,
  onUploadFile: () => {},
  onRemoveFile: () => {},
});

export const useEditorState = () => React.useContext(EditorStateContext);
