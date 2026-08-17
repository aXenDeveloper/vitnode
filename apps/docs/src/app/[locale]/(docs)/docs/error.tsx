"use client";

import {
  RouteErrorView,
  type RouteErrorViewProps,
} from "@vitnode/core/views/error/route-error-view";

export default function ErrorBoundary({ error, retry }: RouteErrorViewProps) {
  return <RouteErrorView error={error} retry={retry} />;
}
