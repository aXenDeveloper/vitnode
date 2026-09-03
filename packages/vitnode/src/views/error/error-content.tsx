export const ErrorContent = ({
  actions,
  code,
  description,
  title,
}: {
  actions?: React.ReactNode;
  code: 400 | 403 | 404 | 409 | 429 | 500;
  description?: React.ReactNode;
  title?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center px-4 py-10 sm:py-20">
    <div className="max-w-md space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-primary text-8xl font-bold">{code}</h1>
        <h2 className="text-2xl font-medium">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        {actions}
      </div>
    </div>
  </div>
);
