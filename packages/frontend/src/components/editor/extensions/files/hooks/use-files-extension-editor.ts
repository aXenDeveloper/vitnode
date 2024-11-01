import { fetcherClient } from '@/api/fetcher-client';
import { formatBytes } from '@/helpers/format-bytes';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useSession } from '@/hooks/use-session';
import { useSessionAdmin } from '@/hooks/use-session-admin';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShowFile, UploadFilesBody } from 'vitnode-shared/files.dto';
import { FilesPermissionsCoreSessions } from 'vitnode-shared/user.dto';
import { AllowTypeFilesEnum } from 'vitnode-shared/utils/global';

import {
  acceptMimeTypeImage,
  acceptMimeTypeVideo,
  FileStateEditor,
} from '../files';
import { deleteMutationApi } from './delete-mutation-api';

export const useFilesExtensionEditor = ({
  allowUploadFiles,
}: {
  allowUploadFiles?: {
    folder: string;
    plugin: string;
  };
}) => {
  const t = useTranslations('core.global.editor.files.errors');
  const tCore = useTranslations('core.global.errors');
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

  const handleDelete = async ({
    id,
    securityKey,
  }: {
    id: number;
    securityKey: string | undefined;
  }) => {
    try {
      await deleteMutationApi({
        file_id: id,
        security_key: securityKey,
      });
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  const validateMimeTypeFile = (file: FileStateEditor): FileStateEditor => {
    if (file.error)
      return {
        ...file,
        error: tCore('internal_server_error'),
        isLoading: false,
      };

    const { allow_type } = middleware.editor.files;
    if (allow_type === AllowTypeFilesEnum.all) return file;

    const isValidType = (types: string[]) =>
      types.includes(file.file?.type ?? '');

    if (allow_type === AllowTypeFilesEnum.images_videos) {
      if (!isValidType([...acceptMimeTypeImage, ...acceptMimeTypeVideo])) {
        return {
          ...file,
          error: t('invalid_file_type', {
            types: [...acceptMimeTypeImage, ...acceptMimeTypeVideo].join(', '),
          }),
          isLoading: false,
        };
      }
    } else if (allow_type === AllowTypeFilesEnum.images) {
      if (!isValidType(acceptMimeTypeImage)) {
        return {
          ...file,
          error: t('invalid_file_type', {
            types: acceptMimeTypeImage.join(', '),
          }),
          isLoading: false,
        };
      }
    }

    return file;
  };

  const validateSizeFile = ({
    file,
    fileState,
  }: {
    file: FileStateEditor;
    fileState: FileStateEditor[];
  }): FileStateEditor => {
    if (file.error)
      return {
        ...file,
        error: tCore('internal_server_error'),
        isLoading: false,
      };

    if (
      permissionFiles.max_storage_for_submit === 0 &&
      permissionFiles.total_max_storage === 0
    ) {
      return file;
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
    const totalSize = [file, ...fileState.filter(i => i.id !== file.id)].reduce(
      (acc, file) => {
        if (file.data) return acc + file.data.file_size;
        if (file.file) return acc + file.file.size;

        return acc;
      },
      0,
    );

    if (totalSize > maxStorage && maxStorage !== -1) {
      return {
        ...file,
        error: t('max_storage_extended', {
          size: formatBytes(maxStorage),
        }),
        isLoading: false,
      };
    }

    return file;
  };

  const checkUploadFile = ({
    file,
    fileState,
  }: {
    file: FileStateEditor;
    fileState: FileStateEditor[];
  }) => {
    if (
      !allowUploadFiles ||
      middleware.editor.files.allow_type === AllowTypeFilesEnum.none ||
      !permissionFiles.allow_upload
    ) {
      return;
    }

    const fileAfterCheckMineType = validateMimeTypeFile(file);
    if (fileAfterCheckMineType.error) return fileAfterCheckMineType;
    const fileAfterCheckSize = validateSizeFile({
      file: fileAfterCheckMineType,
      fileState,
    });
    if (fileAfterCheckSize.error) return fileAfterCheckSize;

    return file;
  };

  const uploadFile = async (
    file: FileStateEditor,
  ): Promise<FileStateEditor> => {
    const formData = new FormData();
    if (!file.file || !allowUploadFiles) {
      return {
        ...file,
        error: tCore('internal_server_error'),
        isLoading: false,
      };
    }
    formData.append('file', file.file);
    // TODO: Change this to plugin_code when testing is done
    // ! This is a temporary issue to test the upload of files
    formData.append('plugin', allowUploadFiles.plugin);
    formData.append('folder', allowUploadFiles.folder);

    try {
      const { data } = await fetcherClient<ShowFile, UploadFilesBody>({
        url: '/core/files',
        method: 'POST',
        body: formData,
      });

      return {
        data,
        id: data.id,
        isLoading: false,
        error: '',
      };
    } catch (_) {
      return {
        id: file.id,
        error: tCore('internal_server_error'),
        isLoading: false,
      };
    }
  };

  return { handleDelete, checkUploadFile, uploadFile };
};
