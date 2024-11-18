import { useEditorState } from '../../hooks/use-editor-state';
import { ItemListFilesFooterEditor } from './item/item';

export const ListFilesFooterEditor = () => {
  const { files } = useEditorState();

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
