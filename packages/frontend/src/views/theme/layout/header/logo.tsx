import { getMiddlewareData } from '@/api/get-middleware-data';
import { ImgFromApi } from '@/components/img';
import { cn } from '@/helpers/classnames';
import { Link } from '@/navigation';

export const LogoHeader = async ({ className }: { className?: string }) => {
  const { logos, site_short_name } = await getMiddlewareData();

  return (
    <Link
      aria-label={site_short_name}
      className="max-w-[75vw] truncate"
      href="/"
      id="vitnode_logo"
      style={
        {
          '--logo-width': `${logos.width}rem`,
          '--logo-mobile-width': `${logos.mobile_width}rem`,
        } as React.CSSProperties
      }
    >
      {!logos.logo_dark &&
      !logos.mobile_logo_dark &&
      !logos.logo_light &&
      !logos.mobile_logo_light ? (
        <span
          className={cn(
            'text-foreground inline-block whitespace-nowrap text-xl font-bold',
            className,
          )}
          id="vitnode_logo_text"
        >
          {logos.text}
        </span>
      ) : null}

      {logos.logo_light?.height && logos.logo_light.width && (
        <ImgFromApi
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'dark:hidden': logos.logo_dark,
              'hidden sm:block':
                logos.mobile_logo_light ?? logos.mobile_logo_dark,
            },
          )}
          dir_folder={logos.logo_light.dir_folder}
          file_name={logos.logo_light.file_name}
          height={logos.logo_light.height}
          id="vitnode_logo_light"
          mimetype={logos.logo_light.mimetype}
          sizes="100vw"
          width={logos.logo_light.width}
        />
      )}
      {logos.logo_dark?.height && logos.logo_dark.width && (
        <ImgFromApi
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'hidden dark:block': logos.logo_light,
              'hidden sm:block': !logos.logo_light,
              'dark:hidden dark:sm:block':
                logos.mobile_logo_dark ?? logos.mobile_logo_light,
            },
          )}
          dir_folder={logos.logo_dark.dir_folder}
          file_name={logos.logo_dark.file_name}
          height={logos.logo_dark.height}
          id="vitnode_logo_dark"
          mimetype={logos.logo_dark.mimetype}
          sizes="100vw"
          width={logos.logo_dark.width}
        />
      )}

      {logos.mobile_logo_light?.height && logos.mobile_logo_light.width && (
        <ImgFromApi
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'block sm:hidden': logos.logo_light ?? logos.logo_dark,
              'dark:hidden': logos.mobile_logo_dark,
            },
          )}
          dir_folder={logos.mobile_logo_light.dir_folder}
          file_name={logos.mobile_logo_light.file_name}
          height={logos.mobile_logo_light.height}
          id="vitnode_logo_mobile_light"
          mimetype={logos.mobile_logo_light.mimetype}
          sizes="100vw"
          width={logos.mobile_logo_light.width}
        />
      )}
      {logos.mobile_logo_dark?.height && logos.mobile_logo_dark.width && (
        <ImgFromApi
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'block sm:hidden dark:block dark:sm:hidden':
                logos.logo_dark ?? logos.logo_light,
              'hidden dark:block': logos.mobile_logo_light,
            },
          )}
          dir_folder={logos.mobile_logo_dark.dir_folder}
          file_name={logos.mobile_logo_dark.file_name}
          height={logos.mobile_logo_dark.height}
          id="vitnode_logo_mobile_dark"
          mimetype={logos.mobile_logo_dark.mimetype}
          sizes="100vw"
          width={logos.mobile_logo_dark.width}
        />
      )}
    </Link>
  );
};
