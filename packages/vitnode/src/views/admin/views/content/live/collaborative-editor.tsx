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

/** The Yjs fragment `Collaboration` binds the editor to. */
const FRAGMENT = "default";

/** A caret with its owner's name, readable on their color. */
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

/** The live channel of the shared socket, with the session's seat. */
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

  // The seat comes and goes with the socket; the providers hear about it.
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
  /** Who this tab was when the document opened; carets follow later changes. */
  user: ContentDocUser;
  ydoc: Y.Doc;
}

const subscribeNever = () => () => {};

/**
 * The rich text editor of one field in one language, bound to the shared Yjs
 * document everyone in the record types into: live carets, a per-person undo
 * history, and the record's JSON as the starting point of an empty document.
 *
 * The form value follows the document (`onChange` on every change, remote
 * ones too), so `Save` commits what everyone sees.
 */
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

  // What an empty shared document starts from: the record (or its draft) as
  // the form opened it - not what the editor reports once it is bound.
  const [seedValue] = React.useState(value);

  // The document and its provider talk to the socket from the moment they
  // exist, so they are made in an effect and torn down with it.
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

    // The form follows the shared document from the moment it is bound.
    emit(editor);

    const stopSeed = binding.provider.onSeed(() => {
      // Someone typed (or a translation landed) first: nothing to fill.
      if (binding.ydoc.getXmlFragment(FRAGMENT).length > 0) return;
      if (isRichTextEmpty(seedValue)) return;

      editor
        .chain()
        .command(({ tr }) => {
          // Filling the document is not an edit anyone should undo.
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

  // A name or color learned after the document opened reaches the carets.
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
