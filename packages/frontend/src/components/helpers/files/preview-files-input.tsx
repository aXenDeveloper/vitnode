import { FilesInputValue } from '@/components/ui/file-input';

import { ItemPreviewFilesInput } from './item-preview-files-input';

export const PreviewFilesInput = ({
  onChange,
  value,
  showInfo,
  multiple,
}: {
  multiple?: boolean;
  onChange: (e: FilesInputValue[]) => void;
  showInfo?: boolean;
  value: FilesInputValue[];
}) => {
  if (value.length === 0) return null;

  return (
    <ul className="flex flex-col gap-4">
      {[...(Array.isArray(value) ? value : [value])].map((file, index) => (
        <ItemPreviewFilesInput
          file={file}
          index={index}
          key={
            file instanceof File
              ? `${file.name}_${file.lastModified}_${file.size}`
              : `${file.dir_folder}_${file.file_name}`
          }
          multiple={multiple}
          onChange={onChange}
          showInfo={showInfo}
          value={value}
        />
      ))}
    </ul>
  );
};
