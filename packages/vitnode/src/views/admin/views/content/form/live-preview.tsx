import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ExternalLinkIcon,
  LaptopIcon,
  MonitorOffIcon,
  RotateCwIcon,
  ScanIcon,
  SmartphoneIcon,
  TabletIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentFileDescriptor } from "@/content/files";
import type { ContentId } from "@/content/ids";
import type { ContentLivePreviewReferences } from "@/content/live-preview";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipWithContent } from "@/components/ui/tooltip";
import {
  CONTENT_LIVE_PREVIEW_MESSAGE,
  isContentLivePreviewReady,
} from "@/content/live-preview";

import { useContentEditorialTransport } from "../actions/editorial-transport";
import { useContentFormOptional } from "./context";
import { useContentFormValues } from "./values";

const LIVE_PREVIEW_DEVICES = {
  responsive: { height: 0, icon: ScanIcon, width: 0 },
  mobile: { height: 812, icon: SmartphoneIcon, width: 375 },
  tablet: { height: 1024, icon: TabletIcon, width: 768 },
  desktop: { height: 900, icon: LaptopIcon, width: 1440 },
} as const;

type LivePreviewDevice = keyof typeof LIVE_PREVIEW_DEVICES;

const LIVE_PREVIEW_DEVICE_IDS = [
  "responsive",
  "mobile",
  "tablet",
  "desktop",
] as const satisfies readonly LivePreviewDevice[];

const isLivePreviewDevice = (value: unknown): value is LivePreviewDevice =>
  LIVE_PREVIEW_DEVICE_IDS.some(id => id === value);

const POST_DELAY_MS = 120;
const RENEW_BEFORE_EXPIRY_MS = 60_000;

const useStageSize = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ height: 0, width: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, size };
};

const usePreviewLink = ({
  contentTypeId,
  itemId,
  locale,
}: {
  contentTypeId: string;
  itemId: ContentId;
  locale: string;
}) => {
  const transport = useContentEditorialTransport();

  return useQuery({
    gcTime: 0,
    queryFn: async () => {
      const localized = await transport.createPreview(
        contentTypeId,
        itemId,
        locale,
      );
      if (localized.preview || localized.status !== 404) return localized;

      return await transport.createPreview(contentTypeId, itemId);
    },
    queryKey: ["content-live-preview", contentTypeId, itemId, locale],
    refetchInterval: query => {
      const expiresAt = query.state.data?.preview?.expiresAt;
      if (!expiresAt) return false;

      return Math.max(
        new Date(expiresAt).getTime() - Date.now() - RENEW_BEFORE_EXPIRY_MS,
        RENEW_BEFORE_EXPIRY_MS,
      );
    },
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
  });
};

const userIdsOf = (
  values: Record<string, unknown>,
  fieldNames: readonly string[],
): number[] =>
  [
    ...new Set(
      fieldNames
        .flatMap(name => values[name])
        .filter((id): id is number => typeof id === "number"),
    ),
  ].toSorted((a, b) => a - b);

const useLiveReferences = ({
  contentTypeId,
  values,
}: {
  contentTypeId: string;
  values: Record<string, unknown>;
}): ContentLivePreviewReferences => {
  const form = useContentFormOptional();
  const transport = useContentEditorialTransport();
  const userIds = userIdsOf(values, form?.userFieldNames ?? []);

  const people = useQuery({
    enabled: userIds.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      await transport.livePreviewPeople(contentTypeId, userIds),
    queryKey: ["content-live-preview-people", contentTypeId, userIds],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const savedFiles = form?.files;
  const uploadedFiles = form?.uploadedFiles;
  const files = React.useMemo(() => {
    const byId = new Map<number, ContentFileDescriptor>();
    for (const value of Object.values(savedFiles ?? {})) {
      for (const file of [value ?? []].flat()) byId.set(file.id, file);
    }
    for (const file of uploadedFiles ?? []) byId.set(file.id, file);

    return [...byId.values()];
  }, [savedFiles, uploadedFiles]);

  const peopleData = people.data;

  return React.useMemo(
    () => ({ files, people: peopleData ?? [] }),
    [files, peopleData],
  );
};

const useLiveValues = ({
  contentTypeId,
  frame,
  locale,
  origin,
  popup,
}: {
  contentTypeId: string;
  frame: React.RefObject<HTMLIFrameElement | null>;
  locale: string;
  origin: null | string;
  popup: React.RefObject<null | Window>;
}) => {
  const values = useContentFormValues();
  const references = useLiveReferences({ contentTypeId, values });
  const latestRef = React.useRef({ locale, references, values });
  React.useEffect(() => {
    latestRef.current = { locale, references, values };
  });

  const send = React.useCallback(
    (target: null | undefined | Window) => {
      if (!target || origin === null || target.closed) return;
      target.postMessage(
        { type: CONTENT_LIVE_PREVIEW_MESSAGE.values, ...latestRef.current },
        origin,
      );
    },
    [origin],
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      send(frame.current?.contentWindow);
      send(popup.current);
    }, POST_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [frame, locale, popup, references, send, values]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || !isContentLivePreviewReady(event.data)) {
        return;
      }
      if (
        event.source === frame.current?.contentWindow ||
        event.source === popup.current
      ) {
        send(event.source);
      }
    };

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [frame, origin, popup, send]);
};

const FRAME_BORDER_PX = 2;

const frameBox = (
  device: LivePreviewDevice,
  stage: { height: number; width: number },
) => {
  const room = {
    height: Math.max(stage.height - FRAME_BORDER_PX, 0),
    width: Math.max(stage.width - FRAME_BORDER_PX, 0),
  };
  const { height, width } = LIVE_PREVIEW_DEVICES[device];
  if (width === 0) return { ...room, scale: 1 };

  return {
    height,
    scale: Math.min(1, room.width / width, room.height / height),
    width,
  };
};

const PreviewFrame = ({
  device,
  frameKey,
  frameRef,
  title,
  url,
}: {
  device: LivePreviewDevice;
  frameKey: number;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  title: string;
  url: string;
}) => {
  const { ref, size } = useStageSize();
  const { height, scale, width } = frameBox(device, size);

  return (
    <div
      className="bg-muted/60 flex min-h-0 flex-1 justify-center overflow-hidden p-4"
      ref={ref}
    >
      {size.width > 0 ? (
        <div
          className="bg-background flex shrink-0 items-start justify-center overflow-hidden rounded-lg border shadow-sm transition-[width,height] duration-300 ease-in-out motion-reduce:transition-none"
          style={{
            height: height * scale + FRAME_BORDER_PX,
            width: width * scale + FRAME_BORDER_PX,
          }}
        >
          <iframe
            className="bg-background shrink-0 origin-top border-0"
            key={frameKey}
            ref={frameRef}
            // oxlint-disable-next-line react/iframe-missing-sandbox -- the preview reads the editor's origin and session
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            src={url}
            style={{ height, transform: `scale(${scale})`, width }}
            title={title}
          />
        </div>
      ) : null}
    </div>
  );
};

/**
 * A live preview panel for a custom content form layout: device sizes, reload,
 * open in a new tab, and the record's preview page fed the unsaved values.
 *
 * Creates a preview link for `locale` (falling back to the default language
 * when that translation was never saved) and renews it before it expires. The
 * page behind the link must read the values with `useContentLivePreview` and
 * be served from the origin of that link. Needs `editorial.preview` on the
 * content type, a saved record (`itemId`), and a parent Content Engine form,
 * which supplies the values, the uploaded files and the user fields.
 *
 * @example
 * import { ContentLivePreview } from "@vitnode/core/content/admin-form";
 *
 * <ContentLivePreview
 *   contentTypeId={contentTypeId}
 *   itemId={itemId}
 *   locale="en"
 *   onClose={() => setPreviewOpen(false)}
 * />;
 */
export const ContentLivePreview = ({
  className,
  contentTypeId,
  itemId,
  locale,
  onClose,
}: {
  className?: string;
  /** The content type of the record being edited. */
  contentTypeId: string;
  /** The saved record to preview. */
  itemId: ContentId;
  /** The language being edited; the preview page renders in it. */
  locale: string;
  /** Called by the close button. */
  onClose: () => void;
}) => {
  const t = useTranslations("core.content.live_preview");
  const tErrors = useTranslations("core.global.errors");
  const tPreview = useTranslations("core.content.preview");
  const link = usePreviewLink({ contentTypeId, itemId, locale });
  const [device, setDevice] = React.useState<LivePreviewDevice>("responsive");
  const [frameKey, setFrameKey] = React.useState(0);
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const popupRef = React.useRef<null | Window>(null);
  const url = link.data?.preview?.url ?? null;
  const origin = url === null ? null : new URL(url).origin;
  const { height, width } = LIVE_PREVIEW_DEVICES[device];

  useLiveValues({
    contentTypeId,
    frame: frameRef,
    locale,
    origin,
    popup: popupRef,
  });

  const unavailable = link.data?.status === 503;

  return (
    <section
      aria-label={t("title")}
      className={cn("bg-background flex min-h-0 flex-col", className)}
    >
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b px-2 py-1.5">
        <h2 className="sr-only">{t("title")}</h2>
        <ToggleGroup
          aria-label={t("device")}
          onValueChange={next => {
            const [value] = next;
            if (isLivePreviewDevice(value)) setDevice(value);
          }}
          size="sm"
          value={[device]}
          variant="outline"
        >
          {LIVE_PREVIEW_DEVICE_IDS.map(id => {
            const Icon = LIVE_PREVIEW_DEVICES[id].icon;

            return (
              <TooltipWithContent key={id} text={t(`devices.${id}`)}>
                <ToggleGroupItem aria-label={t(`devices.${id}`)} value={id}>
                  <Icon aria-hidden />
                </ToggleGroupItem>
              </TooltipWithContent>
            );
          })}
        </ToggleGroup>
        <span className="text-muted-foreground text-xs tabular-nums max-sm:hidden">
          {width > 0 ? t("size", { height, width }) : t("devices.responsive")}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <TooltipWithContent text={t("reload")}>
            <Button
              aria-label={t("reload")}
              disabled={url === null}
              onClick={() => {
                setFrameKey(key => key + 1);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <RotateCwIcon aria-hidden />
            </Button>
          </TooltipWithContent>
          <TooltipWithContent text={t("open")}>
            <Button
              aria-label={t("open")}
              disabled={url === null}
              onClick={() => {
                if (url === null) return;
                popupRef.current = window.open(url, "vitnode-live-preview");
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ExternalLinkIcon aria-hidden />
            </Button>
          </TooltipWithContent>
          <TooltipWithContent text={t("close")}>
            <Button
              aria-label={t("close")}
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden />
            </Button>
          </TooltipWithContent>
        </div>
      </div>

      {url !== null ? (
        <PreviewFrame
          device={device}
          frameKey={frameKey}
          frameRef={frameRef}
          title={t("frame")}
          url={url}
        />
      ) : link.isPending ? (
        <div aria-busy="true" className="flex min-h-0 flex-1 flex-col p-4">
          <span className="sr-only" role="status">
            {t("loading")}
          </span>
          <Skeleton className="size-full rounded-lg" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center p-4">
          <Empty role="alert">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MonitorOffIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("load_error.title")}</EmptyTitle>
              <EmptyDescription>
                {unavailable ? tPreview("unavailable") : t("load_error.desc")}
              </EmptyDescription>
            </EmptyHeader>
            {unavailable ? null : (
              <EmptyContent>
                <Button
                  isLoading={link.isFetching}
                  onClick={() => void link.refetch()}
                  type="button"
                  variant="outline"
                >
                  <RotateCwIcon aria-hidden="true" />
                  {tErrors("try_again")}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </div>
      )}
    </section>
  );
};
