import type {
  ContentFormDialogProps,
  ContentRowPanel,
  ContentRowPanelProps,
} from "./slots";

/**
 * How the list mounts a component it was handed rather than one it declared.
 *
 * Two one-line components, and the indirection is the whole point. A screen that
 * writes
 *
 *     const { FormDialog } = contentAdminSlots();
 *     return <FormDialog … />;
 *
 * names a component *inside a render body*, which is what `static-components`
 * bans and what would remount the subtree on every render if the value really
 * were created there. Taking the component as a **prop** and rendering it from a
 * module-scope component says the same thing without the shape that reads as a
 * mistake - the identical arrangement `buildContentTableColumns` uses for a
 * plugin's cell override.
 *
 * Neither adds behaviour. They forward their props unchanged and render nothing
 * when the slot is empty, which is a supported state: an application that has
 * not imported the form module still gets a working list.
 */

/** The registered create/edit form dialog, wrapped around its own trigger. */
export const ContentFormDialogSlot = ({
  dialog: Dialog,
  ...props
}: ContentFormDialogProps & {
  dialog: (props: ContentFormDialogProps) => React.ReactNode;
}) => <Dialog {...props} />;

/** One registered editorial panel - history, delivery, preview, scheduling. */
export const ContentRowPanelSlot = ({
  panel: Panel,
  ...props
}: ContentRowPanelProps & { panel: ContentRowPanel }) => <Panel {...props} />;
