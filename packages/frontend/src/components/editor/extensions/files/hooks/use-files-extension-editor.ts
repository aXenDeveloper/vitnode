import {
  acceptMimeTypeImage,
  acceptMimeTypeVideo,
} from '@/helpers/files-support';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useSession } from '@/hooks/use-session';
import { useSessionAdmin } from '@/hooks/use-session-admin';
import { FilesPermissionsCoreSessions } from 'vitnode-shared/user.dto';
import { AllowTypeFilesEnum } from 'vitnode-shared/utils/global';

import { FilesHandlerStorage } from '../files';

export const useFilesExtensionEditor = () => {
  const session = useSession();
  const adminSession = useSessionAdmin();
  const middleware = useMiddlewareData();
  const permissionFiles: FilesPermissionsCoreSessions = {
    allow_upload:
      session.user?.files_permissions.allow_upload ??
      adminSession.user?.files_permissions.allow_upload ??
      false,
    max_storage_for_submit:
      session.user?.files_permissions.max_storage_for_submit ??
      adminSession.user?.files_permissions.max_storage_for_submit ??
      0,
    space_used:
      session.user?.files_permissions.space_used ??
      adminSession.user?.files_permissions.space_used ??
      0,
    total_max_storage:
      session.user?.files_permissions.total_max_storage ??
      adminSession.user?.files_permissions.total_max_storage ??
      0,
  };

  const validateMimeTypeFile = (file: File) => {
    const { allow_type } = middleware.editor.files;
    if (allow_type === AllowTypeFilesEnum.all) return file;

    const isValidType = (types: string[]) =>
      types.some(type => file.type.includes(type));

    if (allow_type === AllowTypeFilesEnum.images_videos) {
      if (!isValidType([...acceptMimeTypeImage, ...acceptMimeTypeVideo])) {
        throw new Error(
          `INVALID_FILE_TYPE.${[...acceptMimeTypeImage, ...acceptMimeTypeVideo].join(',')}`,
        );
      }
    } else if (allow_type === AllowTypeFilesEnum.images) {
      if (!isValidType(acceptMimeTypeImage)) {
        throw new Error(`INVALID_FILE_TYPE.${acceptMimeTypeImage.join(',')}`);
      }
    }

    return file;
  };

  const validateSizeFile = ({
    file,
    files,
  }: {
    file: File;
    files: FilesHandlerStorage[];
  }) => {
    if (
      permissionFiles.max_storage_for_submit === 0 &&
      permissionFiles.total_max_storage === 0
    ) {
      return;
    }

    const remainingStorage =
      permissionFiles.total_max_storage !== 0
        ? permissionFiles.total_max_storage - permissionFiles.space_used
        : 0;

    const maxStorage = (() => {
      if (remainingStorage) {
        return permissionFiles.max_storage_for_submit
          ? Math.min(permissionFiles.max_storage_for_submit, remainingStorage)
          : remainingStorage;
      }

      return permissionFiles.max_storage_for_submit || -1;
    })();
    const totalSize = files.reduce((acc, file) => {
      if (!(file instanceof File) && file.data) {
        return acc + file.data.file_size;
      }
      if (!(file instanceof File) && file.file) {
        return acc + file.file.size;
      }

      return acc;
    }, 0);

    if (totalSize > maxStorage && maxStorage !== -1) {
      throw new Error(`MAX_STORAGE_EXTENDED.${maxStorage}`);
    }

    return file;
  };

  return { validateMimeTypeFile, validateSizeFile };
};
