export interface ReportedError {
  hints: unknown;
  message: string;
  name: string;
  stack: string;
}

export const reportedErrorOf = (error: unknown): ReportedError => {
  if (typeof error !== "object" || error === null) {
    return {
      hints: undefined,
      message: String(error),
      name: "Error",
      stack: "",
    };
  }

  const { hints, message, name, stack } = error as Record<string, unknown>;

  return {
    hints,
    message: typeof message === "string" ? message : JSON.stringify(error),
    name: typeof name === "string" ? name : "Error",
    stack: typeof stack === "string" ? stack : "",
  };
};

declare global {
  interface Window {
    __vitnodeDevError?: unknown;
  }
}

export const serverReportScript = (error: unknown): string =>
  `window.__vitnodeDevError=${JSON.stringify(reportedErrorOf(error)).replaceAll("<", "\\u003c")}`;

export const serverReportFor = (error: unknown): null | ReportedError => {
  if (window.__vitnodeDevError === undefined) return null;

  const report = reportedErrorOf(window.__vitnodeDevError);

  return report.message === reportedErrorOf(error).message ? report : null;
};
