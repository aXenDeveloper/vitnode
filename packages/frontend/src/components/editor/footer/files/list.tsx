import { FileStateEditor } from '../../extensions/files/files';
import { useEditorState } from '../../hooks/use-editor-state';
import { ItemListFilesFooterEditor } from './item/item';

export const ListFilesFooterEditor = () => {
  const { editor } = useEditorState();
  const files: FileStateEditor[] = editor.storage.files.files;

  return (
    <ul className="mt-2 space-y-2">
      {files.map(item => {
        return (
          <ItemListFilesFooterEditor key={`editor_file_${item.id}`} {...item} />
        );
      })}
    </ul>
  );
};
