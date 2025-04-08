import { cn } from '@/lib/utils';
import Image from 'next/image';

const generateLetterPhoto = (letter: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" style="background:#${color}"><g><text text-anchor="middle" dy=".35em" x="512" y="512" fill="#ffffff" font-size="700" font-family="-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif">${letter.toLocaleUpperCase()}</text></g></svg>`,
  )}`;

export const Avatar = ({
  user: { avatar_color, name },
  className,
  size,
  ...props
}: Omit<
  React.ComponentProps<typeof Image>,
  'alt' | 'height' | 'src' | 'width'
> & {
  size: number;
  user: { avatar_color: string; name: string; name_code: string };
}) => {
  return (
    <Image
      alt={name}
      className={cn('rounded-full object-cover', className)}
      height={size}
      src={generateLetterPhoto(name.slice(0, 1), avatar_color)}
      width={size}
      {...props}
    />
  );
};
