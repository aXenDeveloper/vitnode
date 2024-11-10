import { Editor } from '@tiptap/react';
import React from 'react';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

interface Args {
  allowUploadFiles?: {
    folder: string;
    plugin: string;
  };
  editor: Editor;
  onChange: (value: string | StringLanguage[]) => void;
  selectedLanguage: string;
  value: string | StringLanguage[];
}

export const EditorStateContext = React.createContext<Args>({
  editor: {} as Editor,
  value: [],
  onChange: () => {},
  selectedLanguage: '',
});

export const useEditorState = () => React.useContext(EditorStateContext);
