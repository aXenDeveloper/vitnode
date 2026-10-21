import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { DEV_ERROR_REPORT_ROUTE } from "@/framework/dev-error/report-route";

import { reportedErrorOf, serverReportFor } from "./dev-error-report";

const CLOSE_MESSAGE = "vitnode:dev-error:close";

const isCloseMessage = (data: unknown): boolean =>
  typeof data === "object" &&
  data !== null &&
  (data as { type?: unknown }).type === CLOSE_MESSAGE;

const requestErrorPage = async (error: unknown): Promise<null | string> => {
  const serverReport = serverReportFor(error);
  const response = await fetch(DEV_ERROR_REPORT_ROUTE, {
    body: JSON.stringify({
      ...(serverReport ?? reportedErrorOf(error)),
      runtime: serverReport ? "server" : "browser",
      path: `${window.location.pathname}${window.location.search}`,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  return response.ok ? response.text() : null;
};

export const DevErrorOverlay = ({ error }: { error: unknown }) => {
  const [closedError, setClosedError] = useState<unknown>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const publicHref = useLocation({ select: location => location.publicHref });
  const { data: html } = useQuery({
    queryFn: async () => requestErrorPage(error),
    queryKey: ["vitnode", "dev-error-page", publicHref, reportedErrorOf(error)],
    retry: false,
    staleTime: Infinity,
  });
  const isOpen = typeof html === "string" && closedError !== error;

  useEffect(() => {
    if (!isOpen) return;

    const onMessage = (event: MessageEvent) => {
      if (
        event.source === frameRef.current?.contentWindow &&
        isCloseMessage(event.data)
      ) {
        dialogRef.current?.close();
      }
    };

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      aria-label="Error details"
      className="m-0 size-full max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-transparent"
      onClose={() => {
        setClosedError(error);
      }}
      ref={dialog => {
        dialogRef.current = dialog;
        if (dialog && !dialog.open) dialog.showModal();
      }}
    >
      {/* react-doctor-disable-next-line react-doctor/iframe-missing-sandbox */}
      <iframe
        allow="clipboard-write"
        className="size-full border-0"
        onLoad={() => {
          frameRef.current?.contentWindow?.focus();
        }}
        ref={frameRef}
        srcDoc={html}
        title="Error details"
      />
    </dialog>
  );
};
