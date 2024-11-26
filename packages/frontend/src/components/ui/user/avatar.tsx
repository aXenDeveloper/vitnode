import Image from 'next/image';
import { AvatarUser as AvatarUserType } from 'vitnode-shared/user.dto';

import { cn } from '../../../helpers/classnames';
import { CONFIG } from '../../../helpers/config-with-env';

const generateLetterPhoto = (letter: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" style="background:#${color}"><g><text text-anchor="middle" dy=".35em" x="512" y="512" fill="#ffffff" font-size="700" font-family="-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif">${letter.toLocaleUpperCase()}</text></g></svg>`,
  )}`;

export const AvatarUser = ({
  className,
  sizeInRem,
  user: { avatar_color, name, avatar },
}: {
  className?: string;
  sizeInRem: number;
  user: {
    avatar?: Pick<AvatarUserType, 'dir_folder' | 'file_name'>;
    avatar_color: string;
    name: string;
    name_seo: string;
  };
}) => {
  return (
    <Image
      alt={name}
      className={cn('rounded-full object-cover', className)}
      height={sizeInRem * 16}
      priority={!avatar}
      src={
        avatar
          ? `${CONFIG.backend_public_url}/${avatar.dir_folder}/${avatar.file_name}`
          : generateLetterPhoto(name.slice(0, 1), avatar_color)
      }
      width={sizeInRem * 16}
    />
  );
};
