import { cn } from "cn";
import React from "react";

const generateLetterPhoto = (letter: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" style="background:#${color}"><g><text text-anchor="middle" dy=".35em" x="512" y="512" fill="#ffffff" font-size="700" font-family="-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif">${letter.toLocaleUpperCase()}</text></g></svg>`,
  )}`;

export interface AvatarUser {
  avatarColor: string;
  avatarUrl?: null | string;
  name: string;
  nameCode: string;
}

/**
 * A plain `<img>` rather than a host's image component, on purpose.
 *
 * The `src` is either the stored avatar or a `data:` URI built in this file, so
 * there is nothing for an optimizer to do - and reaching for one would cost the
 * whole component tree that renders an avatar its portability: the search feed,
 * the user bar and the AdminCP tables would all be pinned to one host the moment
 * any of them shows a face.
 *
 * `loading` and `decoding` are spelled out rather than left to a default, and a
 * data URI is inline anyway - the browser has the bytes before it can defer.
 */
export const Avatar = ({
  user: { avatarColor, avatarUrl, name, nameCode },
  className,
  size,
  ...props
}: Omit<React.ComponentProps<"img">, "alt" | "height" | "src" | "width"> & {
  size: number;
  user: AvatarUser;
}) => {
  const [failedUrl, setFailedUrl] = React.useState<null | string>(null);
  const stored = avatarUrl && failedUrl !== avatarUrl ? avatarUrl : null;

  return (
    <img
      alt={name}
      className={cn("bg-muted rounded-full object-cover", className)}
      decoding="async"
      height={size}
      loading="lazy"
      onError={() => {
        if (stored) setFailedUrl(stored);
      }}
      src={stored ?? generateLetterPhoto(nameCode.slice(0, 1), avatarColor)}
      width={size}
      {...props}
    />
  );
};
