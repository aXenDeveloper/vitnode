"use client";

import { GlobalErrorView } from "@vitnode/core/views/error/global-error-view";
import { Geist } from "next/font/google";

import "./global.css";

const geist = Geist({
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <GlobalErrorView
      className={`${geist.className} antialiased`}
      error={error}
      retry={retry}
    />
  );
}
