import Image, { StaticImageData } from 'next/image';

import { cn } from '../helpers/classnames';

interface InitialProps {
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  src: StaticImageData | string;
}

interface PropsWithWidthAndHeight extends InitialProps {
  fill?: never;
  height: number;
  heightLoading?: number;
  width: number;
}

interface PropsWithFill extends InitialProps {
  fill: true;
  height?: never;
  heightLoading?: never;
  width?: never;
}

export type ImgProps = PropsWithFill | PropsWithWidthAndHeight;

export const Img = ({
  alt,
  className,
  fill,
  height,
  heightLoading,
  imageClassName,
  priority,
  quality,
  sizes,
  src,
  width,
}: ImgProps) => {
  return (
    <div
      className={cn('relative w-fit overflow-hidden leading-[0]', className)}
      style={{
        height: !height
          ? heightLoading
            ? `${heightLoading}px`
            : '100%'
          : undefined,
      }}
    >
      <Image
        alt={alt}
        className={imageClassName}
        fill={fill}
        height={height}
        priority={priority}
        quality={quality}
        sizes={sizes}
        src={src}
        style={{
          height: height !== undefined ? `${height}px` : undefined,
        }}
        width={width}
      />
    </div>
  );
};
