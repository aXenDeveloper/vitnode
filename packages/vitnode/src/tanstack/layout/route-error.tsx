import { lazy, Suspense } from "react";

import { serverReportScript } from "./dev-error-report";
import { Error500Page } from "./not-found";

const DevErrorOverlay = lazy(async () => ({
  default: (await import("./dev-error-overlay")).DevErrorOverlay,
}));

const DevErrorDetails = ({ error }: { error: unknown }) => (
  <>
    <script
      dangerouslySetInnerHTML={{
        __html: typeof window === "undefined" ? serverReportScript(error) : "",
      }}
      suppressHydrationWarning
    />
    <Suspense fallback={null}>
      <DevErrorOverlay error={error} />
    </Suspense>
  </>
);

export const RouteErrorPage = ({
  actions,
  error,
}: {
  actions?: React.ReactNode;
  error: unknown;
}) => (
  <>
    <Error500Page actions={actions} />
    {process.env.NODE_ENV === "development" && (
      <DevErrorDetails error={error} />
    )}
  </>
);
