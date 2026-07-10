export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">Blank test page</h1>
      <p className="text-muted-foreground">
        This page renders without the main layout - no header or footer, just
        the root providers.
      </p>
    </div>
  );
}
