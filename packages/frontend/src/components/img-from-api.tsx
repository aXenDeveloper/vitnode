import { CONFIG } from '@/helpers/config-with-env';
import Image from 'next/image';
import { FileObj } from 'vitnode-shared/utils/files.dto';

export const ImgFromApi = ({
  mimetype,
  dir_folder,
  file_name,
  ...props
}: Omit<React.ComponentProps<typeof Image>, 'src'> &
  Pick<FileObj, 'dir_folder' | 'file_name' | 'mimetype'>) => {
  const apiUrl =
    mimetype === 'image/svg+xml'
      ? CONFIG.backend_client_public_url
      : CONFIG.backend_public_url;
  const src = `${apiUrl}/${dir_folder}/${file_name}`;

  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={src} {...props} />;
};
