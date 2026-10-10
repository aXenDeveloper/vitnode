import type { Editor } from "@tiptap/react";

import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import React from "react";
import * as Y from "yjs";

import type { CollaborativeEditorProps } from "@/components/tiptap/collaboration";
import type {
  ContentLiveDocRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import { useEditorConfig } from "@/components/editor-provider";
import { EditorSkeleton } from "@/components/tiptap/editor-skeleton";
import {
  editorEmojiItems,
  toRichTextDocument,
} from "@/components/tiptap/rich-text-json";
import { TipTapEditor } from "@/components/tiptap/tiptap-editor";
import { contentLiveChannel } from "@/content/live/protocol";
import { isRichTextEmpty } from "@/content/rich-text/document";
import { useVitNodeWebSocketContext } from "@/ws/provider";

import type { ContentLiveContextValue } from "./context";
import type {
  ContentDocProvider,
  ContentDocTransport,
  ContentDocUser,
} from "./doc-provider";

import { createContentDocProvider } from "./doc-provider";
import {
  contentLiveLabelColor,
  contentLiveMemberColor,
} from "./presence-model";

const FRAGMENT = "default";

const renderCaret = (user: Record<string, unknown>): HTMLElement => {
  const color =
    typeof user.color === "string" && user.color !== "transparent"
      ? user.color
      : contentLiveMemberColor(null);
  const caret = document.createElement("span");
  caret.classList.add("collaboration-carets__caret");
  caret.style.borderColor = color;

  const label = document.createElement("div");
  label.classList.add("collaboration-carets__label");
  label.style.backgroundColor = color;
  label.style.color = contentLiveLabelColor(color);
  label.textContent = typeof user.name === "string" ? user.name : "";
  caret.append(label);

  return caret;
};

const renderSelection = (user: Record<string, unknown>) => ({
  class: "collaboration-carets__selection",
  style: `background-color: ${contentLiveMemberColor(
    typeof user.color === "string" ? user.color : null,
  )}33`,
});

const useDocTransport = (live: boolean): ContentDocTransport => {
  const { send, subscribe } = useVitNodeWebSocketContext();
  const liveRef = React.useRef(live);
  const listenersRef = React.useRef(new Set<(next: boolean) => void>());

  const transport = React.useMemo<ContentDocTransport>(
    () => ({
      isLive: () => liveRef.current,
      onLiveChange: listener => {
        listenersRef.current.add(listener);

        return () => {
          listenersRef.current.delete(listener);
        };
      },
      send: message => {
        send(contentLiveChannel.id, message);
      },
      subscribe: listener =>
        subscribe(contentLiveChannel.id, data => {
          listener(data as ContentLiveServerMessage);
        }),
    }),
    [send, subscribe],
  );

  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- `live` arrives over the socket; this forwards it to providers outside React
    if (liveRef.current === live) return;
    liveRef.current = live;
    for (const listener of listenersRef.current) listener(live);
  }, [live]);

  return transport;
};

interface Binding {
  provider: ContentDocProvider;
  user: ContentDocUser;
  ydoc: Y.Doc;
}

const subscribeNever = () => () => {};

export const ContentLiveRichTextEditor = ({
  className,
  field,
  live,
  locale,
  onChange,
  value,
  ...props
}: CollaborativeEditorProps & {
  field: string;
  live: ContentLiveContextValue;
}) => {
  const { richText, session } = live;
  const { emojis } = useEditorConfig();
  const emojiItems = React.useMemo(() => editorEmojiItems(emojis), [emojis]);
  const transport = useDocTransport(session.live);

  const contentTypeId = live.spec.contentTypeId;
  const itemId = live.itemId;
  const doc = React.useMemo<ContentLiveDocRef>(
    () => ({ contentTypeId, field, itemId, locale }),
    [contentTypeId, field, itemId, locale],
  );

  const self = session.members.find(
    member => member.clientId === session.clientId,
  );
  const color = contentLiveMemberColor(self?.avatarColor ?? null);
  const user = React.useMemo<ContentDocUser>(
    () => ({ color, name: self?.name ?? "" }),
    [color, self?.name],
  );
  const userRef = React.useRef(user);
  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [seedValue] = React.useState(value);

  const [binding, setBinding] = React.useState<Binding | null>(null);
  React.useEffect(() => {
    const ydoc = new Y.Doc();
    const opener = userRef.current;
    const provider = createContentDocProvider({
      clientId: session.clientId,
      doc,
      transport,
      user: opener,
      ydoc,
    });
    // eslint-disable-next-line @eslint-react/set-state-in-effect, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-external-store-subscription -- a resource with a lifetime, not derived state
    setBinding({ provider, user: opener, ydoc });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [doc, session.clientId, transport]);

  const synced = React.useSyncExternalStore(
    binding?.provider.subscribeSynced ?? subscribeNever,
    () => binding?.provider.synced() ?? false,
    () => false,
  );

  const extensions = React.useMemo(
    () =>
      binding
        ? [
            Collaboration.configure({
              document: binding.ydoc,
              field: FRAGMENT,
            }),
            CollaborationCaret.configure({
              provider: binding.provider,
              render: renderCaret,
              selectionRender: renderSelection,
              user: binding.user,
            }),
          ]
        : [],
    [binding],
  );

  const [editor, setEditor] = React.useState<Editor | null>(null);

  const emit = React.useEffectEvent((current: Editor) => {
    onChange(toRichTextDocument(current.getJSON(), emojiItems));
  });

  React.useEffect(() => {
    if (!editor || !binding) return;

    emit(editor);

    const stopSeed = binding.provider.onSeed(() => {
      if (binding.ydoc.getXmlFragment(FRAGMENT).length > 0) return;
      if (isRichTextEmpty(seedValue)) return;

      editor
        .chain()
        .command(({ tr }) => {
          tr.setMeta("addToHistory", false);

          return true;
        })
        .setContent(seedValue)
        .run();
    });
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-live-state-to-parent -- the registry lives outside React: AI tools find the editor through it
    const stopRegister = richText.register(field, locale, {
      replace: document => {
        editor.commands.setContent(document);
      },
    });

    return () => {
      stopSeed();
      stopRegister();
    };
  }, [binding, editor, field, locale, richText, seedValue]);

  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- `user` comes from presence over the socket, not from an event here
    if (!editor || editor.isDestroyed) return;
    editor.commands.updateUser(user);
  }, [editor, user]);

  if (!binding || !synced) return <EditorSkeleton className={className} />;

  return (
    <TipTapEditor
      className={className}
      extensions={extensions}
      format="json"
      key={binding.ydoc.guid}
      onChange={onChange}
      onEditor={setEditor}
      undoRedo={false}
      {...props}
    />
  );
};
