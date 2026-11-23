import type { ChatInlineToken } from "@vitnode/api/lib/chat/format";

import { parseChatMessage } from "@vitnode/api/lib/chat/format";
import React from "react";
import { useTranslations } from "use-intl";

const Spoiler = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations("core.global.chat");
  const [shown, setShown] = React.useState(false);

  return shown ? (
    <span className="bg-foreground/10 rounded px-0.5">{children}</span>
  ) : (
    <button
      aria-label={t("spoiler_show")}
      className="bg-foreground text-foreground rounded px-0.5 select-none"
      onClick={() => {
        setShown(true);
      }}
      type="button"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
};

const Inline = ({
  linksAsText,
  tokens,
}: {
  linksAsText: boolean;
  tokens: ChatInlineToken[];
}) =>
  tokens.map((token, index) => {
    switch (token.type) {
      case "bold":
        return (
          <strong className="font-semibold" key={index}>
            <Inline linksAsText={linksAsText} tokens={token.children} />
          </strong>
        );
      case "break":
        return <br key={index} />;
      case "code":
        return (
          <code
            className="bg-foreground/10 rounded px-1 font-mono text-xs"
            key={index}
          >
            {token.text}
          </code>
        );
      case "italic":
        return (
          <em key={index}>
            <Inline linksAsText={linksAsText} tokens={token.children} />
          </em>
        );
      case "link":
        return linksAsText ? (
          <span key={index}>{token.text}</span>
        ) : (
          <a
            className="break-all underline underline-offset-4"
            href={token.href}
            key={index}
            rel="nofollow ugc noopener noreferrer"
            target="_blank"
          >
            {token.text}
          </a>
        );
      case "spoiler":
        return (
          <Spoiler key={index}>
            <Inline linksAsText={linksAsText} tokens={token.children} />
          </Spoiler>
        );
      default:
        return <React.Fragment key={index}>{token.text}</React.Fragment>;
    }
  });

/**
 * A chat message's text with its light formatting. Links render as plain
 * text in messages sent as a chat request, so a stranger can't send you
 * somewhere with one click.
 */
export const ChatMessageBody = ({
  body,
  linksAsText = false,
}: {
  body: string;
  linksAsText?: boolean;
}) => {
  const blocks = React.useMemo(() => parseChatMessage(body), [body]);

  return (
    <div className="flex flex-col gap-1 text-pretty whitespace-normal">
      {blocks.map((block, index) =>
        block.type === "codeBlock" ? (
          <pre
            className="bg-foreground/10 overflow-x-auto rounded-md p-2 font-mono text-xs leading-relaxed"
            key={index}
          >
            <code>{block.text}</code>
          </pre>
        ) : (
          <p key={index}>
            <Inline linksAsText={linksAsText} tokens={block.children} />
          </p>
        ),
      )}
    </div>
  );
};
