import type {
  ContentFormDialogProps,
  ContentRowPanel,
  ContentRowPanelProps,
} from "./slots";

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
