import * as Y from "yjs";

const UPLOAD_NODE_NAMES: ReadonlySet<string> = new Set(["attachment", "image"]);

const LIVE_FRAGMENT = "default";

const DELETED_ATTRIBUTES: Record<string, boolean | null> = {
  deleted: true,
  fileId: null,
  naturalHeight: null,
  naturalWidth: null,
  src: null,
};

const pointsAt = (value: unknown, fileId: number): boolean =>
  value === fileId || value === String(fileId);

const markElements = (
  parent: Y.XmlElement | Y.XmlFragment,
  fileId: number,
): boolean => {
  let changed = false;
  for (const child of parent.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue;

    if (
      UPLOAD_NODE_NAMES.has(child.nodeName) &&
      pointsAt(child.getAttribute("fileId"), fileId)
    ) {
      const element: Y.XmlElement<Record<string, boolean | null | string>> =
        child;
      for (const [name, value] of Object.entries(DELETED_ATTRIBUTES)) {
        element.setAttribute(name, value);
      }
      changed = true;
    }

    if (markElements(child, fileId)) changed = true;
  }

  return changed;
};

export const markLiveDocumentFileDeleted = (
  doc: Y.Doc,
  fileId: number,
): boolean => {
  let changed = false;
  doc.transact(() => {
    changed = markElements(doc.getXmlFragment(LIVE_FRAGMENT), fileId);
  });

  return changed;
};
