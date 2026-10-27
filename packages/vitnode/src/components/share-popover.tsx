import { cn } from "cn";
import { MailIcon, Share2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipGroup, TooltipWithContent } from "@/components/ui/tooltip";

interface ShareNetwork {
  brandColor?: string;
  href: (link: { title: string; url: string }) => string;
  iconPath: string;
  name: string;
}

const SHARE_NETWORKS: ShareNetwork[] = [
  {
    name: "X",
    iconPath:
      "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
    href: ({ title, url }) =>
      `https://x.com/intent/post?${new URLSearchParams({ text: title, url })}`,
  },
  {
    name: "Bluesky",
    brandColor: "#1185FE",
    iconPath:
      "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z",
    href: ({ title, url }) =>
      `https://bsky.app/intent/compose?${new URLSearchParams({ text: title ? `${title} ${url}` : url })}`,
  },
  {
    name: "Facebook",
    brandColor: "#0866FF",
    iconPath:
      "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
    href: ({ url }) =>
      `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
  },
  {
    name: "Reddit",
    brandColor: "#FF4500",
    iconPath:
      "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z",
    href: ({ title, url }) =>
      `https://www.reddit.com/submit?${new URLSearchParams({ title, url })}`,
  },
  {
    name: "LinkedIn",
    brandColor: "#0A66C2",
    iconPath:
      "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
    href: ({ url }) =>
      `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`,
  },
];

const TILE_CLASS =
  "focus-visible:ring-ring/50 flex aspect-square w-full items-center justify-center rounded-full outline-none transition-[scale,opacity] duration-150 ease-out hover:opacity-90 focus-visible:ring-3 active:scale-[0.96] motion-reduce:transition-none [&_svg]:size-5";

const emailHref = ({ title, url }: { title: string; url: string }) =>
  `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;

const canUseShareSheet = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const ShareLinks = ({
  copyRef,
  onShared,
  title,
  url,
}: {
  copyRef: React.Ref<HTMLButtonElement>;
  onShared: () => void;
  title: string;
  url: string;
}) => {
  const t = useTranslations("core.global.share");
  const absoluteUrl = React.useMemo(
    () => new URL(url, window.location.href).href,
    [url],
  );
  const link = { title, url: absoluteUrl };

  const openShareSheet = async () => {
    try {
      await navigator.share({ title: title || undefined, url: absoluteUrl });
      onShared();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("failed"));
    }
  };

  return (
    <>
      <InputGroup>
        <InputGroupInput
          aria-label={t("link")}
          className="text-base md:text-sm"
          onFocus={event => {
            event.currentTarget.select();
          }}
          readOnly
          value={absoluteUrl}
        />
        <InputGroupAddon align="inline-end">
          <CopyButton
            aria-label={t("copy")}
            content={absoluteUrl}
            ref={copyRef}
            size="icon-xs"
            variant="ghost"
          />
        </InputGroupAddon>
      </InputGroup>

      <TooltipGroup>
        <ul className="grid grid-cols-6 gap-2">
          {SHARE_NETWORKS.map(network => (
            <li key={network.name}>
              <TooltipWithContent text={network.name}>
                <a
                  aria-label={t("on", { network: network.name })}
                  className={cn(
                    TILE_CLASS,
                    network.brandColor
                      ? "text-white"
                      : "bg-foreground text-background",
                  )}
                  href={network.href(link)}
                  onClick={onShared}
                  rel="noopener noreferrer"
                  style={
                    network.brandColor
                      ? { backgroundColor: network.brandColor }
                      : undefined
                  }
                  target="_blank"
                >
                  <svg
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d={network.iconPath} />
                  </svg>
                </a>
              </TooltipWithContent>
            </li>
          ))}
          <li>
            <TooltipWithContent text={t("email")}>
              <a
                aria-label={t("email")}
                className={cn(TILE_CLASS, "bg-muted text-foreground")}
                href={emailHref(link)}
                onClick={onShared}
              >
                <MailIcon aria-hidden="true" />
              </a>
            </TooltipWithContent>
          </li>
        </ul>
      </TooltipGroup>

      {canUseShareSheet() ? (
        <Button
          className="w-full"
          onClick={() => {
            void openShareSheet();
          }}
          variant="secondary"
        >
          <Share2Icon aria-hidden="true" />
          {t("more")}
        </Button>
      ) : null}
    </>
  );
};

/**
 * A share menu anchored to its trigger: the link with a copy button, one-click
 * sharing to X, Bluesky, Facebook, Reddit, LinkedIn and email, and the
 * device's own share sheet where the browser has one. Universal; the link is
 * resolved in the browser when the menu opens, so a root-relative `url` such
 * as `/blog/article/hello#comment-x` is fine during SSR.
 *
 * @example
 * ```tsx
 * import { SharePopover } from "@vitnode/core/components/share-popover";
 * import { Button } from "@vitnode/core/components/ui/button";
 *
 * <SharePopover title="Hello world" url="/blog/article/hello-world">
 *   <Button variant="outline">Share</Button>
 * </SharePopover>;
 * ```
 */
export const SharePopover = ({
  align = "start",
  children,
  description,
  heading,
  side = "bottom",
  title = "",
  url,
}: {
  /** Popover alignment against the trigger. Defaults to `"start"`. */
  align?: React.ComponentProps<typeof PopoverContent>["align"];
  /** The trigger, such as a `Button`; it must forward its ref and props. */
  children: React.ReactElement;
  /** A line under the heading, such as what is being shared. */
  description?: React.ReactNode;
  /** The popover heading. Defaults to the translated "Share". */
  heading?: React.ReactNode;
  /** Popover side. Defaults to `"bottom"`. */
  side?: React.ComponentProps<typeof PopoverContent>["side"];
  /** The text networks prefill next to the link, and the email subject. */
  title?: string;
  /** The link to share: absolute, or relative to the current page. */
  url: string;
}) => {
  const t = useTranslations("core.global.share");
  const [open, setOpen] = React.useState(false);
  const copyRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={children} />
      <PopoverContent
        align={align}
        className="w-80 max-w-[calc(100vw-2rem)]"
        initialFocus={copyRef}
        side={side}
      >
        <PopoverHeader>
          <PopoverTitle>{heading ?? t("title")}</PopoverTitle>
          {description ? (
            <PopoverDescription className="truncate">
              {description}
            </PopoverDescription>
          ) : null}
        </PopoverHeader>
        <ShareLinks
          copyRef={copyRef}
          onShared={() => {
            setOpen(false);
          }}
          title={title}
          url={url}
        />
      </PopoverContent>
    </Popover>
  );
};
