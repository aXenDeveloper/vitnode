import { FileInput } from '@/components/ui/file-input';

import { ItemPreviewFilesInput } from './item-preview-files-input';

export const PreviewFilesInput = ({
  onChange,
  value,
  showInfo,
  multiple,
}: {
  showInfo?: boolean;
} & Pick<
  React.ComponentProps<typeof FileInput>,
  'multiple' | 'onChange' | 'value'
>) => {
  if ((multiple && Array.isArray(value) && !value.length) || !value) {
    return null;
  }
  const files = (Array.isArray(value) ? value : [value]).filter(Boolean);

  return (
    <ul className="mt-2 flex flex-col gap-4">
      {files.map((file, index) => {
        if (!file) return null;

        return (
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
        );
      })}
    </ul>
  );
};
