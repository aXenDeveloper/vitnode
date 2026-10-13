export const DiscussionShell = ({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) => (
  <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12">
    <header className="flex flex-col gap-2">
      <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-muted-foreground leading-relaxed text-pretty">
        {description}
      </p>
    </header>

    {children}
  </div>
);
