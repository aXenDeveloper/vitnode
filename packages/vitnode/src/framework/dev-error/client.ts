import { DEV_ERROR_REPORT_ROUTE } from "./report-route";

interface ViteBuildError {
  frame?: string;
  id?: string;
  loc?: { column: number; file?: string; line: number };
  message: string;
  plugin?: string;
  stack?: string;
}

interface ViteHot {
  on: (
    event: "vite:error",
    listener: (payload: { err: ViteBuildError }) => void,
  ) => void;
}

const VITE_OVERLAY_TAG = "vite-error-overlay";
const CLOSE_MESSAGE = "vitnode:dev-error:close";
const FILE_LOCATION = /^(.*):(\d+):(\d+)$/;

let latestError: undefined | ViteBuildError;
let openDialog: HTMLDialogElement | null = null;
let shownOverlay: Element | null = null;

const scrapeViteOverlay = (overlay: Element): null | ViteBuildError => {
  const root = overlay.shadowRoot;
  const message = root?.querySelector(".message-body")?.textContent?.trim();
  if (!root || !message) return null;

  const plugin = root
    .querySelector(".plugin")
    ?.textContent?.trim()
    .replace(/^\[plugin:(.*)\]$/, "$1");
  const location = FILE_LOCATION.exec(
    root.querySelector(".file")?.textContent?.trim() ?? "",
  );

  return {
    loc: location
      ? {
          column: Number(location[3]),
          file: location[1],
          line: Number(location[2]),
        }
      : undefined,
    message,
    plugin: plugin === "" ? undefined : plugin,
    stack: root.querySelector(".stack")?.textContent ?? "",
  };
};

const reportOf = (error: ViteBuildError) => {
  const file = error.loc?.file ?? error.id;
  const location = file
    ? `    at ${error.plugin ?? "build"} (${file}:${String(error.loc?.line ?? 1)}:${String(error.loc?.column ?? 1)})`
    : "";
  const stack = (error.stack ?? "")
    .split("\n")
    .filter(line => line.trim().startsWith("at "))
    .join("\n");

  return {
    message: error.message,
    name: error.plugin ?? "BuildError",
    path: `${window.location.pathname}${window.location.search}`,
    runtime: "build",
    stack: [error.message, location, stack].filter(Boolean).join("\n"),
  };
};

const requestErrorPage = async (error: ViteBuildError) => {
  const response = await fetch(DEV_ERROR_REPORT_ROUTE, {
    body: JSON.stringify(reportOf(error)),
    headers: { "content-type": "application/json" },
    method: "POST",
  }).catch(() => null);

  return response?.ok ? response.text() : null;
};

const ensureBackdropStyle = () => {
  if (document.getElementById("vitnode-dev-error-style")) return;

  const style = document.createElement("style");
  style.id = "vitnode-dev-error-style";
  style.textContent =
    "dialog[data-vitnode-dev-error]::backdrop{background:transparent}";
  document.head.append(style);
};

const closeErrorPage = () => {
  openDialog?.close();
  openDialog?.remove();
  openDialog = null;
  shownOverlay = null;
};

const showErrorPage = (html: string, overlay: Element) => {
  closeErrorPage();

  ensureBackdropStyle();
  const dialog = document.createElement("dialog");
  dialog.dataset.vitnodeDevError = "";
  dialog.setAttribute("aria-label", "Build error details");
  dialog.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;";

  const frame = document.createElement("iframe");
  frame.title = "Build error details";
  frame.allow = "clipboard-write";
  frame.srcdoc = html;
  frame.style.cssText = "width:100%;height:100%;border:0;display:block;";
  frame.addEventListener("load", () => {
    frame.contentWindow?.focus();
  });

  dialog.addEventListener("close", () => {
    dialog.remove();
    if (openDialog === dialog) openDialog = null;
  });
  dialog.append(frame);
  document.body.append(dialog);
  dialog.showModal();

  openDialog = dialog;
  shownOverlay = overlay;
};

const replaceViteOverlay = async (overlay: Element) => {
  if (!(overlay instanceof HTMLElement) || overlay === shownOverlay) return;

  const scraped = scrapeViteOverlay(overlay);
  const error =
    latestError && (!scraped || scraped.message === latestError.message.trim())
      ? latestError
      : scraped;
  latestError = undefined;
  if (!error) return;

  overlay.style.display = "none";
  const html = await requestErrorPage(error);

  if (!overlay.isConnected) return;
  if (html === null) {
    overlay.style.display = "";

    return;
  }

  showErrorPage(html, overlay);
};

const watchViteOverlays = () => {
  for (const overlay of document.querySelectorAll(VITE_OVERLAY_TAG)) {
    void replaceViteOverlay(overlay);
  }

  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && node.localName === VITE_OVERLAY_TAG) {
          void replaceViteOverlay(node);
        }
      }

      for (const node of record.removedNodes) {
        if (node === shownOverlay) closeErrorPage();
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
};

window.addEventListener("message", event => {
  const data: unknown = event.data;
  if (
    openDialog &&
    event.source === openDialog.querySelector("iframe")?.contentWindow &&
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === CLOSE_MESSAGE
  ) {
    closeErrorPage();
  }
});

const hot = (import.meta as ImportMeta & { hot?: ViteHot }).hot;
hot?.on("vite:error", ({ err }) => {
  latestError = err;
});

if (document.body) {
  watchViteOverlays();
} else {
  document.addEventListener("DOMContentLoaded", watchViteOverlays, {
    once: true,
  });
}
