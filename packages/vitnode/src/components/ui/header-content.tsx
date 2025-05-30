import { cn } from '@/lib/utils';

interface HeaderContentH1Props extends HeaderContentProps {
  h1: React.ReactNode | string;
  h2?: never;
}

interface HeaderContentH2Props extends HeaderContentProps {
  h1?: never;
  h2: React.ReactNode | string;
}

interface HeaderContentProps {
  children?: React.ReactNode;
  className?: string;
  desc?: React.ReactNode;
  ref?: React.RefCallback<HTMLDivElement>;
}

export const HeaderContent = ({
  children,
  className,
  desc,
  h1,
  h2,
  ref,
}: HeaderContentH1Props | HeaderContentH2Props) => {
  return (
    <div
      className={cn(
        'mb-6 flex min-h-9 flex-col items-start gap-2 sm:flex-row sm:gap-4',
        className,
      )}
      ref={ref}
    >
      <div className="h-full flex-1 space-y-1 text-left sm:self-center">
        {h1 ? (
          <h1 className="scroll-m-20 text-balance text-4xl font-extrabold tracking-tight">
            {h1}
          </h1>
        ) : (
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
            {h2}
          </h2>
        )}
        {desc && (
          <div className="text-muted-foreground text-sm leading-7 [&_p]:text-left">
            {desc}
          </div>
        )}
      </div>

      {children && (
        <div className="flex w-full flex-col flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-row [&>*]:w-full [&>*]:sm:w-auto">
          {children}
        </div>
      )}
    </div>
  );
};
