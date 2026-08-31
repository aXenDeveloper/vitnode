import { cn } from "@/lib/utils";

const generateLetterPhoto = (letter: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" style="background:#${color}"><g><text text-anchor="middle" dy=".35em" x="512" y="512" fill="#ffffff" font-size="700" font-family="-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif">${letter.toLocaleUpperCase()}</text></g></svg>`,
  )}`;

/**
 * A plain `<img>` rather than `next/image`, on purpose.
 *
 * The `src` is always a `data:` URI built in this file, and Next refuses to
 * optimize those - it marks them unoptimized and emits the same tag this does.
 * So the import bought nothing, and it cost the whole component tree that
 * renders an avatar its portability: the search feed, the user bar and the
 * AdminCP tables all become Next-only the moment one of them shows a face.
 *
 * `loading` and `decoding` are spelled out because `next/image` set them, and a
 * data URI is inline anyway - the browser has the bytes before it can defer.
 */
export const Avatar = ({
  user: { avatarColor, name },
  className,
  size,
  ...props
}: Omit<React.ComponentProps<"img">, "alt" | "height" | "src" | "width"> & {
  size: number;
  user: { avatarColor: string; name: string; nameCode: string };
}) => {
  return (
    <img
      alt={name}
      className={cn("rounded-full object-cover", className)}
      decoding="async"
      height={size}
      loading="lazy"
      src={generateLetterPhoto(name.slice(0, 1), avatarColor)}
      width={size}
      {...props}
    />
  );
};
